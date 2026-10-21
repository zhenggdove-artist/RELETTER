export const FISH_NAMES=['Pearl Medaka','Sunset Guppy','Blue Neon Tetra','Cherry Barb','Zebra Danio','Amber Rasbora','Silver Minnow','Peacock Gudgeon','Honey Gourami','Moon Platy','Scarlet Betta','Marble Angelfish','Turquoise Discus','Firemouth Cichlid','Leopard Cory','Golden Loach','Ruby Rainbowfish','Emerald Killifish','Black Phantom','Copper Swordtail','Kohaku Koi','Sanke Koi','Showa Koi','Butterfly Koi','Shusui Koi','Oranda Goldfish','Calico Ryukin','Black Moor','Pearlscale Goldfish','Redcap Ranchu','Rainbow Trout','Brook Trout','Golden Tench','Tiger Perch','Jade Bass','Silver Arowana','Spotted Gar','Albino Sturgeon','Celestial Catfish','Royal Pike','Mandarin Dragonet','Regal Tang','Emperor Angelfish','Copperband Butterfly','Flame Anthias','Moonlight Lionfish','Opal Seahorse','Ribbon Dragonfish','Aurora Sailfish','Astral Lanternfish'];
const shapes=['minnow','guppy','tetra','barb','danio','rasbora','minnow','gudgeon','gourami','platy','betta','angel','discus','cichlid','catfish','loach','rainbow','killifish','tetra','swordtail','koi','koi','koi','butterfly','koi','oranda','ryukin','moor','pearlscale','ranchu','trout','trout','tench','perch','bass','arowana','gar','sturgeon','catfish','pike','mandarin','tang','emperor','butterfly','anthias','lionfish','seahorse','ribbon','sailfish','lantern'];
const colors=[['#c5edee','#f2c6a0','#577f98'],['#ffc37b','#ed658d','#664b9a'],['#71ddff','#ed446b','#1d4669'],['#df5c72','#f8dbaa','#563952'],['#a8bcd5','#f6e3b4','#273c69'],['#eab374','#f8e8bc','#694b51'],['#c4e1d9','#ede8ca','#467c82'],['#62c6c1','#f2ba64','#494d89'],['#efc26b','#f8eabb','#9d613c'],['#e6cce9','#f4efdc','#7977b1']];
const speciesPalettes=[
['#dcebed','#fff2d4','#7597a1'],['#fbba6a','#ffe4b9','#c34579'],['#137ad5','#74faff','#b42648'],['#ce3f4b','#ffa584','#602a32'],['#8da4c7','#f6dda3','#263960'],['#c77a3e','#f9d584','#473b35'],['#b0c5cf','#f3f4dd','#4c717e'],['#32ada9','#f5d06e','#b94d85'],['#e0a348','#ffe19d','#9c4f30'],['#dad4dc','#fff1d3','#7196af'],
['#9c1c56','#fa7b9a','#322a75'],['#b7c7d1','#f7efdd','#25394a'],['#11889e','#82e8d5','#d33d4b'],['#69a3aa','#e96853','#344954'],['#b4afa4','#f2e6ce','#484b45'],['#cda446','#fff0a3','#886829'],['#0b9984','#f4bb49','#293b72'],['#209b7d','#e4d26e','#324f85'],['#73869b','#bed7d9','#273547'],['#ce743b','#ffd17f','#774931'],
['#e9e4d9','#fff8e9','#bd392e'],['#dddcd0','#fff6df','#ad3229'],['#343b40','#f2e7d4','#cc4937'],['#e6c99a','#fff8df','#be734e'],['#76a0b4','#e8e1cc','#da684b'],['#e6a864','#f8e5b8','#bd4235'],['#d9c1a1','#fff2ca','#625854'],['#272d39','#6f7b91','#101a2c'],['#e2b78c','#fff0c7','#b67447'],['#e4d9b4','#fff6e4','#c33d3b'],
['#6a9e96','#e6e6c8','#c17f9b'],['#568b72','#e1d596','#304747'],['#a8933d','#efd78e','#575a34'],['#749155','#dfc575','#273d38'],['#5e8773','#cdd5aa','#324d42'],['#a8bdbb','#f3eed3','#5c8188'],['#829a7a','#ded6a9','#354e44'],['#b4b8b0','#faf2cf','#607b7c'],['#88baba','#d8efe4','#4c6289'],['#7f9c67','#dedc9b','#3d5a45'],
['#1a9cbd','#f8ac35','#e65a35'],['#275eac','#f8d74a','#142d60'],['#388ab1','#ffe185','#233452'],['#eee3c2','#fff6df','#d48b42'],['#e9868e','#fbb873','#944c82'],['#b68578','#f9e0bb','#553e51'],['#76b7b0','#e5ead0','#638897'],['#7e95bd','#ead9f6','#5b588a'],['#587aaf','#a4ebeb','#353d69'],['#6e5c9f','#e4c8f0','#253b68']];
export const FISH=FISH_NAMES.map((name,i)=>({id:'fish-'+(i+1),name,shape:shapes[i],index:i,rarity:Math.floor(i/10)+1,colors:speciesPalettes[i],minKg:+(.04+(i%10)*.025+Math.floor(i/10)*.32).toFixed(2),maxKg:+(.3+(i%10)*.16+Math.floor(i/10)**2*.6).toFixed(2),value:4+Math.floor(i/10)**2*9+(i%10)*2,pattern:i%7,temper:.8+(i%5)*.12}));
// Crimson springs have their own pool; these species never roll in ordinary water.
export const ABYSSAL_FISH=[
 ['crimson-koi','Crimson Crown Koi','koi',6,['#b6234b','#ffd7a1','#311c4f'],4,18,380],
 ['ruby-arowana','Ruby Veil Arowana','arowana',6,['#901f52','#ffbbcb','#202350'],6,25,420],
 ['bloodmoon-ray','Bloodmoon Manta','manta',6,['#563076','#f5b6d3','#111f40'],8,32,510],
 ['reliquary-sturgeon','Reliquary Sturgeon','sturgeon',6,['#43657d','#f8e3b1','#291c48'],12,40,580],
 ['abyss-oracle','Abyssal Oracle','oracle',7,['#325f70','#9ffff0','#322242'],9,30,850],
 ['veil-empress','Veil Empress','jelly',7,['#6c3884','#ffb9e0','#1d2858'],5,22,920],
 ['cathedral-nautilus','Cathedral Nautilus','nautilus',7,['#3d747c','#ffe3ab','#3d1b50'],12,36,1050],
 ['thorn-seraph','Thorn Seraph','seraph',7,['#5c3f84','#b4ffed','#30153b'],8,28,1150],
 ['elder-leviathan','Elder Leviathan','leviathan',7,['#216a72','#a0fbe5','#291b46'],18,55,1400],
 ['dream-devourer','Dream Devourer','cthulhu',7,['#385b69','#dcc6ff','#311d4b'],25,65,1800]
].map(([id,name,shape,rarity,colors,minKg,maxKg,value],i)=>({id,name,shape,rarity,colors,minKg,maxKg,value,index:50+i,pattern:i%7,temper:1.15+i*.035,redOnly:true,eldritch:i>=4}));
FISH.push(...ABYSSAL_FISH);
export const CHISELS=[
 {id:'chisel',name:'Garden Chisel',tier:1,depth:1,price:10,color:'#c9c4b9'},
 {id:'chisel-2',name:'Steel Chisel',tier:2,depth:3,price:40,color:'#9fc7d7'},
 {id:'chisel-3',name:'Moonstone Chisel',tier:3,depth:7,price:100,color:'#a9b6ee'},
 {id:'chisel-4',name:'Obsidian Chisel',tier:4,depth:14,price:220,color:'#655a97'},
 {id:'chisel-5',name:'Eclipse Chisel',tier:5,depth:28,price:450,color:'#c65582',redChance:.25}
].map(c=>({...c,slot:'tool',family:'chisel',redChance:c.redChance||0}));
export function selectedChisel(owned=[],equipped){const selected=CHISELS.find(c=>c.id===equipped&&owned.includes(c.id));return selected||[...CHISELS].reverse().find(c=>owned.includes(c.id));}
export const fishById=id=>FISH.find(f=>f.id===id);
export const RODS=Array.from({length:20},(_,i)=>({id:'rod-'+(i+1),name:['Willow','Reed','Cedar','Silk','Pearl','Jade','Coral','Opal','Moon','Aurora','Sapphire','Lotus','Obsidian','Starlit','Celestial','Prismatic','Abyssal','Seraph','Eclipse','Eternal'][i]+' Rod',slot:'rod',family:'rod',tier:i+1,color:['#91cbb4','#b7bbf3','#f1c084','#ea9dbb'][i%4],price:8+i*7+Math.floor(i*i*.7),power:1.2+i*.55,control:.18+i*.022,luck:i/19,hookWindow:1900+i*80,biteDelay:Math.max(2200,6500-i*180)}));
export const FISHING_TOOLS=[...CHISELS,{id:'pond-kit',name:'Glass Aquarium',slot:'pond',family:'pond',tier:1,color:'#8bd1cb',price:35},...RODS];
export const fishingById=id=>FISHING_TOOLS.find(x=>x.id===id);
export const fishPrice=fish=>Math.max(1,Math.round((fishById(fish.species)?.value||1)*(1+fish.kg*.24)));

export const AQUARIUM_SIZES={small:{label:'Small',size:[3,1.4,2],price:15,capacity:30},medium:{label:'Medium',size:[5,2.1,3],price:45,capacity:60},large:{label:'Large',size:[7,2.8,4],price:100,capacity:100},abyssal:{label:'Abyssal',size:[20,12,16],price:600,capacity:6},titan:{label:'Titan',size:[30,18,24],price:1500,capacity:12}};

const abyssDimensions=[[7,6,6],[9,8,8],[8,7,7],[12,9,8],[14,11,9],[15,12,11]];
export function fishDimensions(fish){const s=fishById(fish.species||fish.id);return s?.eldritch?[...abyssDimensions[s.index-54]]:[1.3,1,.5];}
export function aquariumFit(pond,fish){
 const size=pond.size||[6,2.1,4],d=fishDimensions(fish);
 if(d.some((v,i)=>(i!==1&&fishById(fish.species||fish.id)?.eldritch?Math.hypot(d[0],d[2]):v)>(i===1?size[i]*.78:size[i]-1.2)))return 'Needs a larger aquarium · '+d.join(' × ')+' m';
 if(fishById(fish.species)?.eldritch){const used=(pond.fish||[]).filter(f=>fishById(f.species)?.eldritch).reduce((sum,f)=>sum+fishDimensions(f).reduce((a,b)=>a*b,1),0),volume=d.reduce((a,b)=>a*b,1);if(used+volume>size[0]*size[1]*size[2]*.35)return 'Not enough swimming space for another giant';}
 return null;
}
export function chooseFishingHole(holes,position,preferred=null){
 const distance=h=>Math.hypot(h.position[0]-position[0],h.position[2]-position[2]);
 const reachable=holes.filter(h=>distance(h)<=6&&Math.abs(h.position[1]-position[1])<3);
 return reachable.find(h=>h.id===preferred)||reachable.sort((a,b)=>distance(a)-distance(b))[0]||null;
}
