import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const url='http://127.0.0.1:8788',browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const contexts=[],pages=[],errors=[];
try{
 for(const [i,name] of ['Ely','Rae'].entries()){
  const c=await browser.newContext({viewport:{width:960,height:720}});contexts.push(c);await c.addInitScript(()=>window.__reletterTestPause=true);const p=await c.newPage();pages.push(p);p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.waitForFunction(()=>typeof render_game_to_text==='function');await p.locator('#password').fill('rae1210');await p.locator('#login-form button').click();await p.locator(`[data-character="${name}"]`).click();await p.waitForSelector('#entry-gate',{state:'detached'});await p.waitForFunction(()=>reletter_test.model());await p.evaluate(i=>{reletter_test.explore([0,0,-i*4]);const {camera}=reletter_test.world();camera.position.set(6,5,10);camera.lookAt(0,1,-2);reletter_test.render();},i);
 }
 const [ely,rae]=pages;await ely.waitForFunction(()=>JSON.parse(render_game_to_text()).remotePlayers[0]?.state?.visible);
 for(let i=40;i<47;i++)assert.ok((await contexts[1].request.post(url+'/api/game',{data:{action:'earn',index:i}})).ok());
 await rae.waitForFunction(()=>JSON.parse(render_game_to_text()).coins>=7);const balance=await rae.evaluate(()=>JSON.parse(render_game_to_text()).coins);
 for(let i=0;i<3;i++){await ely.locator('#water-gun').click();await ely.waitForTimeout(900);if(i<2)await rae.waitForFunction(n=>JSON.parse(render_game_to_text()).hits===n,i+1);}
 await ely.waitForFunction(n=>JSON.parse(render_game_to_text()).loot.some(c=>c.owner==='Rae'&&c.amount===n),balance);await rae.waitForFunction(()=>JSON.parse(render_game_to_text()).coins===0);await ely.evaluate(()=>reletter_test.render());await ely.screenshot({path:'output/verification/oct19-water-coins.png'});
 const before=await ely.evaluate(()=>JSON.parse(render_game_to_text()).coins);await ely.evaluate(()=>reletter_test.explore([0,0,-4]));await ely.waitForTimeout(250);await ely.evaluate(()=>advanceTime(50));await ely.waitForFunction(n=>JSON.parse(render_game_to_text()).coins>=n,before+balance);await rae.waitForFunction(()=>!JSON.parse(render_game_to_text()).loot.some(c=>c.owner==='Rae'));
 assert.deepEqual(errors,[]);console.log('PASS two rendered players: WATER button, three synchronized hits, full wallet drop, other player collects, both clients remove loot');
}finally{for(const c of contexts)await c.close();await browser.close();}
