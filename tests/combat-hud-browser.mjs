import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errors=[],shots=[],states=[];
await fs.mkdir('output/combat-hud',{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await p.addInitScript(()=>window.__reletterTestPause=true);p.on('pageerror',e=>errors.push(e.message));
 p.on('websocket',ws=>ws.on('framesent',f=>{try{const m=JSON.parse(f.payload);if(m.type==='state')states.push(m.data);}catch{}}));
 await p.goto('http://127.0.0.1:8788');await p.locator('#password').fill('rae1210');await p.locator('#login-form button').click();await p.locator('[data-character="Ely"]').click();await p.locator('#entry-gate').waitFor({state:'detached'});await p.waitForFunction(()=>reletter_test.model());
 await p.route('**/api/game',async route=>{const data=route.request().postDataJSON();if(data?.action==='shoot'){shots.push({...data,time:Date.now()});await new Promise(r=>setTimeout(r,80));await route.fulfill({json:{}});}else await route.continue();});
 await p.evaluate(()=>{const t=reletter_test;t.explore([380,0,300]);t.step(32);t.model().rotation.set(0,2.5,0);t.receiveSnapshot('game',{worldRevision:100000,equipmentRevision:100000,equipment:{Ely:{weapon:'saber-5'}}});t.step(16);t.receiveSnapshot('water',{shooter:'Ely',weapon:'saber-5',family:'saber',origin:[380,1,300],direction:[Math.sin(2.5),0,Math.cos(2.5)],range:11.52,radius:8.58,charge:0,combo:5,color:'#ff78d9'});t.step(150);});
 const visual=await p.evaluate(()=>new reletter_test.THREE.Vector3(0,0,1).applyQuaternion(reletter_test.model().quaternion).toArray());assert.ok(visual[0]*Math.sin(2.5)+visual[2]*Math.cos(2.5)<0,'fixture must reproduce backward visual spin');
 await p.waitForTimeout(120);await p.locator('#water-gun').dispatchEvent('click',{detail:0});await p.waitForTimeout(100);
 assert.ok(shots[0].direction[0]*Math.sin(2.5)+shots[0].direction[2]*Math.cos(2.5)>.999,'attack must ignore cosmetic spin');
 assert.ok(Math.abs(states.at(-1).rotation-2.5)<.001,'network heading must ignore spin');
 for(let i=0;i<8;i++){await p.locator('#water-gun').dispatchEvent('pointerdown',{button:0,pointerId:1});await p.locator('#water-gun').dispatchEvent('pointerup',{button:0,pointerId:1});await p.waitForTimeout(60);}
 await p.waitForTimeout(500);assert.ok(shots.length>=3&&shots.length<=4,'bounded buffer chains instead of dropping rapid taps');
 assert.ok(shots.slice(1).every((s,i)=>s.time-shots[i].time>=250&&s.time-shots[i].time<400),'cadence excludes extra network latency: '+JSON.stringify(shots.slice(1).map((s,i)=>s.time-shots[i].time)));
 await p.evaluate(()=>reletter_test.step(1500));await p.keyboard.down('ArrowUp');await p.evaluate(()=>reletter_test.step(300));await p.keyboard.up('ArrowUp');
 const rotation=await p.evaluate(()=>reletter_test.model().rotation.toArray());assert.ok(Math.abs(rotation[0])<.001&&Math.abs(rotation[2])<.001,'movement resets Euler flip');
 await p.locator('#fishing-open').tap();assert.equal(await p.locator('#fishing-panel').isVisible(),false);
 await p.evaluate(()=>{const t=reletter_test;t.explore([0,0,6]);t.receiveSnapshot('game',{worldRevision:200000,fishing:{revision:200000,holes:[{id:'hud-hole',position:[0,0,10],radius:1.5,depth:3}],ponds:[],bags:{},sessions:{Ely:{id:'hud-cast',hole:'hud-hole',stage:'fight',tension:.55,progress:45}}}});t.step(3000);});
 for(const [width,height] of [[390,844],[320,568],[844,390],[390,320],[1280,800]]){
  await p.setViewportSize({width,height});await p.evaluate(()=>{reletter_test.step(16);reletter_test.render();});
  const boxes=await p.evaluate(()=>['fishing-tools','world-fishing-action','fishing-meters','joystick-zone','jump-btn','boss-health','player-progression'].map(id=>document.getElementById(id)).filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&getComputedStyle(e).display!=='none';}).map(e=>{const r=e.getBoundingClientRect();return {id:e.id,x:r.x,y:r.y,w:r.width,h:r.height};}));
  for(const a of boxes){assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=width+1&&a.y+a.h<=height+1,JSON.stringify(a));for(const b of boxes)if(a!==b)assert.ok(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)<=1||Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)<=1,`${width}x${height} ${a.id} overlaps ${b.id}`);}
  await p.screenshot({path:`output/combat-hud/fishing-${width}-${height}.png`});
 }
 await p.locator('#fish-back').click();
 await p.evaluate(()=>{const t=reletter_test,w=t.world(),T=t.THREE,mesh=new T.Group(),cube=new T.Mesh(new T.BoxGeometry(1,2,1),new T.MeshBasicMaterial({color:'green'}));cube.position.y=1;mesh.add(cube);w.plantRoot.add(mesh);w.plantEntries.push({mesh,entryId:'reach-test',text:'Nearby plant only',username:'Ely',ts:new Date().toISOString()});t.explore([20,0,0]);w.camera.position.set(0,2,8);w.camera.lookAt(0,1,0);t.renderer.render(w.plantRoot.parent,w.camera);});
 await p.mouse.move(640,400);await p.mouse.click(640,400);assert.equal(await p.locator('#plant-label').isVisible(),false,'far plant click is ignored');
 await p.evaluate(()=>{reletter_test.world().charRoot.position.set(1,0,0);});await p.waitForTimeout(60);await p.mouse.move(641,400);await p.mouse.click(641,400);assert.equal(await p.locator('#plant-label').isVisible(),true,'near plant opens');
 await p.evaluate(()=>{reletter_test.explore([20,0,0]);reletter_test.step(16);});assert.equal(await p.locator('#plant-label').isVisible(),false,'walking away closes scene label');
 await p.locator('#search-btn').click();await p.locator('.history-preview').filter({hasText:'Nearby plant only'}).click();assert.equal(await p.locator('#plant-label').isVisible(),true,'history bypasses distance');await p.evaluate(()=>reletter_test.step(16));assert.equal(await p.locator('#plant-label').isVisible(),true);
 assert.deepEqual(errors,[]);console.log('PASS spin-safe attack/network aim, upright movement, bounded rapid inputs 5 fishing HUD layouts, nearby-only scene plant labels and unrestricted history');
}finally{await browser.close();}
