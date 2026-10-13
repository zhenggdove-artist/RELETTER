import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
test('isolated database, password enforcement, two seats, safe media and shared events',async()=>{
  await mkdir('output',{recursive:true});const file=resolve('output/test.sqlite');await rm(file,{force:true});
  const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3101',DATABASE_URL:'postgres://unrelated.invalid/old_site',RELETTER_DATABASE_URL:'',SQLITE_PATH:file},stdio:['ignore','pipe','pipe']});
  await new Promise((ok,no)=>{child.stdout.on('data',d=>{if(String(d).includes('RELETTER'))ok();});child.once('exit',no);});
  const url='http://127.0.0.1:3101',json={'Content-Type':'application/json'};
  const request=(path,method='GET',body,cookie)=>fetch(url+path,{method,headers:{...json,...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const streams=[];
  try{
    assert.equal((await request('/api/entries')).status,401);
    assert.equal((await request('/api/login','POST',{password:'bad'})).status,401);
    assert.equal((await request('/api/login','POST',{password:'rae1210'})).status,200,'lowercase password must also log in');
    const login=async()=>{const r=await request('/api/login','POST',{password:'RAE1210'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
    const a=await login(),b=await login(),c=await login();
    const ea=await request('/api/events?character=Ely','GET',undefined,a);streams.push(ea.body);assert.equal(ea.status,200);
    assert.equal((await request('/api/events?character=Ely','GET',undefined,b)).status,409);
    const eb=await request('/api/events?character=Rae','GET',undefined,b);streams.push(eb.body);assert.equal(eb.status,200);
    assert.equal((await request('/api/events?character=Rae','GET',undefined,c)).status,409);
    assert.equal((await request('/api/state','POST',{position:[0,1,2],rotation:0,visible:true,phase:0},a)).status,200);
    assert.equal((await request('/api/chat','POST',{text:'Hello Rae'},a)).status,200);
    assert.equal((await request('/api/entries','POST',{text:'x',part:{image:'javascript:alert(1)'}},a)).status,400);
    const image='data:image/png;base64,aGVsbG8=';
    const r=await request('/api/entries','POST',{text:'a shared drawing',part:{drawing:image,image,position:[1,2,3]}},a);assert.equal(r.status,201);const e=await r.json();
    const all=await (await request('/api/entries','GET',undefined,b)).json();assert.equal(all.length,1);assert.equal(all[0].part.username,'Ely');assert.deepEqual(all[0].part.position,[1,2,3]);assert.equal(all[0].part.drawing,image);
    await request('/api/entries','POST',{id:e.id,text:'retry',part:{image}},a);assert.equal((await (await request('/api/entries','GET',undefined,b)).json()).length,1,'retry does not duplicate a plant');
    assert.equal((await request('/data/reletter.sqlite')).status,403);
    assert.equal((await request('/server/index.js')).status,403);
    const reader=eb.body.getReader();let events='';while(!events.includes('a shared drawing')){const {value}=await reader.read();events+=new TextDecoder().decode(value);}assert.ok(events.includes('Hello Rae'));assert.ok(events.includes('event: state'));reader.releaseLock();
    await request('/api/entries/'+e.id,'DELETE',undefined,a);assert.equal((await (await request('/api/entries','GET',undefined,b)).json()).length,0);
  }finally{for(const s of streams)await s.cancel();child.kill();}
});
