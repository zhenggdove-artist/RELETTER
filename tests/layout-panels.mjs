import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try{
 for(const touch of [false,true]){
  const context=await browser.newContext({viewport:{width:1280,height:800},hasTouch:touch,isMobile:touch});
  await context.addInitScript(()=>window.__reletterTestPause=true);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
  await page.route('**/api/chat',route=>route.request().method()==='GET'?route.fulfill({json:Array.from({length:60},(_,i)=>({id:'layout-'+i,name:i%2?'Rae':'Ely',text:'Chat message '+i,time:Date.now()+i}))}):route.continue());
  await page.goto('http://127.0.0.1:8788');await page.waitForFunction(()=>typeof render_game_to_text==='function');await page.locator('#password').fill('rae1210');await page.locator('#login-form button').click();await page.locator('[data-character="Ely"]').click();await page.waitForSelector('#entry-gate',{state:'detached'});await page.waitForFunction(()=>reletter_test.model());await page.evaluate(()=>{reletter_test.explore();advanceTime(100);reletter_test.render();});
  async function check(expected){
   await page.waitForTimeout(60);
   const state=await page.evaluate(()=>{
    const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
    const rect=el=>{const r=el.getBoundingClientRect();return {id:el.id,x:r.x,y:r.y,w:r.width,h:r.height,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};};
    const panels=['ui','search-panel','online-panel'].map(id=>document.getElementById(id)).filter(visible);
    const controls=['search-btn','chat-open','write-open','water-gun','joystick-zone','jump-btn'].map(id=>document.getElementById(id)).filter(visible);
    return {mode:document.body.dataset.panel,panels:panels.map(rect),boxes:[...panels,...controls].map(rect),inside:panels.flatMap(el=>[...el.querySelectorAll('input:not([hidden]),textarea,button')].filter(visible).filter(n=>{const a=n.getBoundingClientRect(),b=el.getBoundingClientRect();return a.top>=b.top&&a.bottom<=b.bottom;}).map(rect)),width:innerWidth,height:innerHeight};
   });
   assert.equal(state.mode,expected);assert.ok(state.panels.length<=1,`${touch}: simultaneous panels`);
   for(const a of state.boxes){assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=state.width+1&&a.y+a.h<=state.height+1,`${touch} ${state.width} ${expected} ${a.id} outside viewport`);for(const b of state.boxes)if(a!==b)assert.ok(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)<=1||Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)<=1,`${touch} ${state.width} ${expected}: ${a.id} overlaps ${b.id}`);}
   for(const a of state.boxes.filter(a=>!['ui','online-panel','search-panel'].includes(a.id)))assert.ok(a.hit,`${expected}: ${a.id} blocked`);
   for(const a of state.inside)assert.ok(a.hit,`${expected}: ${a.id} blocked inside panel`);
  }
  for(const [width,height] of [[1280,800],[580,486],[960,540],[640,480],[390,844],[320,568],[844,390],[390,320]]){
   await page.setViewportSize({width,height});
   for(const action of ['chat','search','write','chat','write','search','chat']){
    await page.locator('#'+{chat:'chat-open',search:'search-btn',write:'write-open'}[action]).click();await check(action);
    if(action==='write'){await page.locator('#drawing').scrollIntoViewIfNeeded();await page.locator('#upload-av').setInputFiles({name:'oversized.webm',mimeType:'video/webm',buffer:Buffer.alloc(5*1024*1024+1)});assert.ok((await page.locator('#media-error').textContent()).includes('5 MB'));}
    if(action==='chat'){await page.waitForFunction(()=>{const e=document.querySelector('#chat-log');return e.scrollHeight-e.clientHeight-e.scrollTop<3;});await page.locator('#chat-input').fill('No overlapping controls');}
   }
   if((width===580&&!touch)||(width===390&&height===844&&touch))await page.screenshot({path:`output/verification/layout-fixed-${touch?'phone':'desktop'}.png`});
   await page.locator('#chat-close').click();await check('none');
  }
  // Simulate a phone keyboard reducing the visual viewport without resizing layout viewport.
  await page.setViewportSize({width:390,height:844});await page.locator('#chat-open').click();await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:340});visualViewport.dispatchEvent(new Event('resize'));});await check('chat');assert.equal(await page.locator('#action-dock').isVisible(),false);const panel=await page.locator('#online-panel').boundingBox();assert.ok(panel.y+panel.height<=340);await page.screenshot({path:`output/verification/layout-keyboard-${touch}.png`});
  await context.close();console.log('PASS mutually exclusive panels, unobstructed controls, latest chat: '+(touch?'touch':'mouse')+' at 8 sizes + keyboard');
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
