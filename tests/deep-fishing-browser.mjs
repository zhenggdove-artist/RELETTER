import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const base='http://127.0.0.1:8788',browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),contexts=[],errors=[];
await fs.mkdir('output/deep-fishing',{recursive:true});
async function enter(name,mobile=false){const c=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});contexts.push(c);await c.addInitScript(()=>window.__reletterTestPause=true);const p=await c.newPage();p.setDefaultTimeout(45000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/.test(m.text()))errors.push(m.text());});await p.goto(base);await p.waitForFunction(()=>window.reletter_test);await p.locator('#password').fill('rae1210');await p.locator('#login-form button').click();await p.locator(`[data-character="${name}"]`).click();await p.locator('#entry-gate').waitFor({state:'detached'});await p.waitForFunction(()=>reletter_test.model());return p;}
const state=p=>p.evaluate(()=>JSON.parse(render_game_to_text()));
async function post(p,data,path='/api/game'){const r=await p.request.post(base+path,{data});assert.equal(r.status(),200,await r.text());return r.json();}
async function frame(p,file){await p.evaluate(()=>{const t=reletter_test,w=t.world(),v=w.charRoot.position;w.camera.position.set(v.x+3,v.y+2.5,v.z+6);w.camera.lookAt(v.x,v.y+1,v.z+1);t.renderer.render(w.plantRoot.parent,w.camera);});await p.screenshot({path:`output/deep-fishing/${file}.png`});}
function poseSample(name='Ely'){const t=reletter_test,w=t.world(),p=name===JSON.parse(render_game_to_text()).character?t.model():t.remotes().find(r=>r.character===name)?.model,g=w.fishingRods.get(name);if(!p||!g)return null;let hand,arm;p.traverse(b=>{if(b.name.endsWith('RightHand'))hand=b;if(b.name.endsWith('RightArm'))arm=b;});return {rod:g.quaternion.toArray(),arm:arm.quaternion.toArray(),body:p.position.y,grip:hand.getWorldPosition(new t.THREE.Vector3()).distanceTo(g.position),stage:w.fishPoseStates.get(name).stage};}
try{
 const a=await enter('Ely'),b=await enter('Rae',true);await a.waitForFunction(()=>reletter_test.remotes().length===1);
 for(let i=0;i<10;i++){await a.waitForTimeout(430);await post(a,{text:'/show me the money'},'/api/chat');}
 for(const item of ['chisel-5','rod-20']){if(!(await state(a)).equipment.owned.includes(item))await post(a,{action:'buy',item});await post(a,{action:'equip',item});}
 const holes=(await state(a)).fishing.holes,x=Array.from({length:30},(_,i)=>-120-i*8).find(x=>holes.every(h=>Math.hypot(h.position[0]-x,h.position[2]+100)>5));
 for(const p of [a,b])await p.evaluate(x=>{reletter_test.explore([x,0,-100]);reletter_test.step(16);},x);await a.waitForTimeout(300);
 await post(a,{action:'dig',position:[x,0,-96]});const hole=(await state(a)).fishing.holes.at(-1);assert.equal(hole.depth,28);
 await b.waitForFunction(id=>JSON.parse(render_game_to_text()).fishing.holes.some(h=>h.id===id&&h.depth===28),hole.id);
 await a.locator('#fishing-open').click();await a.locator('#hole-select').selectOption(hole.id);await a.locator('#cast-line').click();
 await a.waitForFunction(()=>JSON.parse(render_game_to_text()).fishing.sessions.Ely?.stage==='waiting');let s=(await state(a)).fishing.sessions.Ely;
 await a.evaluate(()=>reletter_test.step(100));await b.evaluate(()=>reletter_test.step(100));const waitPose=await a.evaluate(poseSample);assert.ok(waitPose.grip<.001);await frame(a,'waiting');
 await a.waitForTimeout(Math.max(1,s.biteAt-Date.now()+50));await a.evaluate(()=>reletter_test.step(110));const bitePose=await a.evaluate(poseSample);await a.locator('#hook-fish').click();
 await a.waitForFunction(()=>JSON.parse(render_game_to_text()).fishing.sessions.Ely.stage==='fight');console.log('Waiting/bite hand anchor pass; starting timed fight');
 let held=false;for(let i=0;i<360;i++){s=(await state(a)).fishing.sessions.Ely;if(s.stage!=='fight')break;const hold=s.tension<.65;if(hold!==held){if(hold){await a.locator('#reel-fish').scrollIntoViewIfNeeded();const r=await a.locator('#reel-fish').boundingBox();await a.mouse.move(r.x+r.width/2,r.y+r.height/2);await a.mouse.down();}else await a.mouse.up();held=hold;}await a.evaluate(()=>reletter_test.step(250));await a.waitForTimeout(260);}
 await a.mouse.up();s=(await state(a)).fishing.sessions.Ely;assert.equal(s.stage,'caught',JSON.stringify(s));
 await a.evaluate(()=>reletter_test.step(650));await frame(a,'landing');await a.evaluate(()=>reletter_test.step(1200));
 await a.locator('#catch-viewer').waitFor({state:'visible'});assert.equal(await b.locator('#catch-viewer').evaluate(d=>d.open),false);
 let r=(await state(a)).catchPresentation.rotation;await a.waitForTimeout(450);assert.ok((await state(a)).catchPresentation.rotation>r);
 await a.screenshot({path:'output/deep-fishing/catch-desktop.png'});await a.waitForTimeout(900);assert.equal((await state(a)).catchPresentation.open,true);await a.locator('#catch-stage').click();await a.locator('#catch-viewer').waitFor({state:'hidden'});
 await b.evaluate(fish=>reletter_test.showCatch(fish),s.result);await b.waitForTimeout(300);await b.screenshot({path:'output/deep-fishing/catch-phone.png'});await b.locator('#catch-stage').tap();await b.locator('#catch-viewer').waitFor({state:'hidden'});
 console.log('Real catch, landing, rotating modal, owner-only popup and touch minimize pass');
 await a.locator('#fishing-close').click();
 // Deterministic visual fixtures only in the local browser; no fake rewards enter the server.
 await a.evaluate(()=>{const t=reletter_test,w=t.world(),depths=[1,3,7,14,28,28],holes=depths.map((depth,i)=>({id:'depth-'+i,position:[i*4,0,0],radius:1.5,depth,water:i===5?'crimson':'normal'}));t.receiveSnapshot('game',{worldRevision:999999,fishing:{revision:999999,holes,ponds:[],bags:{},sessions:{}}});t.explore([10,0,8]);t.step(32);w.camera.position.set(10,18,12);w.camera.lookAt(10,0,0);t.renderer.render(w.plantRoot.parent,w.camera);});
 const shapes=await a.evaluate(()=>[...reletter_test.world().waterFeatures.values()].map(g=>({depth:g.userData.depth,children:g.children.length,shade:g.userData.water.material.uniforms.depthShade.value})));
 assert.equal(shapes.length,6);assert.ok(shapes.every(g=>g.children===2));assert.ok(shapes[4].shade>shapes[0].shade);
 await a.screenshot({path:'output/deep-fishing/depths.png'});
 for(const species of ['abyss-oracle','veil-empress','cathedral-nautilus','thorn-seraph','elder-leviathan','dream-devourer']){
  await a.evaluate(species=>reletter_test.showCatch({species,kg:25}),species);await a.waitForTimeout(250);await a.screenshot({path:`output/deep-fishing/${species}.png`});await a.locator('#catch-stage').click();await a.locator('#catch-viewer').waitFor({state:'hidden'});
 }
 assert.deepEqual(errors,[]);console.log('PASS depth shading, rim-free holes, 6 rotating eldritch models, no JS/shader errors');
}finally{for(const c of contexts)await c.close();await browser.close();}
