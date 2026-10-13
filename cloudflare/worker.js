import {DurableObject} from 'cloudflare:workers';

const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}});
const imagePattern=/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<100000)?v:null;
async function readBody(request){const text=await request.text();if(text.length>5_000_000)throw new Error('File too large');return JSON.parse(text||'{}');}

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
    super(ctx,env);this.sql=ctx.storage.sql;this.closedSockets=new Set();
    this.sql.exec(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL, character TEXT);
      CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS entries_by_date ON entries(created_at);
      CREATE TABLE IF NOT EXISTS media (entry_id TEXT NOT NULL, kind TEXT NOT NULL, chunk INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(entry_id,kind,chunk));`);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
  }
  sockets(){return this.ctx.getWebSockets().filter(ws=>ws.readyState===1&&!this.closedSockets.has(ws));}
  roster(){return this.sockets().map(ws=>{const p=ws.deserializeAttachment();return{id:p.id,character:p.character,state:p.state};});}
  broadcast(type,data){const message=JSON.stringify({type,data});for(const ws of this.sockets())try{ws.send(message);}catch{ws.close(1011,'Connection interrupted');}}
  session(request){const id=request.headers.get('Cookie')?.match(/(?:^|;\s*)reletter_session=([^;]+)/)?.[1];if(!id)return null;return this.sql.exec('SELECT * FROM sessions WHERE id=? AND expires>?',id,Date.now()).toArray()[0]||null;}
  async fetch(request){
    try{
      const url=new URL(request.url),path=url.pathname;
      if(path==='/health')return json({ok:true,database:'durable-object-sqlite',realtime:'websocket'});
      if(path==='/api/login'&&request.method==='POST'){
        const body=await readBody(request),encode=new TextEncoder();
        const a=new Uint8Array(await crypto.subtle.digest('SHA-256',encode.encode(String(body.password||'').trim().toUpperCase())));
        const b=new Uint8Array(await crypto.subtle.digest('SHA-256',encode.encode((this.env.GAME_PASSWORD||'RAE1210').trim().toUpperCase())));
        let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
        if(difference)return json({error:'Incorrect password'},401);
        const id=crypto.randomUUID(),expires=Date.now()+86400000;
        this.sql.exec('DELETE FROM sessions WHERE expires<?',Date.now());
        this.sql.exec('INSERT INTO sessions(id,expires) VALUES(?,?)',id,expires);
        return json({ok:true},200,{'Set-Cookie':`reletter_session=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${url.protocol==='https:'?'; Secure':''}`});
      }
      const session=this.session(request);if(!session)return json({error:'Please enter the password first'},401);
      if(path==='/api/socket'){
        if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket connection required'},426);
        const character=url.searchParams.get('character');
        if(!['Ely','Rae'].includes(character))return json({error:'Choose a character'},400);
        const other=this.roster().filter(p=>p.id!==session.id);
        if(other.some(p=>p.character===character))return json({error:'This character is in use. Choose the other character.'},409);
        if(other.length>=2)return json({error:'Both seats are occupied'},409);
        for(const ws of this.ctx.getWebSockets(session.id)){this.closedSockets.add(ws);ws.close(1000,'Joined from another tab');}
        const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server,[session.id]);
        server.serializeAttachment({id:session.id,character,state:null,expires:session.expires,lastChat:0});
        this.sql.exec('UPDATE sessions SET character=? WHERE id=?',character,session.id);
        server.send(JSON.stringify({type:'welcome',data:{id:session.id,players:this.roster()}}));this.broadcast('players',this.roster());
        return new Response(null,{status:101,webSocket:client});
      }
      if(path==='/api/entries'&&request.method==='GET')return json(this.sql.exec('SELECT payload FROM entries ORDER BY created_at,id').toArray().map(row=>JSON.parse(row.payload)));
      if(path==='/api/entries'&&request.method==='POST'){
        const body=await readBody(request),part=body.part||{};
        if(typeof body.text!=='string'||!body.text||body.text.length>4000)return json({error:'Message must contain 1–4000 characters'},400);
        for(const kind of ['drawing','image'])if(part[kind]&&(typeof part[kind]!=='string'||part[kind].length>2200000||!imagePattern.test(part[kind])))return json({error:'Unsupported image format or size'},400);
        const id=typeof body.id==='string'&&/^[a-f0-9-]{36}$/.test(body.id)?body.id:crypto.randomUUID();
        const existing=this.sql.exec('SELECT payload FROM entries WHERE id=?',id).toArray()[0];if(existing)return json(JSON.parse(existing.payload),200);
        const entry={id,text:body.text,created_at:new Date().toISOString(),part:{username:session.character||'Ely',position:vector(part.position),scale:vector(part.scale),drawing:part.drawing?`/api/media/${id}/drawing`:null,image:part.image?`/api/media/${id}/image`:null}};
        this.ctx.storage.transactionSync(()=>{
          this.sql.exec('INSERT INTO entries VALUES(?,?,?)',id,entry.created_at,JSON.stringify(entry));
          for(const kind of ['drawing','image'])if(part[kind])for(let offset=0;offset<part[kind].length;offset+=65536)this.sql.exec('INSERT INTO media VALUES(?,?,?,?)',id,kind,offset/65536,part[kind].slice(offset,offset+65536));
        });
        this.broadcast('plant',{...entry,sender:session.id});return json(entry,201);
      }
      const media=path.match(/^\/api\/media\/([a-f0-9-]{36})\/(drawing|image)$/);
      if(media&&request.method==='GET'){
        const chunks=this.sql.exec('SELECT data FROM media WHERE entry_id=? AND kind=? ORDER BY chunk',media[1],media[2]).toArray();
        if(!chunks.length)return json({error:'Image not found'},404);
        const data=chunks.map(c=>c.data).join(''),separator=data.indexOf(','),mime=data.slice(5,data.indexOf(';'));
        const binary=atob(data.slice(separator+1)),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
        return new Response(bytes,{headers:{'Content-Type':mime,'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}});
      }
      const deletion=path.match(/^\/api\/entries\/([a-f0-9-]{36})$/);
      if(deletion&&request.method==='DELETE'){
        this.ctx.storage.transactionSync(()=>{this.sql.exec('DELETE FROM media WHERE entry_id=?',deletion[1]);this.sql.exec('DELETE FROM entries WHERE id=?',deletion[1]);});
        this.broadcast('deleted',{id:deletion[1]});return json({ok:true});
      }
      if(path==='/api/chat'&&request.method==='POST'){
        const ws=this.ctx.getWebSockets(session.id).find(ws=>ws.readyState===1);if(!ws)return json({error:'Not connected'},409);
        const body=await readBody(request),p=ws.deserializeAttachment();
        if(typeof body.text!=='string'||!body.text.trim()||body.text.length>500)return json({error:'Message must contain 1–500 characters'},400);
        if(Date.now()-p.lastChat<400)return json({error:'Please wait before sending again'},429);
        p.lastChat=Date.now();ws.serializeAttachment(p);this.broadcast('chat',{id:crypto.randomUUID(),name:p.character,text:body.text.trim(),time:Date.now()});return json({ok:true});
      }
      return json({error:'API not found'},404);
    }catch(error){console.error('RELETTER request failed',error.message);return json({error:'Server request failed. Please try again later.'},500);}
  }
  webSocketMessage(ws,message){
    const player=ws.deserializeAttachment();
    if(player.expires<Date.now()){ws.close(1008,'Please sign in again');return;}
    if(typeof message!=='string'||message.length>2000)return;
    try{
      const body=JSON.parse(message);if(body.type!=='state')return;
      const data=body.data;if(!vector(data?.position)||!Number.isFinite(data.rotation))return;
      player.state={position:data.position,rotation:data.rotation,visible:!!data.visible,phase:data.phase};ws.serializeAttachment(player);
      this.broadcast('state',{id:player.id,character:player.character,state:player.state});
    }catch{}
  }
  webSocketClose(ws){this.closedSockets.add(ws);ws.close(1000,'Disconnected');this.broadcast('players',this.roster());}
  webSocketError(ws){this.closedSockets.add(ws);ws.close(1011,'Connection interrupted');this.broadcast('players',this.roster());}
}
