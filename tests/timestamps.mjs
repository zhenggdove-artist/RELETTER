import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await readFile('game-additions.js','utf8'),start=source.indexOf('function messageTimestamp('),end=source.indexOf('\nlet hoverPoint',start);
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:500},timezoneId:'America/New_York'});
 await page.setContent('<style>body{font:14px sans-serif;background:#efe3fa}#plant-label{padding:16px;background:white;border-radius:12px}.message-time{display:block;text-align:right;margin-top:6px;font:11px/1.5 sans-serif;color:#705b7a}img{display:block;width:160px;height:120px;object-fit:contain}</style><div id="plant-label"></div>');
 const entry={text:'A message and a drawing',username:'Rae',ts:'2026-10-15T06:30:00Z',media:{drawing:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><path d="M20 70 Q80 0 140 70" stroke="purple" fill="none" stroke-width="8"/></svg>')}};
 const result=await page.evaluate(({code,entry})=>{
  eval('const plantLabel=document.getElementById("plant-label");'+code+';showMedia('+JSON.stringify(entry)+');');
  const time=document.querySelector('time'),image=document.querySelector('img');
  return{text:time.textContent,iso:time.dateTime,afterImage:!!(image.compareDocumentPosition(time)&Node.DOCUMENT_POSITION_FOLLOWING),align:getComputedStyle(time).textAlign};
 },{code:source.slice(start,end),entry});
 assert.deepEqual(result,{text:'2026 10.15 14:30',iso:'2026-10-15T06:30:00.000Z',afterImage:true,align:'right'});
 await page.screenshot({path:'output/verification/plant-timestamp.png'});
 console.log('PASS plant image + right-aligned Taiwan timestamp, browser in New York');
}finally{await browser.close();}
