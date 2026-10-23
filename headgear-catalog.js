// Original playful headgear; one persistent head slot, effects are server-owned.
const designs=[
 ['dinosaur','Dinosaur Hood','#75b866','attack',.12],['poop','Royal Poop','#865334','defense',.12],['angel','Angel Wings','#fff0c6','jump',.22],['hockey','Hockey Mask','#e9ded0','hp',3],['hero','Masked Rider','#5ca67b','speed',.16],
 ['cactus','Cactus Pot','#69995e','hp',2],['teapot','Teapot Crown','#83b6ce','defense',.1],['cat','Cat Hood','#e4be9e','speed',.12],['shark','Shark Bite','#77a6bd','attack',.14],['squid','Squid Cap','#c582aa','jump',.18],
 ['crown','Mimic Crown','#e9c56a','attack',.1],['pumpkin','Pumpkin King','#e49b4d','hp',4],['mushroom','Moon Mushroom','#cb82b4','defense',.14],['jelly','Jellyfish Veil','#a0ddeb','jump',.25],['ghost','Boo Hood','#e5e8ed','speed',.18],
 ['frog','Frog Hood','#a5c875','jump',.3],['bunny','Rabbit Ears','#ead3dc','jump',.28],['bear','Bear Hood','#b18a6b','hp',5],['fox','Fox Mask','#e4b077','attack',.09],['crab','Crab Crown','#c87963','defense',.18],
 ['snail','Snail Shell','#baa47d','defense',.2],['ufo','UFO Abduction','#98c8bd','jump',.24],['saturn','Saturn Halo','#bda0dc','speed',.14],['toaster','Toast Machine','#b3babe','hp',2],['tv','Static Television','#87a4b3','attack',.08],
 ['dice','Loaded Dice','#e4dfcc','attack',.16],['book','Forbidden Book','#8d6fa4','hp',3],['ramen','Ramen Bowl','#c86f60','hp',4],['flower','Sunflower Face','#efc854','defense',.08],['windmill','Windmill Cap','#b0d6cf','speed',.2],
 ['clock','Clockwork Head','#b6a07b','speed',.1],['lantern','Ghost Lantern','#f0b260','hp',2],['bat','Bat Wings','#8c75b2','jump',.2],['bee','Bee Bonnet','#dfbb64','speed',.22],['antler','Forest Antlers','#b19375','hp',3],
 ['ram','Ram Horns','#e0d1b9','attack',.18],['unicorn','Unicorn Horn','#d1bce6','jump',.16],['dragon','Dragon Helm','#a45a78','attack',.2],['astronaut','Space Helmet','#d5e4e9','defense',.16],['diver','Diving Bell','#c09f6a','defense',.22],
 ['plague','Plague Doctor','#7e8494','defense',.15],['wizard','Wizard Hat','#8977b8','attack',.13],['knight','Knight Helm','#a6bac7','defense',.25],['jester','Jester Crown','#d486ab','speed',.15],['pirate','Pirate Hat','#715b6c','attack',.15],
 ['samurai','Stag Kabuto','#b86b69','hp',6],['lotus','Lotus Bloom','#e7adcb','jump',.14],['banana','Banana Peel','#e6cf77','speed',.24],['sushi','Salmon Sushi','#efb1a0','hp',3],['cloud','Rain Cloud','#c9deef','jump',.26]
];
const procs={dinosaur:'bleed',poop:'poison',hero:'stun',shark:'bleed',crown:'expose',pumpkin:'burn',mushroom:'poison',jelly:'slow',ghost:'fear',squid:'weak',fox:'burn',tv:'stun',book:'fear',lantern:'burn',bee:'poison',antler:'root',dragon:'burn',plague:'poison',wizard:'slow',lotus:'weak'};
const label={attack:'attack',speed:'movement speed',jump:'jump height',defense:'damage reduction',hp:'max HP'};
export const HEADGEAR=designs.map(([design,name,color,key,value],i)=>({id:'hat-'+design,name,design,color,slot:'head',family:'headgear',tier:1+Math.floor(i/10),price:18+i*4,bonuses:{[key]:value},proc:procs[design]||null,description:`${key==='hp'?'+':'+ '+Math.round(value*100)+'% '}${key==='hp'?value+' ':''}${label[key]}${procs[design]?' · Hits apply '+procs[design]+'.':''}`}));
export const headgearById=id=>HEADGEAR.find(h=>h.id===id);
