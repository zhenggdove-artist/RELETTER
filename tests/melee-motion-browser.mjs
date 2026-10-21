import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {meleeDuration} from '../melee-motion.js';
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),errors=[];
await fs.mkdir('output/melee-motion',{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:1280,height:800}});await p.addInitScript(()=>window.__reletterTestPause=true);p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8788');await p.locator('#password').fill('rae1210');await p.locator('#login-form button').click();await p.locator('[data-character="Ely"]').click();await p.locator('#entry-gate').waitFor({state:'detached'});await p.waitForFunction(()=>reletter_test.model());
 await p.evaluate(()=>{reletter_test.explore([380,0,300]);reletter_test.step(16);});
 const base=await p.evaluate(()=>reletter_test.model().position.toArray());let revision=100000;
 for(const family of ['saber','swatter','pan','planter','palm']){
  const combos=family==='saber'?[0,1,2,3,4,5,6]:[6];
  for(const combo of combos){
   await p.evaluate(async({family,combo,revision})=>{const t=reletter_test,{equipmentById}=await import('/equipment-catalog.js'),item=equipmentById(family+'-3');t.receiveSnapshot('game',{worldRevision:revision,equipmentRevision:revision,equipment:{Ely:{weapon:item.id}}});t.step(16);t.receiveSnapshot('water',{shooter:'Ely',weapon:item.id,family,origin:[380,1,300],direction:[0,0,1],range:item.range,radius:item.radius,charge:combo===6?1:0,combo,color:item.color});}, {family,combo,revision:revision++});
   await p.evaluate(ms=>reletter_test.step(ms),meleeDuration(family,combo)*550);
   const check=await p.evaluate(()=>{const t=reletter_test,w=t.world(),m=t.model();let hand,spine;m.traverse(b=>{if(b.name.endsWith('RightHand'))hand=b;if(b.name.endsWith('Spine2'))spine=b;});const blade=w.equipmentAuras.get('Ely').userData.blade;blade.updateWorldMatrix(true,false);return {grip:hand.getWorldPosition(new t.THREE.Vector3()).distanceTo(blade.getWorldPosition(new t.THREE.Vector3())),spine:spine?.quaternion.toArray(),root:w.charRoot.position.toArray(),visible:m.visible&&w.charRoot.visible,position:m.position.toArray(),geometry:blade.children.length};});
   assert.ok(check.visible);assert.ok(Math.abs(check.root[0]-380)<.1);assert.ok(check.grip<.001);assert.equal(check.spine.length,4,'Spine2 must remain addressable');assert.ok(check.geometry>3);
   await p.evaluate(()=>{const t=reletter_test,w=t.world();w.camera.position.set(383.5,2.5,305.2);w.camera.lookAt(380,.8,300);t.renderer.render(w.plantRoot.parent,w.camera);});
   await p.screenshot({path:`output/melee-motion/${family}-${combo}.png`});
   await p.evaluate(()=>reletter_test.step(3000));assert.equal(JSON.parse(await p.evaluate(()=>render_game_to_text())).melee.length,0);
   const position=await p.evaluate(()=>reletter_test.model().position.toArray());assert.ok(position.every((v,i)=>Math.abs(v-base[i])<.0001),'visual lunge must restore without drift');
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS 7 full-body saber poses, four garden weapons, hand anchors, Spine2 mapping and no transform drift');
}finally{await browser.close();}
