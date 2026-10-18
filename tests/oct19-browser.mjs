import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base='http://127.0.0.1:8788',browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],created=[];let context;
const wave=Buffer.alloc(44+1600);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(8000,24);wave.writeUInt32LE(16000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(1600,40);
try{
 context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await context.addInitScript(()=>window.__reletterTestPause=true);
 const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/chat',route=>route.request().method()==='GET'?route.fulfill({json:Array.from({length:80},(_,i)=>({id:'history-'+i,name:i%2?'Rae':'Ely',text:'Previous chat '+i,time:Date.now()-80000+i*1000}))}):route.continue());
 async function enter(){await page.waitForFunction(()=>typeof render_game_to_text==='function');await page.locator('#password').fill('rae1210');await page.locator('#login-form button').tap();await page.locator('[data-character="Ely"]').tap();await page.waitForSelector('#entry-gate',{state:'detached'});}
 await page.goto(base);await enter();await page.waitForFunction(()=>reletter_test.model());await page.evaluate(()=>reletter_test.render());
 const originalCookie=(await context.cookies()).find(c=>c.name==='reletter_session').value;
 await page.locator('#chat-open').tap();await page.waitForTimeout(150);assert.equal(await page.locator('#chat-history').isVisible(),true);assert.equal(await page.locator('#chat-input').isVisible(),true);
 assert.ok(await page.locator('#chat-log').evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop<3));
 await page.locator('#chat-input').fill('Typing with latest chat visible');await page.locator('#chat-form button[type=submit]').tap();assert.equal(await page.locator('#chat-input').isVisible(),true);await page.waitForFunction(()=>document.querySelector('#chat-input').value==='');
 await page.screenshot({path:'output/verification/oct19-unified-chat.png'});await page.locator('#chat-close').tap();
 for(const [width,height] of [[320,568],[844,390],[390,320],[390,844]]){
  await page.setViewportSize({width,height});await page.locator('#chat-open').tap();await page.waitForTimeout(100);
  const boxes=await page.evaluate(()=>['chat-history','chat-form','joystick-zone','jump-btn','water-gun'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height};}));
  for(const a of boxes){assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=width+1&&a.y+a.h<=height+1,`${width} ${a.id} out of bounds`);for(const b of boxes)if(a!==b)assert.ok(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)<=1||Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)<=1,`${width} ${a.id}/${b.id} overlap`);}
  await page.locator('#chat-close').tap();
 }
 await page.locator('#write-open').tap();await page.locator('#drawing').scrollIntoViewIfNeeded();const box=await page.locator('#drawing').boundingBox();const blank=await page.locator('#drawing').evaluate(c=>c.toDataURL());
 await page.mouse.move(box.x+20,box.y+20);await page.mouse.down();await page.mouse.move(box.x+100,box.y+70,{steps:8});await page.mouse.up();const first=await page.locator('#drawing').evaluate(c=>c.toDataURL());assert.notEqual(first,blank);
 await page.locator('#clear-drawing').tap();assert.equal(await page.locator('#drawing').evaluate(c=>c.toDataURL()),blank);await page.locator('#undo-drawing').tap();assert.equal(await page.locator('#drawing').evaluate(c=>c.toDataURL()),first);await page.locator('#undo-drawing').tap();assert.equal(await page.locator('#drawing').evaluate(c=>c.toDataURL()),blank);
 await page.locator('#upload-av').setInputFiles({name:'voice.wav',mimeType:'audio/wav',buffer:wave});await page.waitForSelector('#av-preview audio');
 const video=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=64;c.height=64;const stream=c.captureStream(10),rec=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];const done=new Promise(r=>rec.onstop=async()=>{const b=await new Blob(chunks,{type:'video/webm'}).arrayBuffer();r(Array.from(new Uint8Array(b)));});rec.ondataavailable=e=>chunks.push(e.data);rec.start();const ctx=c.getContext('2d');for(let i=0;i<6;i++){ctx.fillStyle=i%2?'purple':'pink';ctx.fillRect(0,0,64,64);await new Promise(r=>setTimeout(r,100));}rec.stop();return done;});
 await page.locator('#upload-av').setInputFiles({name:'memory.webm',mimeType:'video/webm',buffer:Buffer.from(video)});await page.waitForSelector('#av-preview video');
 // Use the actual plant form and cinematic, then reload to verify persisted media.
 await page.evaluate(()=>reletter_test.explore());await page.locator('#write-open').tap();await page.locator('#ta').fill('Audio video memory');await page.locator('#go').tap();await page.evaluate(()=>advanceTime(30000));await page.waitForTimeout(500);await page.evaluate(()=>advanceTime(30000));
 await page.waitForFunction(()=>JSON.parse(render_game_to_text()).plants.some(p=>p.text==='Audio video memory'&&p.id&&p.audio&&p.video));let plant=await page.evaluate(()=>JSON.parse(render_game_to_text()).plants.find(p=>p.text==='Audio video memory'));created.push(plant.id);
 await page.reload();await enter();assert.equal((await context.cookies()).find(c=>c.name==='reletter_session').value,originalCookie);await page.waitForFunction(id=>JSON.parse(render_game_to_text()).plants.some(p=>p.id===id&&p.audio&&p.video),plant.id);
 await page.evaluate(id=>reletter_test.showEntry(id),plant.id);await page.waitForFunction(()=>document.querySelector('#plant-label audio')?.readyState>=1&&document.querySelector('#plant-label video')?.readyState>=1);await page.locator('#plant-label audio').evaluate(a=>a.play());
 await page.screenshot({path:'output/verification/oct19-media-tooltip.png'});
 await page.locator('#plant-label button').tap();assert.equal(await page.locator('#reply-draft').isVisible(),true);await page.waitForFunction(()=>reletter_test.model());await page.evaluate(()=>{reletter_test.explore();document.querySelector('#ui').classList.remove('mini');});await page.locator('#ta').fill('A branch reply');await page.locator('#go').tap();await page.evaluate(()=>advanceTime(30000));await page.waitForTimeout(500);await page.evaluate(()=>advanceTime(30000));
 await page.waitForFunction(()=>JSON.parse(render_game_to_text()).plants.some(p=>p.text==='A branch reply'&&p.id));const reply=await page.evaluate(()=>JSON.parse(render_game_to_text()).plants.find(p=>p.text==='A branch reply'));created.push(reply.id);assert.equal(reply.parentId,plant.id);assert.ok(reply.position[1]>plant.position[1]);
 const branch=await page.evaluate(id=>{const e=reletter_test.world().plantEntries.find(p=>p.entryId===id);return {tilt:e.mesh.userData.replyTilt,z:e.mesh.rotation.z};},reply.id);assert.equal(branch.tilt,.65);assert.ok(branch.z>.6);await page.evaluate(id=>reletter_test.framePlant(id),plant.id);await page.screenshot({path:'output/verification/oct19-reply-branch.png'});
 await page.reload();await enter();await page.waitForFunction(id=>JSON.parse(render_game_to_text()).plants.some(p=>p.id===id&&p.parentId),reply.id);
 assert.deepEqual(errors,[]);console.log('PASS mobile unified latest chat, send stays open, 4 sizes no overlaps, undo stroke/clear, audio/video decoding after reload, stem reply and persisted branch, repeated same-seat login');
}finally{if(context){for(const id of created)await context.request.delete(base+'/api/entries/'+id);await context.close();}await browser.close();}
