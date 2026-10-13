import fs from 'node:fs';
let html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('// Runs inside the original'),end=html.indexOf('// ===== Init =====',start);
if(start<0||end<0)throw new Error('RELETTER integration markers missing');
html=html.slice(0,start)+fs.readFileSync('game-additions.js','utf8')+'\n'+html.slice(end);
fs.writeFileSync('index.html',html);
