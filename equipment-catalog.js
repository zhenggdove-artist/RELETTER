// Public, immutable item definitions. Prices and combat stats are rechecked by the server.
export const DEFAULT_WEAPON={id:'water',name:'Garden Water',slot:'weapon',family:'water',color:'#73dfff',damage:1,range:18,radius:.12,cooldown:650,chargeDamage:5,chargeRange:24,price:0,tier:0};
const families=[
 ['tide','Tide','water','#63dcff',1,20,.22,650],
 ['frost','Glacier','ice','#a9edff',1.4,16,.4,900],
 ['ember','Ember','fire','#ff9c50',1.6,10,.8,1000],
 ['storm','Storm','lightning','#c4b2ff',1.2,24,.18,700],
 ['prism','Prism','beam','#ffe8a0',1.8,30,.12,1400],
 ['bloom','Bloom','petal','#ff9ed5',.8,12,1.4,800],
 ['nova','Nova','wave','#95ffe0',1.5,8,1.8,1600],
 ['saber','Starlight','saber','#c5a8ff',2,3,1.2,850]
];
const ranks=['Seed','Dawn','Radiant','Celestial','Eternal'];
export const EQUIPMENT=families.flatMap(([id,name,family,color,damage,range,radius,cooldown],f)=>ranks.map((rank,i)=>({id:id+'-'+(i+1),name:rank+' '+name,slot:'weapon',family,color,tier:i+1,price:[5,15,35,70,120][i]+f*2,damage:+(damage+i*.45).toFixed(2),chargeDamage:+(damage*2+i*.8).toFixed(2),range:range+i*(family==='saber'?.35:2),chargeRange:family==='saber'?1:8+i*2,radius:+(radius+i*.12).toFixed(2),cooldown:cooldown-i*35})));
const shieldNames=['Dew Veil','Petal Guard','Moon Shell','Crystal Ward','Aurora Aegis','Tidal Bastion','Star Sanctuary','Prismatic Halo','Celestial Dome','Eternal Garden'];
EQUIPMENT.push(...shieldNames.map((name,i)=>({id:'shield-'+(i+1),name,slot:'shield',family:'shield',color:['#9cecff','#ffacd9','#cab6ff','#b2ffe6','#fff0a8'][i%5],tier:Math.ceil((i+1)/2),price:8+i*12,capacity:2+i*.75,recharge:Math.max(7,16-i),damage:0,range:0,radius:1.4,cooldown:0})));
export const equipmentById=id=>id==='water'?DEFAULT_WEAPON:EQUIPMENT.find(x=>x.id===id);
