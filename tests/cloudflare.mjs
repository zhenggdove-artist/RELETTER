import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
const origin=process.env.RELETTER_TEST_URL||'http://127.0.0.1:8787';
const headers={'Content-Type':'application/json'};
const request=(path,method='GET',data,cookie)=>fetch(origin+path,{method,headers:{...headers,...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
async function login(password){const r=await request('/api/login','POST',{password});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
function socket(cookie,character){return new Promise((resolve,reject)=>{
  const ws=new WebSocket(origin.replace(/^http/,'ws')+'/api/socket?character='+character,{headers:{Cookie:cookie,Origin:origin}}),events=[];
  ws.on('message',message=>{if(String(message)==='pong'){events.push({type:'pong'});return;}const e=JSON.parse(String(message));events.push(e);if(e.type==='welcome')resolve({ws,events});});
  ws.on('error',reject);
});}
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}throw new Error('Event not received');}
const a=await login('rae1210'),b=await login('RAE1210'),c=await login('rae1210');
assert.equal((await request('/api/entries')).status,401);
assert.equal((await request('/api/login','POST',{password:'incorrect'})).status,401);
const baselineNotices=await(await request('/api/notifications/status','GET',undefined,a)).json();const initialPending=baselineNotices.counts.find(r=>r.status==='pending')?.count||0;
const ely=await socket(a,'Ely'),rae=await socket(b,'Rae');let entry;
try{
  await assert.rejects(socket(c,'Rae'),/409/);
  ely.ws.send(JSON.stringify({type:'state',data:{position:[2,3,4],rotation:1,visible:true,phase:2}}));
  await until(()=>rae.events.some(e=>e.type==='state'&&e.data.state.position[0]===2));
  ely.ws.send('ping');await until(()=>ely.events.some(e=>e.type==='pong'));
  assert.equal((await request('/api/chat','POST',{text:'Cloudflare regression'},a)).status,200);
  await until(()=>rae.events.some(e=>e.type==='chat'&&e.data.text==='Cloudflare regression'));
  assert.equal((await request('/api/entries','POST',{text:'invalid image',part:{image:'javascript:bad'}},a)).status,400);
  const bytes=Buffer.alloc(140000,123),media='data:image/png;base64,'+bytes.toString('base64');
  const id=crypto.randomUUID();
  const response=await request('/api/entries','POST',{id,text:'Cloudflare fixture '+id,part:{drawing:media,image:media,position:[2,0,4]}},a);
  assert.equal(response.status,201);entry=await response.json();assert.equal(entry.part.username,'Ely');
  await until(()=>rae.events.some(e=>e.type==='plant'&&e.data.id===id));
  const picture=await request(entry.part.drawing,'GET',undefined,b);assert.equal(picture.status,200);assert.deepEqual(Buffer.from(await picture.arrayBuffer()),bytes,'all media chunks reconstruct exactly');
  assert.equal((await request(entry.part.image)).status,401,'media remains authenticated');
  await request('/api/entries','POST',{id,text:'retry',part:{}},a);
  const list=await (await request('/api/entries','GET',undefined,b)).json();assert.equal(list.filter(e=>e.id===id).length,1,'retry is idempotent');
  ely.ws.close();await until(()=>rae.events.some(e=>e.type==='players'&&e.data.length===1));
  const replacement=await socket(c,'Ely');replacement.ws.close();
  const notices=await(await request('/api/notifications/status','GET',undefined,a)).json();assert.equal(notices.configured,false);assert.equal(notices.counts.find(r=>r.status==='pending').count,initialPending+5,'Three distinct sessions, one chat and one idempotent plant');
  console.log('PASS Cloudflare: password, two seats, WebSocket state/chat/ping, authenticated chunked media, idempotency, released seat');
}finally{
  if(entry)await request('/api/entries/'+entry.id,'DELETE',undefined,a);
  ely.ws.close();rae.ws.close();
}
