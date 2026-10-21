import {FISHING_TOOLS} from './fishing-catalog.js';
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
export const EQUIPMENT=families.flatMap(([id,name,family,color,damage,range,radius,cooldown],f)=>ranks.map((rank,i)=>({id:id+'-'+(i+1),name:rank+' '+name,slot:'weapon',family,color,tier:i+1,price:[5,15,35,70,120][i]+f*2,damage:+(damage+i*.45).toFixed(2),chargeDamage:+(damage*2+i*.8).toFixed(2),range:range*[1,1.3,1.75,2.4,3.2][i],chargeRange:family==='saber'?1:8+i*2,radius:+(radius*[1,1.6,2.5,3.8,5.5][i]).toFixed(2),cooldown:cooldown-i*35})));
const shieldNames=['Dew Veil','Petal Guard','Moon Shell','Crystal Ward','Aurora Aegis','Tidal Bastion','Star Sanctuary','Prismatic Halo','Celestial Dome','Eternal Garden'];
EQUIPMENT.push(...shieldNames.map((name,i)=>({id:'shield-'+(i+1),name,slot:'shield',family:'shield',color:['#9cecff','#ffacd9','#cab6ff','#b2ffe6','#fff0a8'][i%5],tier:Math.ceil((i+1)/2),price:8+i*12,capacity:2+i*.75,recharge:Math.max(7,16-i),damage:0,range:0,radius:1.4,cooldown:0})));
EQUIPMENT.push(...ranks.map((rank,i)=>({id:'whip-'+(i+1),name:rank+' Thornweave',slot:'weapon',family:'whip',color:['#f3a4d4','#93e6d4','#d5b3ff','#ffd090','#c7eaff'][i],tier:i+1,price:12+i*24,damage:1.8+i*.5,chargeDamage:4+i,range:5+i*1.5,chargeRange:2,radius:1.5+i*.65,cooldown:1000-i*30})),...FISHING_TOOLS);
const gardenMelee=[['swatter','Fly Swatter','#9be6dc',1.3,3.4,630],['pan','Frying Pan','#e9bc7b',3,3.1,1120],['planter','Potted Plant','#e2a8d7',3.8,3.5,1350],['palm','Coconut Palm','#97d59b',4.5,5.2,1500]];
for(const [family,name,color,damage,range,cooldown] of gardenMelee)EQUIPMENT.push(...ranks.map((rank,i)=>({id:family+'-'+(i+1),name:rank+' '+name,slot:'weapon',family,color,tier:i+1,price:[12,30,65,110,180][i],damage:+(damage+i*.65).toFixed(2),chargeDamage:+(damage*2.2+i).toFixed(2),range:range*(1+i*.35),chargeRange:2+i*.3,radius:1.2+i*.45,cooldown:cooldown-i*20})));
export const equipmentById=id=>id==='water'?DEFAULT_WEAPON:EQUIPMENT.find(x=>x.id===id);

// Shared client/server cadence and rank identity for rapid, buffered melee chains.
for(const item of EQUIPMENT)if(['saber','whip','swatter','pan','planter','palm'].includes(item.family)){
 item.color=['#73e5ff','#73ffc1','#b68aff','#ffae55','#ff78d9'][item.tier-1];
 item.cooldown=({saber:300,whip:320,swatter:260,pan:340,planter:360,palm:380}[item.family])-(item.tier-1)*15;
 item.range=+(item.range*1.2).toFixed(2);item.radius=+(item.radius*1.3).toFixed(2);
}
