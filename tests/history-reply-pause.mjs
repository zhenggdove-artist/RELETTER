import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base='http://127.0.0.1:8788';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
await fs.mkdir('output/history-pause',{recursive:true});
try {for(const mobile of [true,false]){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
 await context.addInitScript(()=>window.__reletterTestPause=true);
 const login=await context.request.post(base+'/api/login',{data:{password:'rae1210'}});assert.equal(login.status(),200);
 const response=await context.request.post(base+'/api/entries',{data:{text:'History reply regression',part:{position:[3,0,3]}}});assert.equal(response.status(),201);const seed=await response.json();
 const page=await context.newPage();page.setDefaultTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto(base);await page.locator('#password').fill('rae1210');await page.locator('#login-form button').click();await page.locator('[data-character="Ely"]').click();await page.waitForSelector('#entry-gate',{state:'detached'});
 await page.locator('#search-btn').click();assert.equal(await page.locator('#search-btn').innerText(),'HISTORY');
 const card=page.locator('.sr-item').filter({hasText:'History reply regression'});await card.waitFor();await page.screenshot({path:`output/history-pause/history-${mobile}.png`});
 await card.locator('.history-reply').click();assert.equal(await page.locator('#reply-draft').isVisible(),true);assert.equal(await page.evaluate(()=>JSON.parse(render_game_to_text()).replyParentId),seed.id);
 await page.waitForFunction(()=>reletter_test.model()&&reletter_test.threat().loaded);
 await page.evaluate(()=>reletter_test.explore([0,0,0]));await page.locator('#search-btn').click();await page.evaluate(()=>reletter_test.placeThreat());
 const before=await page.evaluate(()=>reletter_test.threat());assert.ok(before.monsters.length>0);await page.evaluate(()=>advanceTime(3000));assert.deepEqual(await page.evaluate(()=>reletter_test.threat()),before);
 await card.locator('.history-reply').click();await page.evaluate(()=>advanceTime(3000));assert.deepEqual(await page.evaluate(()=>reletter_test.threat()),before);
 await page.screenshot({path:`output/history-pause/reply-${mobile}.png`});await page.locator('#writer-close').click();assert.equal(await page.evaluate(()=>JSON.parse(render_game_to_text()).monstersPaused),true);
 await page.waitForTimeout(1300);assert.equal(await page.evaluate(()=>JSON.parse(render_game_to_text()).monstersPaused),false);await page.evaluate(()=>{reletter_test.placeThreat();advanceTime(100);});
 assert.equal(await page.evaluate(()=>reletter_test.threat().death),true,'monster collision resumes after closing and grace period');assert.deepEqual(errors,[]);
 console.log('PASS',mobile?'mobile':'desktop','initial HISTORY reply, ground monster motion/animation/collision pause, grace and resume');
 }finally{await context.request.delete(base+'/api/entries/'+seed.id);await context.close();}
}}finally{await browser.close();}
