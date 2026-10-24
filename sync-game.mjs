import fs from 'node:fs';
let html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('// Runs inside the original'),end=html.indexOf('// ===== Init =====',start);
if(start<0||end<0)throw new Error('RELETTER integration markers missing');
html=html.slice(0,start)+fs.readFileSync('game-additions.js','utf8')+'\n'+fs.readFileSync('adventure-additions.js','utf8')+'\n'+fs.readFileSync('fishing-presentation.js','utf8')+'\n'+fs.readFileSync('novel-melee.js','utf8')+'\n'+fs.readFileSync('build-surfaces.js','utf8')+'\n'+fs.readFileSync('loot-presentation.js','utf8')+'\n'+fs.readFileSync('bag-additions.js','utf8')+'\n'+fs.readFileSync('milk-presentation.js','utf8')+'\n'+fs.readFileSync('enemy-presentation.js','utf8')+'\n'+fs.readFileSync('garden-additions.js','utf8')+'\n'+html.slice(end);
fs.writeFileSync('index.html',html);
