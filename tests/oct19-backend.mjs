import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {battleAction} from '../server/game-rules.js';
const origin=process.env.RELETTER_TEST_URL||'http://127.0.0.1:8788';
const request=(path,method='GET',body,cookie)=>fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
async function login(cookie){const r=await request('/api/login','POST',{password:'rae1210'},cookie);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
async function join(cookie,character){return new Promise((resolve,reject)=>{const ws=new WebSocket(origin.replace('http','ws')+'/api/socket?character='+character+'&connectionId='+encodeURIComponent(character+'-'+cookie.slice(-6)),{headers:{Cookie:cookie,Origin:origin}});ws.on('error',reject);ws.on('message',m=>{if(String(m)==='pong')return;const e=JSON.parse(m);if(e.type==='welcome')resolve(ws);});});}
const a=await login(),b=await login();let wa,wb;const created=[];
try{
 wa=await join(a,'Ely');assert.equal(await login(a),a,'re-entering password reuses the active session');
 const replacement=await join(a,'Ely');wa.close();wa=replacement;wb=await join(b,'Rae');await request('/api/disconnect','POST',{connectionId:'old-page-delayed-request'},a);assert.equal((await(await request('/api/players','GET',undefined,a)).json()).length,2,'delayed disconnect from an old page must not close replacement sockets');
 wa.send(JSON.stringify({type:'state',data:{position:[0,0,0],rotation:0,visible:true,phase:5}}));wb.send(JSON.stringify({type:'state',data:{position:[0,0,-4],rotation:0,visible:true,phase:5}}));
 const keepAlive=setInterval(()=>{if(wa?.readyState===1)wa.send('ping');if(wb?.readyState===1)wb.send('ping');},5000);
 try{
  const audio='data:audio/wav;base64,'+Buffer.from('RIFFtestWAVE').toString('base64'),video='data:video/webm;base64,'+Buffer.from('test-video').toString('base64');
  const parent=await(await request('/api/entries','POST',{text:'Parent',part:{audio,video,position:[2,0,2]}},a)).json();created.push(parent.id);assert.ok(parent.part.audio&&parent.part.video);
  const child=await(await request('/api/entries','POST',{text:'Reply',part:{parentId:parent.id,position:[2,1,2],rotation:.65}},b)).json();created.push(child.id);assert.equal(child.part.parentId,parent.id);assert.equal(child.part.rotation,.65);
  const range=await fetch(origin+parent.part.video,{headers:{Cookie:a,Range:'bytes=1-4'}});assert.equal(range.status,206);assert.equal(await range.text(),'est-');assert.equal((await request(parent.part.audio)).status,401);
  assert.equal((await request('/api/entries','POST',{text:'bad',part:{audio:'data:text/html;base64,PHNjcmlwdD4='}},a)).status,400);
  assert.equal((await request('/api/entries','POST',{text:'bad reply',part:{parentId:crypto.randomUUID()}},a)).status,400);
  const players=await(await request('/api/players','GET',undefined,a)).json();assert.equal(players.length,2);assert.equal(players.filter(p=>p.self).length,1);
  let lastGame;for(let i=0;i<3;i++){const r=await request('/api/game','POST',{action:'shoot',direction:[0,0,-1]},a);assert.equal(r.status,200);lastGame=(await r.json()).game;await new Promise(r=>setTimeout(r,700));}const dropped=lastGame.loot.filter(c=>c.owner==='Rae').sort((a,b)=>b.time-a.time)[0];assert.ok(dropped);wa.send(JSON.stringify({type:'state',data:{position:[0,0,-4],rotation:0,visible:true,phase:5}}));await new Promise(r=>setTimeout(r,2200));const pickups=await Promise.all([a,b].map(cookie=>request('/api/game','POST',{action:'collect',id:dropped.id},cookie)));assert.deepEqual(pickups.map(r=>r.status).sort(),[200,400],'simultaneous pickup has exactly one winner');
  assert.equal((await request('/api/game','POST',{action:'collect',id:'missing'},a)).status,400);
  // A socket that remains OPEN but stops heartbeating must cease reserving a seat.
  const stale=wb;wb=null;await new Promise(r=>setTimeout(r,36500));const c=await login();const recovered=await join(c,'Rae');recovered.close();stale.close();console.log('PASS cloud: reused session, replaced connection, stale seat expiry, audio/video, range, reply persistence, water shots');
 }finally{clearInterval(keepAlive);}
}finally{wa?.close();wb?.close();for(const id of created)if(id)await request('/api/entries/'+id,'DELETE',undefined,a);}
const actor={id:'a',character:'Ely',state:{position:[0,0,0],visible:true}},target={id:'b',character:'Rae',state:{position:[0,0,-4],visible:true}};
for(const amount of [0,7]){const game={wallets:{Rae:amount}};for(let i=0;i<3;i++)assert.equal(battleAction(game,actor,[actor,target],{action:'shoot',direction:[0,0,-1]},100000+i*700).shot.hit,'Rae');assert.equal(game.wallets.Rae,0);assert.equal(game.loot[0].amount,Math.max(1,amount));const id=game.loot[0].id;actor.state.position=[0,0,-4];assert.equal(battleAction(game,actor,[actor,target],{action:'collect',id},103000).error,undefined);assert.equal(game.wallets.Ely,Math.max(1,amount));assert.ok(battleAction(game,target,[actor,target],{action:'collect',id},103001).error);actor.state.position=[0,0,0];}
console.log('PASS three hits: zero balance spawns one coin, carried balance drops entirely, one winner per pickup');
