import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
const baseUrl=process.env.RELETTER_TEST_URL||'http://127.0.0.1:3000';
async function screenshot(p,path){await p.evaluate(()=>advanceTime(50));await p.screenshot({path,timeout:120000});}
const a=await browser.newContext({viewport:{width:960,height:720}}),b=await browser.newContext({viewport:{width:960,height:720}});
await a.addInitScript(()=>window.__reletterTestPause=true);await b.addInitScript(()=>window.__reletterTestPause=true);a.setDefaultTimeout(120000);b.setDefaultTimeout(120000);
const ely=await a.newPage(),rae=await b.newPage();
for(const p of [ely,rae])p.on('pageerror',e=>errors.push(e.message));
await fs.mkdir('output/verification',{recursive:true});
async function login(p,name){await p.goto(baseUrl,{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>typeof window.render_game_to_text==='function');await p.locator('#password').fill('rae1210');await p.locator('#login-form button').click();await p.locator(`[data-character="${name}"]`).click({noWaitAfter:true});await p.waitForSelector('#entry-gate',{state:'detached'});}
try{
  await ely.goto(baseUrl,{waitUntil:'domcontentloaded',timeout:120000});await ely.waitForFunction(()=>typeof window.render_game_to_text==='function');
  await ely.locator('#password').fill('wrong');await ely.locator('#login-form button').click();await ely.waitForFunction(()=>document.querySelector('#gate-error').textContent.includes('Incorrect password'));
  console.log('Password rejection passed');await login(ely,'Ely');console.log('Ely joined');await login(rae,'Rae');console.log('Rae joined');
  await ely.waitForFunction(()=>JSON.parse(render_game_to_text()).players===2);
  await ely.keyboard.press('Enter');await ely.locator('#chat-input').fill('你好 Rae！<script>不應執行</script>');await ely.keyboard.press('Enter');
  await rae.waitForFunction(()=>document.querySelector('#chat-log').textContent.includes('你好 Rae'));
  await rae.keyboard.press('Enter');await rae.locator('#chat-input').fill('Ely，我在這裡');await rae.keyboard.press('Enter');
  await ely.waitForFunction(()=>document.querySelector('#chat-log').textContent.includes('我在這裡'));
  // Typed WASD must never move the local player.
  const before=await ely.evaluate(()=>JSON.parse(render_game_to_text()).position);
  await ely.keyboard.press('Enter');await ely.locator('#chat-input').fill('wasd');await ely.evaluate(()=>advanceTime(400));await ely.keyboard.press('Escape');
  const after=await ely.evaluate(()=>JSON.parse(render_game_to_text()).position);assert.deepEqual(after,before);
  await ely.locator('#brush-size').fill('18');await ely.locator('#brush-color').fill('#e04477');
  const box=await ely.locator('#drawing').boundingBox();await ely.mouse.move(box.x+20,box.y+30);await ely.mouse.down();await ely.mouse.move(box.x+150,box.y+90,{steps:15});await ely.mouse.up();
  const png=await ely.locator('#drawing').screenshot();await ely.locator('#upload-image').setInputFiles({name:'flower.png',mimeType:'image/png',buffer:png});
  await ely.waitForFunction(()=>!document.querySelector('#image-preview').hidden);
  const plantedText='給 Rae 的花園測試 '+Date.now();
  await ely.locator('#ta').fill(plantedText);
  await screenshot(ely,'output/verification/drawing.png');
  await ely.locator('#go').click({noWaitAfter:true});console.log('Plant cinematic started');await ely.evaluate(()=>advanceTime(20000));await ely.waitForTimeout(600);await ely.evaluate(()=>advanceTime(20000));
  await ely.waitForFunction(text=>JSON.parse(render_game_to_text()).plants.some(p=>p.text===text&&p.drawing&&p.image&&p.id),plantedText,{timeout:100000});
  await rae.waitForFunction(text=>JSON.parse(render_game_to_text()).plants.some(p=>p.text===text&&p.drawing&&p.image),plantedText,{timeout:100000});
  await rae.waitForFunction(()=>JSON.parse(render_game_to_text()).remotePlayers.some(p=>p.character==='Ely'&&p.state?.position[1]<1));
  const state=await ely.evaluate(()=>JSON.parse(render_game_to_text()));
  const plant=state.plants.find(p=>p.text===plantedText);
  const stored=await a.request.get(baseUrl+'/api/entries');assert.ok((await stored.json()).some(p=>p.id===plant.id&&p.part.drawing&&p.part.image));
  await screenshot(ely,'output/verification/gameplay-ely.png');await screenshot(rae,'output/verification/gameplay-rae.png');
  // Hover the actual plant projection to exercise the original raycast tooltip.
  await Promise.all([ely,rae].map(p=>p.evaluate(()=>window.__reletterTestPause=true)));
  const hover=await ely.evaluate(()=>window.reletterPlantScreenPoint?.());
  assert.ok(hover,'a planted mesh must be visible and raycastable');
  await ely.mouse.move(hover.x,hover.y);await ely.waitForTimeout(700);
  await ely.waitForFunction(()=>document.querySelector('#plant-label').style.display==='block'&&document.querySelectorAll('#plant-label img').length===2);
  const tooltip=await ely.locator('#plant-label').boundingBox();assert.ok(tooltip.y+tooltip.height<=720,'tooltip stays inside the screen');
  await ely.screenshot({path:'output/verification/hover-media.png',timeout:120000});
  
  await fs.writeFile('output/verification/state.json',JSON.stringify(state,null,2));
  await ely.reload({waitUntil:'domcontentloaded',timeout:120000});await ely.waitForFunction(()=>typeof render_game_to_text==='function');await ely.locator('#password').fill('RAE1210');await ely.locator('#login-form button').click();await ely.locator('[data-character="Ely"]').click();await ely.waitForSelector('#entry-gate',{state:'detached'});
  await ely.waitForFunction(id=>JSON.parse(render_game_to_text()).plants.some(p=>p.id===id&&p.drawing&&p.image),plant.id);
  await b.close();await ely.waitForFunction(()=>JSON.parse(render_game_to_text()).players===1);
  const savedEntries=await (await a.request.get(baseUrl+'/api/entries')).json();
  for(const entry of savedEntries)if(entry.text.startsWith('給 Rae 的花園測試 '))await a.request.delete(baseUrl+'/api/entries/'+entry.id);
  assert.deepEqual(errors,[]);console.log('PASS: password, two-player entry, bidirectional chat, typing isolation, drawing + upload, shared plant, persisted reload; no browser errors');
}catch(e){console.log('Browser errors',errors);for(const [i,p] of [ely,rae].entries())await p.screenshot({path:'output/verification/failure-'+i+'.png',timeout:10000}).catch(()=>{});throw e;}finally{await browser.close();}
