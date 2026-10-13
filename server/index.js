import http from 'node:http';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sessions=new Map(), peers=new Map();
const password=process.env.GAME_PASSWORD||'RAE1210';
let db,pool;
if(process.env.RELETTER_DATABASE_URL){
  const {default:pg}=await import('pg');
  pool=new pg.Pool({connectionString:process.env.RELETTER_DATABASE_URL,ssl:process.env.DB_SSL==='false'?false:{rejectUnauthorized:false}});
  await pool.query('CREATE TABLE IF NOT EXISTS reletter_entries (id TEXT PRIMARY KEY, payload JSONB NOT NULL)');
}else{
  await mkdir(resolve(root,'data'),{recursive:true});
  db=new DatabaseSync(process.env.SQLITE_PATH||resolve(root,'data/reletter.sqlite'));
  db.exec('CREATE TABLE IF NOT EXISTS reletter_entries (id TEXT PRIMARY KEY, payload TEXT NOT NULL)');
}
async function entries(){const rows=pool?(await pool.query('SELECT payload FROM reletter_entries')).rows.map(x=>x.payload):db.prepare('SELECT payload FROM reletter_entries').all().map(x=>JSON.parse(x.payload));return rows.sort((a,b)=>a.created_at.localeCompare(b.created_at));}
async function insert(e){if(pool)return (await pool.query('INSERT INTO reletter_entries VALUES ($1,$2) ON CONFLICT (id) DO NOTHING',[e.id,JSON.stringify(e)])).rowCount;return db.prepare('INSERT OR IGNORE INTO reletter_entries VALUES (?,?)').run(e.id,JSON.stringify(e)).changes;}
async function remove(id){if(pool)await pool.query('DELETE FROM reletter_entries WHERE id=$1',[id]);else db.prepare('DELETE FROM reletter_entries WHERE id=?').run(id);}
const broadcast=(type,data)=>{for(const p of peers.values())p.res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);};
const roster=()=>[...peers].map(([id,p])=>({id,character:p.character,state:p.state}));
function body(req){return new Promise((ok,no)=>{let s='';req.on('data',c=>{s+=c;if(s.length>5_000_000){no(new Error('檔案過大'));req.destroy();}});req.on('end',()=>{try{ok(JSON.parse(s||'{}'));}catch{no(new Error('JSON 格式錯誤'));}});});}
function json(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...headers});res.end(JSON.stringify(data));}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.otf':'font/otf'};
const server=http.createServer(async(req,res)=>{
try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/health')return json(res,200,{ok:true,database:pool?'postgres':'sqlite'});
  if(url.pathname==='/api/login'&&req.method==='POST'){
    const b=await body(req), supplied=Buffer.from(String(b.password||'')),expected=Buffer.from(password);
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return json(res,401,{error:'密碼不正確'});
    const id=randomUUID();sessions.set(id,{expires:Date.now()+86400000});
    return json(res,200,{ok:true},{'Set-Cookie':`reletter_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.NODE_ENV==='production'?'; Secure':''}`});
  }
  const id=req.headers.cookie?.match(/(?:^|;\s*)reletter_session=([^;]+)/)?.[1],session=sessions.get(id);
  if(url.pathname.startsWith('/api/')){
    if(!session||session.expires<Date.now())return json(res,401,{error:'請先輸入密碼'});
    if(url.pathname==='/api/entries'&&req.method==='GET')return json(res,200,await entries());
    if(url.pathname==='/api/entries'&&req.method==='POST'){
      const b=await body(req),p=b.part||{};
      if(typeof b.text!=='string'||b.text.length>4000)return json(res,400,{error:'文字過長'});
      for(const k of ['drawing','image'])if(p[k]&&(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p[k])||p[k].length>2200000))return json(res,400,{error:'圖片格式或大小不符'});
      const vector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<100000)?v:null;
      const e={id:typeof b.id==='string'&&/^[a-f0-9-]{36}$/.test(b.id)?b.id:randomUUID(),text:b.text,created_at:new Date().toISOString(),part:{username:peers.get(id)?.character||session.character||'Ely',drawing:p.drawing||null,image:p.image||null,position:vector(p.position),scale:vector(p.scale)}};
      if(await insert(e))broadcast('plant',{...e,sender:id});return json(res,201,e);
    }
    if(url.pathname.startsWith('/api/entries/')&&req.method==='DELETE'){const entryId=url.pathname.split('/').pop();await remove(entryId);broadcast('deleted',{id:entryId});return json(res,200,{ok:true});}
    if(url.pathname==='/api/events'){
      const character=url.searchParams.get('character');
      if(!['Ely','Rae'].includes(character))return json(res,400,{error:'請選擇角色'});
      if([...peers].some(([other,p])=>other!==id&&p.character===character))return json(res,409,{error:'這個角色正在使用，請選另一位'});
      if(peers.size>=2&&!peers.has(id))return json(res,409,{error:'兩個席位已滿'});
      peers.get(id)?.res.end();session.character=character;
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
      const peer={res,character,state:null};peers.set(id,peer);
      res.write(`event: welcome\ndata: ${JSON.stringify({id,players:roster()})}\n\n`);broadcast('players',roster());
      const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),15000);
      res.on('close',()=>{clearInterval(heartbeat);if(peers.get(id)===peer){peers.delete(id);broadcast('players',roster());}});return;
    }
    if(url.pathname==='/api/state'&&req.method==='POST'){
      const p=peers.get(id),b=await body(req);if(!p)return json(res,409,{error:'尚未連線'});
      if(!Array.isArray(b.position)||b.position.length!==3||!b.position.every(Number.isFinite)||!Number.isFinite(b.rotation))return json(res,400,{error:'無效位置'});
      p.state={position:b.position,rotation:b.rotation,visible:!!b.visible,phase:b.phase};broadcast('state',{id,character:p.character,state:p.state});return json(res,200,{ok:true});
    }
    if(url.pathname==='/api/chat'&&req.method==='POST'){
      const p=peers.get(id),b=await body(req);if(!p)return json(res,409,{error:'尚未連線'});
      if(typeof b.text!=='string'||!b.text.trim()||b.text.length>500)return json(res,400,{error:'訊息需為 1–500 字'});
      if(p.lastChat&&Date.now()-p.lastChat<400)return json(res,429,{error:'請稍等再傳送'});
      p.lastChat=Date.now();broadcast('chat',{id:randomUUID(),name:p.character,text:b.text.trim(),time:Date.now()});return json(res,200,{ok:true});
    }
    return json(res,404,{error:'找不到 API'});
  }
  const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  const relative=path.slice(root.length+1);
  if(!path.startsWith(root+'\\')&&!path.startsWith(root+'/'))return json(res,403,{error:'Forbidden'});
  if(relative.split(/[\\/]/).some(x=>x.startsWith('.'))||/^(server|data|tests|node_modules)([\\/]|$)/.test(relative)||!mime[extname(path).toLowerCase()])return json(res,403,{error:'Forbidden'});
  const content=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path).toLowerCase()]});res.end(content);
}catch(e){if(!res.headersSent)json(res,e.code==='ENOENT'?404:500,{error:'請求失敗'});else res.end();console.error(e.message);}
});
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('RELETTER http://localhost:'+(process.env.PORT||3000)));
