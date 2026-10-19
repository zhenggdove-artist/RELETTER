import {DurableObject} from 'cloudflare:workers';
import {mediaKinds,validMedia,battleAction} from '../server/game-rules.js';
import {ensureWorld,resetEncounter,activateEncounter,advanceBoss,worldView} from '../server/world-rules.js';
import {configured,deliverNotification} from './notifications.js';

const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}});
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<100000)?v:null;
async function readBody(request){const text=await request.text();if(text.length>20_000_000)throw new Error('File too large');return JSON.parse(text||'{}');}

export default {
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(path.startsWith('/api/')||path==='/health'){
      const origin=request.headers.get('Origin');
      if(origin&&origin!==new URL(request.url).origin)return json({error:'Origin mismatch'},403);
      return env.RELETTER_GARDEN.getByName('reletter-garden-v1').fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};

export class ReletterGarden extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);ctx.setWebSocketAutoResponse();this.sql=ctx.storage.sql;this.closedSockets=new Set();
    this.sql.exec(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL, character TEXT);
      CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, name TEXT NOT NULL, text TEXT NOT NULL, time INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS notification_outbox (id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, retry_at INTEGER NOT NULL DEFAULT 0, error TEXT);
      CREATE INDEX IF NOT EXISTS entries_by_date ON entries(created_at);
      CREATE TABLE IF NOT EXISTS game_state (id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS media (entry_id TEXT NOT NULL, kind TEXT NOT NULL, chunk INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(entry_id,kind,chunk));`);

  }
  queueNotification(id,event){this.sql.exec('INSERT OR IGNORE INTO notification_outbox(id,payload) VALUES(?,?)',id,JSON.stringify(event));}
  async scheduleNotifications(){
    let next=this.sockets().length?Date.now()+15000:Infinity;const world=this.game();if(!this.sockets().length&&world.offlineSince)next=Math.min(next,world.offlineSince+5000);
    if(configured(this.env)){const row=this.sql.exec("SELECT MIN(retry_at) AS time FROM notification_outbox WHERE status='pending'").toArray()[0];if(row?.time!=null)next=Math.min(next,Math.max(Date.now()+1000,row.time));}
    const alarm=await this.ctx.storage.getAlarm();if(Number.isFinite(next)&&(alarm===null||alarm>next))await this.ctx.storage.setAlarm(next);
  }
  async alarm(){
    this.pruneSockets();this.broadcast('players',this.roster());
    if(!configured(this.env)){await this.scheduleNotifications();return;}
    const rows=this.sql.exec("SELECT * FROM notification_outbox WHERE status='pending' AND retry_at<=? ORDER BY retry_at,id LIMIT ?",Date.now(),this.env.EMAILJS_SERVICE_ID?1:5).toArray();
    for(const row of rows){try{await deliverNotification(this.env,row.id,JSON.parse(row.payload));this.sql.exec("UPDATE notification_outbox SET status='sent',error=NULL WHERE id=?",row.id);}catch(error){const attempts=error.retryAfterMs?row.attempts:row.attempts+1;this.sql.exec('UPDATE notification_outbox SET attempts=?,retry_at=?,status=?,error=? WHERE id=?',attempts,Date.now()+(error.retryAfterMs||Math.min(3600000,30000*2**attempts)),attempts>=8?'failed':'pending',error.message,row.id);}}
    await this.scheduleNotifications();
  }
  pruneSockets(){for(const ws of this.ctx.getWebSockets()){const p=ws.deserializeAttachment();if(ws.readyState!==1||!p||p.expires<Date.now()||Date.now()-(p.lastSeen||0)>35000){this.closedSockets.add(ws);try{ws.close(1000,'Session inactive');}catch{}}}this.resetIfEmpty();}
  sockets(){return this.ctx.getWebSockets().filter(ws=>ws.readyState===1&&!this.closedSockets.has(ws));}
  game(){return JSON.parse(this.sql.exec('SELECT payload FROM game_state WHERE id=1').toArray()[0]?.payload||'{}');}
  saveGame(g){this.sql.exec('INSERT OR REPLACE INTO game_state VALUES(1,?)',JSON.stringify(g));}
  gameView(){return worldView(this.game());}
  resetIfEmpty(){const g=this.game();if(this.sockets().length){if(g.offlineSince){delete g.offlineSince;this.saveGame(g);}return;}if(!g.offlineSince){g.offlineSince=Date.now();this.saveGame(g);this.ctx.waitUntil(this.scheduleNotifications());}else if(Date.now()-g.offlineSince>=5000){resetEncounter(g);delete g.offlineSince;this.saveGame(g);}}
  tickBoss(){if(Date.now()-(this.lastBossTick||0)<100)return;this.lastBossTick=Date.now();const g=this.game();ensureWorld(g);if(g.boss.hp<=0)return;advanceBoss(g,this.roster());this.saveGame(g);this.broadcast('boss',g.boss);}
  roster(){return this.sockets().map(ws=>{const p=ws.deserializeAttachment();return{id:p.id,character:p.character,state:p.state};});}
  broadcast(type,data){const message=JSON.stringify({type,data});for(const ws of this.sockets())try{ws.send(message);}catch{ws.close(1011,'Connection interrupted');}}
  session(request){const id=request.headers.get('Cookie')?.match(/(?:^|;\s*)reletter_session=([^;]+)/)?.[1];if(!id)return null;return this.sql.exec('SELECT * FROM sessions WHERE id=? AND expires>?',id,Date.now()).toArray()[0]||null;}
  async fetch(request){
    try{
      const url=new URL(request.url),path=url.pathname;this.ctx.waitUntil(this.scheduleNotifications());
      if(path==='/health')return json({ok:true,database:'durable-object-sqlite',realtime:'websocket'});
      if(path==='/api/login'&&request.method==='POST'){
        const body=await readBody(request),encode=new TextEncoder();
        const a=new Uint8Array(await crypto.subtle.digest('SHA-256',encode.encode(String(body.password||'').trim().toUpperCase())));
        const b=new Uint8Array(await crypto.subtle.digest('SHA-256',encode.encode((this.env.GAME_PASSWORD||'RAE1210').trim().toUpperCase())));
        let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
        if(difference)return json({error:'Incorrect password'},401);
        const previous=this.session(request);const id=previous?.id||crypto.randomUUID(),expires=Date.now()+86400000;
        this.sql.exec('DELETE FROM sessions WHERE expires<?',Date.now());
        this.sql.exec('INSERT INTO sessions(id,expires) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET expires=excluded.expires',id,expires);
        return json({ok:true},200,{'Set-Cookie':`reletter_session=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${url.protocol==='https:'?'; Secure':''}`});
      }
      const session=this.session(request);if(!session)return json({error:'Please enter the password first'},401);
      if(path==='/api/notifications/status'&&request.method==='GET')return json({configured:configured(this.env),counts:this.sql.exec('SELECT status,COUNT(*) AS count FROM notification_outbox GROUP BY status').toArray()});
      if(path==='/api/players'&&request.method==='GET'){this.pruneSockets();return json(this.roster().map(p=>({...p,self:p.id===session.id})));}
      if(path==='/api/disconnect'&&request.method==='POST'){const body=await readBody(request);for(const ws of this.ctx.getWebSockets(session.id)){if(ws.deserializeAttachment().connectionId!==body.connectionId)continue;this.closedSockets.add(ws);ws.close(1000,'Page hidden');}this.resetIfEmpty();this.broadcast('players',this.roster());return json({ok:true});}
      if(path==='/api/world'&&request.method==='GET')return json(this.gameView());
      if(path==='/api/game'&&request.method==='POST'){
        const body=await readBody(request);this.pruneSockets();const ws=this.sockets().find(w=>w.deserializeAttachment().id===session.id);if(!ws)return json({error:'Not connected'},409);
        const game=this.game();advanceBoss(game,this.roster());const result=battleAction(game,ws.deserializeAttachment(),this.roster(),body);if(result.error)return json({error:result.error},400);game.worldRevision++;
        this.sql.exec('INSERT OR REPLACE INTO game_state VALUES(1,?)',JSON.stringify(game));this.broadcast('game',this.gameView());if(result.shot)this.broadcast('water',result.shot);return json({ok:true,blocked:result.blocked,game:this.gameView()});
      }
      if(path==='/api/socket'){
        this.pruneSockets();
        if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket connection required'},426);
        const character=url.searchParams.get('character');
        if(!['Ely','Rae'].includes(character))return json({error:'Choose a character'},400);
        const other=this.roster().filter(p=>p.id!==session.id);
        if(other.some(p=>p.character===character))return json({error:'This character is in use. Choose the other character.'},409);
        if(other.length>=2)return json({error:'Both seats are occupied'},409);
        for(const ws of this.ctx.getWebSockets(session.id)){this.closedSockets.add(ws);ws.close(1000,'Joined from another tab');}
        const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server,[session.id]);
        server.serializeAttachment({id:session.id,character,state:null,expires:session.expires,lastChat:0,lastSeen:Date.now(),connectionId:url.searchParams.get('connectionId')||crypto.randomUUID()});
        this.sql.exec('UPDATE sessions SET character=? WHERE id=?',character,session.id);this.resetIfEmpty();
        server.send(JSON.stringify({type:'welcome',data:{id:session.id,players:this.roster()}}));this.broadcast('players',this.roster());server.send(JSON.stringify({type:'game',data:this.gameView()}));
        this.queueNotification('online-'+session.id,{kind:'online',name:character,time:Date.now()});this.ctx.waitUntil(this.scheduleNotifications());
        return new Response(null,{status:101,webSocket:client});
      }
      if(path==='/api/entries'&&request.method==='GET')return json(this.sql.exec('SELECT payload FROM entries ORDER BY created_at,id').toArray().map(row=>JSON.parse(row.payload)));
      if(path==='/api/entries'&&request.method==='POST'){
        const body=await readBody(request),part=body.part||{};
        if(typeof body.text!=='string'||!body.text||body.text.length>4000)return json({error:'Message must contain 1–4000 characters'},400);
        for(const kind of mediaKinds)if(!validMedia(kind,part[kind]))return json({error:'Unsupported media format or size'},400);
        if(part.parentId&&!this.sql.exec('SELECT id FROM entries WHERE id=?',part.parentId).toArray().length)return json({error:'The original plant no longer exists'},400);
        const id=typeof body.id==='string'&&/^[a-f0-9-]{36}$/.test(body.id)?body.id:crypto.randomUUID();
        const existing=this.sql.exec('SELECT payload FROM entries WHERE id=?',id).toArray()[0];if(existing)return json(JSON.parse(existing.payload),200);
        const entry={id,text:body.text,created_at:new Date().toISOString(),part:{username:session.character||'Ely',position:vector(part.position),scale:vector(part.scale),drawing:part.drawing?`/api/media/${id}/drawing`:null,image:part.image?`/api/media/${id}/image`:null,audio:part.audio?`/api/media/${id}/audio`:null,video:part.video?`/api/media/${id}/video`:null,parentId:part.parentId||null,rotation:Number.isFinite(part.rotation)?part.rotation:0}};
        this.ctx.storage.transactionSync(()=>{
          this.sql.exec('INSERT INTO entries VALUES(?,?,?)',id,entry.created_at,JSON.stringify(entry));
          this.queueNotification('plant-'+id,{kind:'plant',name:entry.part.username,text:entry.text,time:Date.parse(entry.created_at)});
          for(const kind of mediaKinds)if(part[kind])for(let offset=0;offset<part[kind].length;offset+=65536)this.sql.exec('INSERT INTO media VALUES(?,?,?,?)',id,kind,offset/65536,part[kind].slice(offset,offset+65536));
        });
        this.ctx.waitUntil(this.scheduleNotifications());this.broadcast('plant',{...entry,sender:session.id});return json(entry,201);
      }
      const media=path.match(/^\/api\/media\/([a-f0-9-]{36})\/(drawing|image|audio|video)$/);
      if(media&&request.method==='GET'){
        const chunks=this.sql.exec('SELECT data FROM media WHERE entry_id=? AND kind=? ORDER BY chunk',media[1],media[2]).toArray();
        if(!chunks.length)return json({error:'Image not found'},404);
        const data=chunks.map(c=>c.data).join(''),separator=data.indexOf(','),mime=data.slice(5,data.indexOf(';'));
        const binary=atob(data.slice(separator+1)),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
        const headers={'Content-Type':mime,'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
        const range=request.headers.get('Range');if(range){const m=range.match(/^bytes=(\d*)-(\d*)$/);if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${bytes.length}`}});const start=m[1]?Number(m[1]):Math.max(0,bytes.length-Number(m[2])),end=m[1]?(m[2]?Math.min(Number(m[2]),bytes.length-1):bytes.length-1):bytes.length-1;if(start>end||start>=bytes.length)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${bytes.length}`}});return new Response(bytes.slice(start,end+1),{status:206,headers:{...headers,'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':String(end-start+1)}});}
        return new Response(bytes,{headers:{...headers,'Content-Length':String(bytes.length)}});
      }
      const deletion=path.match(/^\/api\/entries\/([a-f0-9-]{36})$/);
      if(deletion&&request.method==='DELETE'){
        this.ctx.storage.transactionSync(()=>{this.sql.exec('DELETE FROM media WHERE entry_id=?',deletion[1]);this.sql.exec('DELETE FROM entries WHERE id=?',deletion[1]);});
        this.broadcast('deleted',{id:deletion[1]});return json({ok:true});
      }
      if(path==='/api/chat'&&request.method==='GET')return json(this.sql.exec('SELECT * FROM chat_messages ORDER BY time,id').toArray());
      if(path==='/api/chat'&&request.method==='POST'){
        const ws=this.ctx.getWebSockets(session.id).find(ws=>ws.readyState===1);if(!ws)return json({error:'Not connected'},409);
        const body=await readBody(request),p=ws.deserializeAttachment();
        if(typeof body.text!=='string'||!body.text.trim()||body.text.length>500)return json({error:'Message must contain 1–500 characters'},400);
        if(Date.now()-p.lastChat<400)return json({error:'Please wait before sending again'},429);
        const chat={id:crypto.randomUUID(),name:p.character,text:body.text.trim(),time:Date.now()};this.ctx.storage.transactionSync(()=>{this.sql.exec('INSERT INTO chat_messages VALUES(?,?,?,?)',chat.id,chat.name,chat.text,chat.time);this.queueNotification('chat-'+chat.id,{kind:'chat',name:chat.name,text:chat.text,time:chat.time});});this.ctx.waitUntil(this.scheduleNotifications());p.lastChat=chat.time;ws.serializeAttachment(p);this.broadcast('chat',chat);const g=this.game();if(activateEncounter(g,chat.text)){this.saveGame(g);this.broadcast('game',worldView(g));}return json({ok:true});
      }
      return json({error:'API not found'},404);
    }catch(error){console.error('RELETTER request failed',error.message);return json({error:'Server request failed. Please try again later.'},500);}
  }
  webSocketMessage(ws,message){
    const player=ws.deserializeAttachment();
    if(this.closedSockets.has(ws))return;player.lastSeen=Date.now();ws.serializeAttachment(player);if(message==='ping'){this.pruneSockets();this.tickBoss();ws.send('pong');return;}
    if(player.expires<Date.now()){ws.close(1008,'Please sign in again');return;}
    if(typeof message!=='string'||message.length>2000)return;
    try{
      const body=JSON.parse(message);if(body.type!=='state')return;
      const data=body.data;if(!vector(data?.position)||!Number.isFinite(data.rotation))return;
      player.state={position:data.position,rotation:data.rotation,visible:!!data.visible,phase:data.phase,paused:!!data.paused};ws.serializeAttachment(player);
      this.broadcast('state',{id:player.id,character:player.character,state:player.state});this.tickBoss();
    }catch{}
  }
  webSocketClose(ws){this.closedSockets.add(ws);ws.close(1000,'Disconnected');this.resetIfEmpty();this.broadcast('players',this.roster());}
  webSocketError(ws){this.closedSockets.add(ws);ws.close(1011,'Connection interrupted');this.resetIfEmpty();this.broadcast('players',this.roster());}
}
