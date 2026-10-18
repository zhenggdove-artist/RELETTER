import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});await fs.mkdir('output/water-charge',{recursive:true});
try{for(const mobile of [false,true]){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});await context.addInitScript(()=>window.__reletterTestPause=true);
 const page=await context.newPage();page.setDefaultTimeout(60000);const errors=[],shots=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/api/game')&&r.method()==='POST'){const b=r.postDataJSON();if(b.action==='shoot')shots.push(b);}});
 try{await page.goto('http://127.0.0.1:8788');await page.locator('#password').fill('rae1210');await page.locator('#login-form button').click();await page.locator('[data-character="Ely"]').click();await page.waitForSelector('#entry-gate',{state:'detached'});await page.waitForFunction(()=>reletter_test.model());
 await page.evaluate(()=>{reletter_test.explore();reletter_test.render();});await page.waitForTimeout(200);
 for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  await page.evaluate(a=>{reletter_test.model().rotation.y=a;const {camera}=reletter_test.world();camera.position.set(10,5,10);camera.lookAt(-20,0,0);},angle);
  await page.locator('#water-gun').click();await page.waitForTimeout(100);const shot=shots.at(-1);assert.ok(shot);assert.ok(Math.abs(shot.direction[0]-Math.sin(angle))<.00001);assert.ok(Math.abs(shot.direction[2]-Math.cos(angle))<.00001);assert.equal(shot.direction[1],0);assert.ok(shot.charge<.2);await page.waitForTimeout(750);
 }
 const box=await page.locator('#water-gun').boundingBox();const count=shots.length;const cdp=mobile?await context.newCDPSession(page):null;
 if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});else{await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();}
 await page.waitForTimeout(1600);await page.evaluate(()=>advanceTime(16));assert.equal(shots.length,count,'no shot before release');assert.equal(await page.locator('#water-gun').innerText(),'100%');
 if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
 await page.waitForTimeout(150);assert.equal(shots.length,count+1);assert.equal(shots.at(-1).charge,1);
 const state=await page.evaluate(()=>JSON.parse(render_game_to_text()).water);assert.equal(state.shots.at(-1).range,42);assert.equal(state.shots.at(-1).radius,.5);assert.equal(state.charging,false);
 await page.evaluate(()=>{const {camera,charRoot}=reletter_test.world();camera.position.copy(charRoot.position).add(new reletter_test.THREE.Vector3(9,7,12));camera.lookAt(charRoot.position);reletter_test.renderer.render(reletter_test.world().plantRoot.parent,camera);});await page.screenshot({path:`output/water-charge/charged-${mobile}.png`});
 await page.waitForTimeout(750);await page.keyboard.down('q');await page.waitForTimeout(800);const n=shots.length;await page.keyboard.up('q');await page.waitForTimeout(100);assert.equal(shots.length,n+1);assert.ok(shots.at(-1).charge>.45&&shots.at(-1).charge<.8);
 await page.waitForTimeout(750);await page.keyboard.down('q');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('q');await page.waitForTimeout(100);assert.equal(shots.length,n+1,'blur cancels charge without shooting');assert.deepEqual(errors,[]);console.log('PASS',mobile?'touch':'mouse','4 facing directions independent of camera, hold/release charge, matching broadcast range/width, Q charge, blur cancellation');
 }finally{await context.close();}
}}finally{await browser.close();}
