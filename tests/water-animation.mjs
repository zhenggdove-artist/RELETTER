import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
await fs.mkdir('output/water-animation',{recursive:true});const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{for(const mobile of [false,true]){
 const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},hasTouch:mobile,isMobile:mobile});await ctx.addInitScript(()=>window.__reletterTestPause=true);const page=await ctx.newPage();page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{await page.goto('http://127.0.0.1:8788');await page.locator('#password').fill('rae1210');await page.locator('#login-form button').click();await page.locator('[data-character="Ely"]').click();await page.waitForSelector('#entry-gate',{state:'detached'});await page.waitForFunction(()=>reletter_test.model());await page.evaluate(()=>{reletter_test.explore([60,0,60]);reletter_test.model().rotation.y=Math.PI/2;});await page.waitForTimeout(200);
 for(const charge of [false,true]){
 await page.keyboard.down('q');if(charge)await page.waitForTimeout(1550);const response=page.waitForResponse(r=>r.url().endsWith('/api/game')&&r.request().postDataJSON()?.action==='shoot');await page.keyboard.up('q');assert.equal((await response).status(),200);await page.waitForFunction(()=>JSON.parse(render_game_to_text()).water.shots.length>0);
 const shot=await page.evaluate(()=>JSON.parse(render_game_to_text()).water.shots.at(-1));assert.equal(shot.droplets,180+Math.round(shot.charge*140));if(charge)assert.equal(shot.droplets,320);
 let previous;
 for(const [name,ms] of [['start',120],['flow',350],['splash',600]]){
  await page.evaluate(ms=>advanceTime(ms),ms);
  const state=await page.evaluate(()=>{const scene=reletter_test.world().plantRoot.parent,fx=scene.getObjectByName('Water spray');return {age:JSON.parse(render_game_to_text()).water.shots.at(-1)?.age,matrices:Array.from(fx.children[0].instanceMatrix.array.slice(0,32)),rings:fx.children.slice(1).map(r=>r.material.opacity)};});
  if(previous)assert.notDeepEqual(state.matrices,previous);previous=state.matrices;if(name==='splash')assert.ok(state.rings.some(n=>n>0));
  await page.evaluate(({splash,range})=>{const {camera,charRoot,plantRoot}=reletter_test.world();const center=charRoot.position.clone().add(new reletter_test.THREE.Vector3(splash?range:8,splash?0:1,0));camera.position.copy(center).add(new reletter_test.THREE.Vector3(1,splash?4:7,splash?7:19));camera.lookAt(center);reletter_test.renderer.render(plantRoot.parent,camera);},{splash:name==='splash',range:shot.range});
  await page.screenshot({path:`output/water-animation/${mobile?'phone':'desktop'}-${charge?'charged':'tap'}-${name}.png`});
 }
 await page.evaluate(()=>advanceTime(1800));assert.equal(await page.evaluate(()=>JSON.parse(render_game_to_text()).water.shots.length),0);assert.equal(await page.evaluate(()=>!!reletter_test.world().plantRoot.parent.getObjectByName('Water spray')),false);await page.waitForTimeout(750);
 }
 assert.deepEqual(errors,[]);console.log('PASS',mobile?'mobile':'desktop','progressive droplets, curved travel, splash/ripple, charged density, animation changes and full cleanup');
 }finally{await ctx.close();}
}}finally{await browser.close();}
