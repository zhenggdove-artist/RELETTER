import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const base='http://127.0.0.1:8788',browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),contexts=[],errors=[];
await fs.mkdir('output/garden-expansion',{recursive:true});
async function enter(name,mobile=false){const c=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});contexts.push(c);await c.addInitScript(()=>window.__reletterTestPause=true);const p=await c.newPage();p.setDefaultTimeout(45000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/.test(m.text()))errors.push(m.text());});await p.goto(base);await p.waitForFunction(()=>window.reletter_test);await p.locator('#password').fill('rae1210');await p.locator('#login-form button').click();await p.locator(`[data-character="${name}"]`).click();await p.locator('#entry-gate').waitFor({state:'detached'});await p.waitForFunction(()=>reletter_test.model());return p;}
const state=p=>p.evaluate(()=>JSON.parse(render_game_to_text()));
async function post(p,data,path='/api/game'){const r=await p.request.post(base+path,{data});assert.equal(r.status(),200,await r.text());return r.json();}
function gripCheck(){const t=reletter_test,w=t.world();let hand;t.model().traverse(b=>{if(b.name.endsWith('RightHand'))hand=b;});const blade=w.equipmentAuras.get('Ely').userData.blade;blade.updateWorldMatrix(true,false);return hand.getWorldPosition(new t.THREE.Vector3()).distanceTo(blade.getWorldPosition(new t.THREE.Vector3()));}
async function render(p,file){await p.evaluate(()=>{const t=reletter_test,w=t.world(),v=w.charRoot.position;w.camera.position.set(v.x+2.4,2.1,v.z+3.8);w.camera.lookAt(v.x,1,v.z);t.renderer.render(w.plantRoot.parent,w.camera);});await p.screenshot({path:`output/garden-expansion/${file}.png`});}
try{
 const a=await enter('Ely'),b=await enter('Rae',true);for(let i=0;i<10;i++){await a.waitForTimeout(430);await post(a,{text:'/show me the money'},'/api/chat');}
 await a.evaluate(()=>{reletter_test.explore([320,0,-320]);reletter_test.step(16);});await b.evaluate(()=>{reletter_test.explore([350,0,-320]);reletter_test.step(16);});await a.waitForTimeout(250);
 for(const family of ['saber','whip','swatter','pan','planter','palm']){
  const id=family+'-3';if(!(await state(a)).equipment.owned.includes(id))await post(a,{action:'buy',item:id});await post(a,{action:'equip',item:id});await a.waitForTimeout(1600);
  await post(a,{action:'shoot',direction:[0,0,1],charge:1});await a.evaluate(()=>reletter_test.step(250));assert.ok(await a.evaluate(gripCheck)<.001,family+' windup hand');await render(a,family+'-windup');
  await a.evaluate(()=>reletter_test.step(450));assert.ok(await a.evaluate(gripCheck)<.001,family+' strike hand');await render(a,family+'-strike');await b.evaluate(()=>reletter_test.step(500));assert.ok((await state(b)).melee.length>0,'peer sees attack');
  await a.evaluate(()=>reletter_test.step(2600));assert.equal((await state(a)).melee.length,0);
 }
 console.log('Six melee families, charged whole-body motion, anchored grips, peer effects and cleanup pass');
 if(!(await state(a)).equipment.owned.includes('pond-kit'))await post(a,{action:'buy',item:'pond-kit'});
 const existing=(await state(a)).fishing.ponds;const origin=Array.from({length:12},(_,i)=>100+i*25).find(x=>existing.every(p=>Math.hypot(p.position[0]-x,p.position[2]+230)>35));
 assert.ok(origin);const ponds=[];
 for(const [i,size] of ['small','medium','large'].entries()){
  const pos=[origin+i*12,0,-230];await a.evaluate(p=>{reletter_test.explore([p[0]-6,0,p[2]]);reletter_test.step(16);},pos);await a.waitForTimeout(250);
  await a.locator('#build-open').click();await a.locator('#build-pond').click();await a.locator('#aquarium-size').selectOption(size);await a.evaluate(p=>reletter_test.setBuild(p),pos);
  const before=(await state(a)).coins;await a.locator('#build-place').click();await a.waitForFunction(size=>JSON.parse(render_game_to_text()).fishing.ponds.some(p=>p.tankSize===size),size);
  const pond=(await state(a)).fishing.ponds.at(-1);ponds.push(pond);assert.equal(before-(await state(a)).coins,[15,45,100][i]);
  await b.waitForFunction(id=>JSON.parse(render_game_to_text()).fishing.ponds.some(p=>p.id===id),pond.id);
  await a.locator('#build-close').click();
 }
 const bag=(await state(a)).fishing.bags.Ely||[];if(bag.length){await a.evaluate(p=>{reletter_test.explore([p[0]-4,0,p[2]]);reletter_test.step(16);},ponds[1].position);await a.waitForTimeout(200);await post(a,{action:'pond-release',pond:ponds[1].id,id:bag[0].id});await b.waitForFunction(id=>JSON.parse(render_game_to_text()).fishing.ponds.some(p=>p.fish.some(f=>f.id===id)),bag[0].id);await a.waitForFunction(id=>reletter_test.world().pondFish.get(id)?.userData.mesh.material.map.image.complete,bag[0].id);}
 await a.evaluate(x=>{reletter_test.step(2000);const t=reletter_test,w=t.world();w.camera.position.set(x+12,11,-213);w.camera.lookAt(x+12,1,-230);t.renderer.render(w.plantRoot.parent,w.camera);},origin);await a.screenshot({path:'output/garden-expansion/aquariums.png'});
 await a.evaluate(p=>{const t=reletter_test,w=t.world();w.camera.position.set(p[0]+4,2.7,p[2]+5);w.camera.lookAt(p[0],1,p[2]);t.renderer.render(w.plantRoot.parent,w.camera);},ponds[1].position);await a.screenshot({path:'output/garden-expansion/aquarium-fish.png'});
 assert.ok(await a.evaluate(p=>reletter_test.buildBlocked(p[0],p[2],0),ponds[1].position));
 // A centered popup must remain centered at both desktop and phone sizes.
 for(const p of [a,b]){await p.evaluate(()=>reletter_test.showCatch({species:'dream-devourer',kg:28}));await p.waitForTimeout(450);const box=await p.locator('#catch-viewer').boundingBox(),vp=p.viewportSize();assert.ok(Math.abs(box.x+box.width/2-vp.width/2)<2);assert.ok(Math.abs(box.y+box.height/2-vp.height/2)<2);await p.screenshot({path:`output/garden-expansion/catch-${vp.width}.png`});await p.locator('#catch-stage').click();await p.locator('#catch-viewer').waitFor({state:'hidden'});}
 assert.deepEqual(errors,[]);console.log('PASS 3 sized/priced glass aquariums, shared construction/release, collision and centered responsive catch display');
}finally{for(const c of contexts)await c.close();await browser.close();}
