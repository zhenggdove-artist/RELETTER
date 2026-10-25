// Shared planting recipes: watered time, not wall-clock time, drives growth.
const names=['Rose','Sunflower','Lavender','Tulip','Lily','Daisy','Iris','Orchid','Peony','Lotus','Hydrangea','Camellia','Poppy','Daffodil','Hibiscus','Morning Glory','Chrysanthemum','Marigold','Cosmos','Cherry Blossom','Mint','Basil','Rosemary','Fern','Monstera','Bamboo','Aloe','Strawberry','Blueberry','Moonflower'];
const colors=['#e98aa9','#f1c35d','#ad94dc','#edacbd','#e9e5ef','#f6dfb4','#8d9fe0','#c591d0','#efaccc','#ecc0e0','#9daee9','#e98798','#ec8b69','#f0da83','#df7e9b','#9797e7','#ecbc83','#eca957','#e4b0dc','#eac3d5','#8bc4a0','#88b68b','#93bfae','#83b39b','#77ac90','#a0bd85','#86c4aa','#df8191','#9d97cd','#c8d8ed'];
const effects=['attack','speed','jump','defense','hp'];
export const SEEDS=names.map((name,i)=>({id:'seed-'+(i+1),name:name+' Seed',species:i+1,slot:'seed',family:'seed',tier:1+Math.floor(i/6),color:colors[i],price:3+Math.floor(i/3)*2,growMs:(60+Math.floor(i/5)*30)*1000,waterNeed:3+Math.floor(i/10),effect:effects[i%5],power:effects[i%5]==='hp'?2+Math.floor(i/6):.08+Math.floor(i/6)*.035,duration:180000+i%6*30000,description:'Plant on clear ground. Water to grow; harvest when flowering.'}));
export const HEAL_GRADES=[.1,.2,.3,.4,.5,.6,1];
function harvest(s,quality,legacy=false){const heal=HEAL_GRADES[quality-1],fusionPower=[.02,.04,.06,.09,.12,.16,.22][quality-1];return {...s,id:'harvest-'+s.species+(legacy?'':'-q'+quality),quality,heal,fusionPower,name:names[s.species-1]+(legacy?'':' · Q'+quality),slot:'harvest',family:'harvest',tier:Math.min(6,quality),price:0,notForSale:true,description:`Heal ${heal*100}% max HP immediately · Fusion chance ×${(1+fusionPower).toFixed(2)} for 3 minutes · +${s.effect==='hp'?s.power:Math.round(s.power*100)+'%'} ${s.effect}.`};}
export const HARVESTS=[...SEEDS.map(s=>harvest(s,Math.min(7,s.tier),true)),...SEEDS.flatMap(s=>HEAL_GRADES.map((_,q)=>harvest(s,q+1)))];
export const seedById=id=>SEEDS.find(s=>s.id===id||s.species===id);
export const cropAge=(crop,now=Date.now())=>Math.max(0,(crop.grownMs||0)+Math.max(0,Math.min(now,crop.wetUntil||0)-(crop.updatedAt??now)));
export const cropStage=(crop,now=Date.now())=>Math.min(20,1+Math.floor(cropAge(crop,now)/seedById(crop.species).growMs*4));
export const cropProgress=(crop,now=Date.now())=>Math.min(1,cropAge(crop,now)/seedById(crop.species).growMs);
