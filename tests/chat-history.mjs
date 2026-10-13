import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
const file='output/history-regression.sqlite',base='http://127.0.0.1:3103';
await rm(file,{force:true});const db=new DatabaseSync(file);db.exec('CREATE TABLE reletter_chat(id TEXT PRIMARY KEY,payload TEXT NOT NULL)');
for(let i=0;i<130;i++){const chat={id:'history-'+String(i).padStart(3,'0'),name:i%2?'Ely':'Rae',text:'History message '+i,time:i};db.prepare('INSERT INTO reletter_chat VALUES(?,?)').run(chat.id,JSON.stringify(chat));}db.close();
let server;async function start(){server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3103',SQLITE_PATH:file,RELETTER_DATABASE_URL:''},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('http://localhost:3103'))resolve();});server.on('error',reject);server.on('exit',code=>reject(Error('Server exited '+code)));});}
async function stop(){const child=server;await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 await start();const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await page.addInitScript(()=>window.__reletterTestPause=true);
 await page.goto(base);await page.waitForFunction(()=>typeof render_game_to_text==='function');await page.locator('#password').fill('rae1210');await page.locator('#login-form button').click();await page.locator('[data-character="Ely"]').click();await page.waitForSelector('#entry-gate',{state:'detached'});await page.waitForFunction(()=>document.querySelectorAll('#chat-log div').length===130);
 assert.equal(await page.locator('#online-panel').evaluate(e=>getComputedStyle(e).bottom),'166px');await page.locator('#chat-minimize').tap();
 await page.locator('#chat-scroll').fill('0');assert.equal(await page.locator('#chat-log').evaluate(e=>e.scrollTop),0);assert.ok(await page.locator('#chat-scroll').evaluate(e=>+e.max>0));
 await page.locator('#chat-open').tap();await page.locator('#chat-input').fill('Persist after restart');await page.locator('#chat-form button[type=submit]').tap();await page.waitForFunction(()=>document.querySelectorAll('#chat-log div').length===131);await page.locator('#chat-minimize').tap();assert.equal(await page.locator('#chat-log').evaluate(e=>e.scrollTop),0,'Incoming messages must not interrupt reading old history');
 await page.screenshot({path:'output/verification/mobile-history-scroll.png'});
 await page.locator('#chat-minimize').tap();assert.equal(await page.locator('#chat-history').isVisible(),false);await page.locator('#chat-minimize').tap();assert.equal(await page.locator('#chat-history').isVisible(),true);
 await page.close();await stop();await start();const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'rae1210'})});const cookie=login.headers.get('set-cookie').split(';')[0];const rows=await(await fetch(base+'/api/chat',{headers:{Cookie:cookie}})).json();assert.equal(rows.length,131);assert.equal(rows.at(-1).text,'Persist after restart');assert.equal((await fetch(base+'/api/chat')).status,401);
 console.log('PASS: 130+ messages, scroll slider, no scroll jump, minimize/restore, database survives server restart, authentication');
}finally{await browser.close();if(server?.exitCode===null)await stop();}
