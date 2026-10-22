import {surfaceHash,validSurfaceId} from './surface-rules.js';
import {expireHoles} from './fishing-rules.js';
import {ensureWorld,resetEncounter,activateEncounter,advanceBoss,worldView} from './world-rules.js';
import {mediaKinds,validMedia,battleAction} from './game-rules.js';
import http from 'node:http';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sessions=new Map(), peers=new Map(),game={};
function prunePeers(){for(const [id,p] of peers)if(Date.now()-(p.lastSeen||0)>35000){peers.delete(id);p.res.end();}resetIfEmpty();}
const password=process.env.GAME_PASSWORD||'RAE1210';
let db,pool;
if(process.env.RELETTER_DATABASE_URL){
  const {default:pg}=await import('pg');
  pool=new pg.Pool({connectionString:process.env.RELETTER_DATABASE_URL,ssl:process.env.DB_SSL==='false'?false:{rejectUnauthorized:false}});
  await pool.query('CREATE TABLE IF NOT EXISTS reletter_chat (id TEXT PRIMARY KEY, payload JSONB NOT NULL)');
  await pool.query('CREATE TABLE IF NOT EXISTS reletter_entries (id TEXT PRIMARY KEY, payload JSONB NOT NULL)');
}else{
  await mkdir(resolve(root,'data'),{recursive:true});
  db=new DatabaseSync(process.env.SQLITE_PATH||resolve(root,'data/reletter.sqlite'));
  db.exec('CREATE TABLE IF NOT EXISTS reletter_chat (id TEXT PRIMARY KEY, payload TEXT NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS reletter_entries (id TEXT PRIMARY KEY, payload TEXT NOT NULL)');
}
if(pool)await pool.query('CREATE TABLE IF NOT EXISTS reletter_surfaces (id TEXT PRIMARY KEY,data TEXT NOT NULL)');else db.exec('CREATE TABLE IF NOT EXISTS reletter_surfaces (id TEXT PRIMARY KEY,data TEXT NOT NULL)');
async function surfaceRow(id){return pool?(await pool.query('SELECT data FROM reletter_surfaces WHERE id=$1',[id])).rows[0]:db.prepare('SELECT data FROM reletter_surfaces WHERE id=?').get(id);}
async function entries(){const rows=pool?(await pool.query('SELECT payload FROM reletter_entries')).rows.map(x=>x.payload):db.prepare('SELECT payload FROM reletter_entries').all().map(x=>JSON.parse(x.payload));return rows.sort((a,b)=>a.created_at.localeCompare(b.created_at));}
async function insert(e){if(pool)return (await pool.query('INSERT INTO reletter_entries VALUES ($1,$2) ON CONFLICT (id) DO NOTHING',[e.id,JSON.stringify(e)])).rowCount;return db.prepare('INSERT OR IGNORE INTO reletter_entries VALUES (?,?)').run(e.id,JSON.stringify(e)).changes;}
async function remove(id){if(pool)await pool.query('DELETE FROM reletter_entries WHERE id=$1',[id]);else db.prepare('DELETE FROM reletter_entries WHERE id=?').run(id);}
if(pool){await pool.query('CREATE TABLE IF NOT EXISTS reletter_world (id INTEGER PRIMARY KEY,payload JSONB NOT NULL)');Object.assign(game,(await pool.query('SELECT payload FROM reletter_world WHERE id=1')).rows[0]?.payload||{});}else{db.exec('CREATE TABLE IF NOT EXISTS reletter_world (id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');Object.assign(game,JSON.parse(db.prepare('SELECT payload FROM reletter_world WHERE id=1').get()?.payload||'{}'));}
resetEncounter(game);
let worldWrite=Promise.resolve();
function saveWorld(){const payload=JSON.stringify(game);worldWrite=worldWrite.catch(()=>{}).then(async()=>{if(pool)await pool.query('INSERT INTO reletter_world VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',[payload]);else db.prepare('INSERT OR REPLACE INTO reletter_world VALUES(1,?)').run(payload);});return worldWrite;}
function resetIfEmpty(){if(peers.size){delete game.offlineSince;return;}if(!game.offlineSince){game.offlineSince=Date.now();setTimeout(resetIfEmpty,5100).unref();}else if(Date.now()-game.offlineSince>=5000){expireHoles(game,Date.now(),true);resetEncounter(game);delete game.offlineSince;saveWorld().catch(console.error);}}
const broadcast=(type,data)=>{for(const p of peers.values())p.res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);};
const roster=()=>[...peers].map(([id,p])=>({id,character:p.character,state:p.state}));
function body(req){return new Promise((ok,no)=>{let s='';req.on('data',c=>{s+=c;if(s.length>20_000_000){no(new Error('File too large'));req.destroy();}});req.on('end',()=>{try{ok(JSON.parse(s||'{}'));}catch{no(new Error('Invalid JSON'));}});});}
function json(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...headers});res.end(JSON.stringify(data));}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.otf':'font/otf'};
const server=http.createServer(async(req,res)=>{
try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/health')return json(res,200,{ok:true,database:pool?'postgres':'sqlite'});
  if(url.pathname==='/api/login'&&req.method==='POST'){
    const b=await body(req), supplied=Buffer.from(String(b.password||'').trim().toUpperCase()),expected=Buffer.from(password.trim().toUpperCase());
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return json(res,401,{error:'Incorrect password'});
    const prior=req.headers.cookie?.match(/(?:^|;\s*)reletter_session=([^;]+)/)?.[1];const id=sessions.get(prior)?.expires>Date.now()?prior:randomUUID();sessions.set(id,{...sessions.get(id),expires:Date.now()+86400000});
    return json(res,200,{ok:true},{'Set-Cookie':`reletter_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.NODE_ENV==='production'?'; Secure':''}`});
  }
  const id=req.headers.cookie?.match(/(?:^|;\s*)reletter_session=([^;]+)/)?.[1],session=sessions.get(id);
  if(url.pathname.startsWith('/api/')){
    if(!session||session.expires<Date.now())return json(res,401,{error:'Please enter the password first'});
    if(url.pathname==='/api/entries'&&req.method==='GET')return json(res,200,await entries());
    if(url.pathname==='/api/entries'&&req.method==='POST'){
      const b=await body(req),p=b.part||{};
      if(typeof b.text!=='string'||b.text.length>4000)return json(res,400,{error:'Message too long'});
      for(const k of mediaKinds)if(!validMedia(k,p[k]))return json(res,400,{error:'Unsupported media format or size'});
      if(p.parentId&&!(await entries()).some(e=>e.id===p.parentId))return json(res,400,{error:'The original plant no longer exists'});
      const vector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<100000)?v:null;
      const e={id:typeof b.id==='string'&&/^[a-f0-9-]{36}$/.test(b.id)?b.id:randomUUID(),text:b.text,created_at:new Date().toISOString(),part:{username:peers.get(id)?.character||session.character||'Ely',drawing:p.drawing||null,image:p.image||null,audio:p.audio||null,video:p.video||null,parentId:p.parentId||null,rotation:Number.isFinite(p.rotation)?p.rotation:0,position:vector(p.position),scale:vector(p.scale)}};
      if(await insert(e))broadcast('plant',{...e,sender:id});return json(res,201,e);
    }
    if(url.pathname.startsWith('/api/entries/')&&req.method==='DELETE'){const entryId=url.pathname.split('/').pop();await remove(entryId);broadcast('deleted',{id:entryId});return json(res,200,{ok:true});}
    if(url.pathname==='/api/players'){prunePeers();return json(res,200,roster().map(p=>({...p,self:p.id===id})));}
    if(url.pathname==='/api/disconnect'&&req.method==='POST'){const b=await body(req),p=peers.get(id);if(p?.connectionId===b.connectionId){p.res.end();peers.delete(id);resetIfEmpty();broadcast('players',roster());}return json(res,200,{ok:true});}
    if(url.pathname==='/api/world'&&req.method==='GET')return json(res,200,worldView(game));
    if(url.pathname==='/api/surfaces'&&req.method==='POST'){const b=await body(req),key=await surfaceHash(b.image);if(pool)await pool.query('INSERT INTO reletter_surfaces VALUES($1,$2) ON CONFLICT(id) DO NOTHING',[key,b.image]);else db.prepare('INSERT OR IGNORE INTO reletter_surfaces VALUES(?,?)').run(key,b.image);return json(res,200,{id:key});}
    if(url.pathname.startsWith('/api/surfaces/')&&req.method==='GET'){const key=url.pathname.split('/').pop();if(!validSurfaceId(key))return json(res,400,{error:'Invalid skin'});const row=await surfaceRow(key);return json(res,row?200:404,row?{image:row.data}:{error:'Skin missing'});}
    if(url.pathname==='/api/game'&&req.method==='POST'){prunePeers();const p=peers.get(id);if(!p)return json(res,409,{error:'Not connected'});const input=await body(req);if(input.surface&&!await surfaceRow(input.surface))return json(res,400,{error:'Upload the skin first'});advanceBoss(game,roster());const result=battleAction(game,{...p,id},roster(),input);if(result.error)return json(res,400,{error:result.error});game.worldRevision++;await saveWorld();broadcast('game',worldView(game));if(result.shot)broadcast('water',result.shot);return json(res,200,{ok:true,blocked:result.blocked,defeated:result.defeated,notice:result.notice,game:worldView(game)});}
    if(url.pathname==='/api/events'){
      prunePeers();
      const character=url.searchParams.get('character');
      if(!['Ely','Rae'].includes(character))return json(res,400,{error:'Choose a character'});
      if([...peers].some(([other,p])=>other!==id&&p.character===character))return json(res,409,{error:'This character is in use. Choose the other character.'});
      if(peers.size>=2&&!peers.has(id))return json(res,409,{error:'Both seats are occupied'});
      peers.get(id)?.res.end();session.character=character;
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
      const peer={res,character,state:null,lastSeen:Date.now(),connectionId:url.searchParams.get('connectionId')};peers.set(id,peer);resetIfEmpty();
      res.write(`event: welcome\ndata: ${JSON.stringify({id,players:roster()})}\n\n`);broadcast('players',roster());res.write(`event: game\ndata: ${JSON.stringify(worldView(game))}\n\n`);
      const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),15000);
      res.on('close',()=>{clearInterval(heartbeat);if(peers.get(id)===peer){peers.delete(id);resetIfEmpty();broadcast('players',roster());}});return;
    }
    if(url.pathname==='/api/state'&&req.method==='POST'){
      const p=peers.get(id),b=await body(req);if(!p)return json(res,409,{error:'Not connected'});p.lastSeen=Date.now();
      if(!Array.isArray(b.position)||b.position.length!==3||!b.position.every(Number.isFinite)||!Number.isFinite(b.rotation))return json(res,400,{error:'Invalid position'});
      p.state={position:b.position,rotation:b.rotation,visible:!!b.visible,phase:b.phase,paused:!!b.paused};broadcast('state',{id,character:p.character,state:p.state});return json(res,200,{ok:true});
    }
    if(url.pathname==='/api/chat'&&req.method==='GET'){const rows=pool?(await pool.query('SELECT payload FROM reletter_chat')).rows.map(r=>r.payload):db.prepare('SELECT payload FROM reletter_chat').all().map(r=>JSON.parse(r.payload));return json(res,200,rows.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id)));}
    if(url.pathname==='/api/chat'&&req.method==='POST'){
      const p=peers.get(id),b=await body(req);if(!p)return json(res,409,{error:'Not connected'});
      if(typeof b.text!=='string'||!b.text.trim()||b.text.length>500)return json(res,400,{error:'Message must contain 1–500 characters'});
      if(p.lastChat&&Date.now()-p.lastChat<400)return json(res,429,{error:'Please wait before sending again'});
      if(b.text.trim().startsWith('/')){if(!activateEncounter(game,b.text,p.character))return json(res,400,{error:'Unknown command'});p.lastChat=Date.now();await saveWorld();broadcast('game',worldView(game));return json(res,200,{ok:true,command:true});}
      const chat={id:randomUUID(),name:p.character,text:b.text.trim(),time:Date.now()};if(pool)await pool.query('INSERT INTO reletter_chat VALUES($1,$2)',[chat.id,JSON.stringify(chat)]);else db.prepare('INSERT INTO reletter_chat VALUES(?,?)').run(chat.id,JSON.stringify(chat));p.lastChat=chat.time;broadcast('chat',chat);if(activateEncounter(game,chat.text,chat.name)){await saveWorld();broadcast('game',worldView(game));}return json(res,200,{ok:true});
    }
    return json(res,404,{error:'API not found'});
  }
  const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  const relative=path.slice(root.length+1);
  if(!path.startsWith(root+'\\')&&!path.startsWith(root+'/'))return json(res,403,{error:'Forbidden'});
  if(relative.split(/[\\/]/).some(x=>x.startsWith('.'))||/^(server|data|tests|node_modules)([\\/]|$)/.test(relative)||!mime[extname(path).toLowerCase()])return json(res,403,{error:'Forbidden'});
  const content=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path).toLowerCase()]});res.end(content);
}catch(e){if(!res.headersSent)json(res,e.code==='ENOENT'?404:500,{error:'Request failed'});else res.end();console.error(e.message);}
});
setInterval(()=>{if(!peers.size)return;prunePeers();const revision=game.worldRevision,generation=game.boss.generation;advanceBoss(game,roster());if(generation!==game.boss.generation||revision!==game.worldRevision){saveWorld().catch(console.error);broadcast('game',worldView(game));}broadcast('boss',game.boss);},100).unref();
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('RELETTER http://localhost:'+(process.env.PORT||3000)));

setInterval(()=>{prunePeers();if(expireHoles(game)){saveWorld().catch(console.error);broadcast('game',worldView(game));}},15000).unref();
