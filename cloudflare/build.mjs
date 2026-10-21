import {cp,mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve('.'),destination=resolve('dist-cloudflare');
await mkdir(destination,{recursive:true});
for(const file of ['index.html','build-shapes.js','equipment-catalog.js','fishing-catalog.js','fish-art.js','fish-model.js','melee-motion.js','weapon-effects.js','ultimate-effects.js','abyss-art.js','character.glb','monster.glb','FONTS','music','UIstyle'])await cp(resolve(root,file),resolve(destination,file),{recursive:true});
await mkdir(resolve(destination,'playermodel/COIN'),{recursive:true});
await cp(resolve(root,'playermodel/COIN/coin_small.glb'),resolve(destination,'playermodel/COIN/coin_small.glb'));
// Dedicated runtime flag selects the cloud WebSocket transport. The local Node server keeps SSE.
await writeFile(resolve(destination,'hosting-config.js'),'window.RELETTER_TRANSPORT="websocket";\n');
for(const file of ['character.glb','monster.glb'])if((await stat(resolve(destination,file))).size>25*1024*1024)throw new Error(file+' exceeds the Cloudflare asset limit');
console.log('RELETTER cloud assets prepared. Backend, database files and credentials excluded.');
