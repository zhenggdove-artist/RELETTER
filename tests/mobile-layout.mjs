import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const failures=[];
try{
 for(const [width,height] of [[320,568],[390,844],[844,390],[390,320]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});await context.addInitScript(()=>window.__reletterTestPause=true);
  const page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));
  await page.route('**/api/chat',route=>route.request().method()==='GET'?route.fulfill({json:Array.from({length:30},(_,i)=>({id:'layout-'+i,name:i%2?'Rae':'Ely',text:'A message in our garden '+i,time:i}))}):route.continue());
  await page.goto('http://127.0.0.1:3004');await page.waitForFunction(()=>typeof render_game_to_text==='function');await page.locator('#password').fill('rae1210');await page.locator('#login-form button').click();await page.locator('[data-character="Ely"]').click();await page.waitForSelector('#entry-gate',{state:'detached'});
  // Enable existing controls to exercise their touch targets across every UI state.
  await page.evaluate(()=>document.querySelector('#game-controls').classList.remove('hide'));
  async function check(state,panel){await page.waitForTimeout(100);const result=await page.evaluate(({panel})=>{const ids=['search-btn','chat-open','chat-minimize','ui','joystick-zone','jump-btn'];const boxes=ids.filter(id=>id!=='ui'||document.getElementById(id).classList.contains('mini')).map(id=>{const el=document.getElementById(id),r=el.getBoundingClientRect();return{id,x:r.x,y:r.y,w:r.width,h:r.height,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});if(panel){const r=document.querySelector(panel).getBoundingClientRect();boxes.push({id:panel,x:r.x,y:r.y,w:r.width,h:r.height,hit:true});}return boxes;},{panel});for(const a of result){assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=width+1&&a.y+a.h<=height+1,`${width}x${height} ${state}: ${a.id} out of view`);assert.ok(a.hit,`${width}x${height} ${state}: ${a.id} obstructed`);for(const b of result){if(a===b)continue;assert.ok(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)<=1||Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)<=1,`${width}x${height} ${state}: ${a.id}/${b.id} overlap`);}}}
  await check('collapsed');await page.locator('#chat-minimize').tap();await check('history','#chat-history');await page.screenshot({path:`output/verification/layout-history-${width}-${height}.png`});
  await page.locator('#ui').tap();await page.waitForFunction(()=>document.querySelector('#online-panel').classList.contains('minimized'));await check('writer','#ui');await page.screenshot({path:`output/verification/layout-write-${width}-${height}.png`});
  await page.locator('#chat-open').tap();await check('chat','#chat-form');await page.locator('#chat-input').fill('Phone chat');await page.screenshot({path:`output/verification/layout-chat-${width}-${height}.png`});await page.locator('#chat-close').tap();
  await page.locator('#search-btn').tap();await check('search','#search-panel');await page.locator('#chat-minimize').tap();assert.equal(await page.locator('#search-panel').isVisible(),false);await check('history after search','#chat-history');
  await context.close();console.log('PASS layout',width,height);
 }
 assert.deepEqual(failures,[]);
}finally{await browser.close();}
