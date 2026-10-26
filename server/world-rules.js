import {ensureMilk,withMilkBoss,refreshMilk,summonMilkBoss,milkView,MILK_COOLDOWN} from './milk-encounter.js';
import {elementMultiplier} from '../elements.js';
import {gardenView,dropWings} from './garden-rules.js';
import {tickPlayerPoison,enemySpeed,updateEnemySkills,requestDodge,moveDodge} from './enemy-skills.js';
import {activeWeapon} from '../combat-traits.js';
import {applyWeaponTraits,tickCombatEffects,effectActive} from './combat-effects.js';
import {meleeDuration} from '../melee-motion.js';
import {awardKill} from '../progression.js';
import {validSurfaceId} from './surface-rules.js';
import {dropWeapon,dropOutfit,fishingView} from './fishing-rules.js';
// Shared, server-owned encounter and persistent construction rules.
import {blockSize,validBlockSize} from '../build-shapes.js';
export {blockSize};
// One roll per encounter, owned by the server and persisted in the shared world.
export const BOSS_VARIANTS=[
 {tier:'Wanderer',level:1,maxHp:100,damage:1,speed:1,weight:.15,element:'earth'},
 {tier:'Hunter',level:5,maxHp:240,damage:1,speed:1.08,weight:.15,element:'wind'},
 {tier:'Elder',level:12,maxHp:600,damage:2,speed:1.16,weight:.18,element:'water'},
 {tier:'Dread',level:24,maxHp:1400,damage:2,speed:1.24,weight:.15,element:'fire'},
 {tier:'Archon',level:30,maxHp:2200,damage:3,speed:2.5,weight:.15,element:'light'},
 {tier:'Ancient',level:40,maxHp:3000,damage:3,speed:1.32,weight:.10,element:'dark'},
 ...[[60,.04],[100,.03],[150,.02],[220,.02],[300,.01]].map(([level,weight])=>({tier:'Ascendant',level,weight,maxHp:Math.round(3000*(level/40)**1.6),damage:Math.ceil(3*(level/40)**.65),speed:enemySpeed(level),element:['wind','water','fire','earth','light','dark'][Math.floor(level/10)%6]}))
];
export function rollBoss(rng=Math.random){let r=rng();const variant=BOSS_VARIANTS.find(v=>(r-=v.weight)<0)||BOSS_VARIANTS.at(-1);const {weight,...stats}=variant;return {...stats,speed:enemySpeed(stats.level),hp:stats.maxHp};}
export function ensureWorld(g){g.progression??={};g.blocks??=[];g.buildRevision??=0;g.worldRevision??=0;g.boss??={hp:100,maxHp:100,position:[40,0,0],revision:0,generation:1};g.pkMode??=false;g.redMode=!g.pkMode;g.boss.tick??=0;g.boss.maxHp??=100;g.boss.level??=1;g.boss.tier??='Wanderer';g.boss.element??=BOSS_VARIANTS.find(v=>v.level===g.boss.level)?.element||'earth';g.boss.damage??=1;g.boss.speed??=1;const first=!g.milkEncounter,e=ensureMilk(g);if(first&&g.boss.kind==='foreman'){const oldGeneration=g.boss.generation||0;if(g.boss.hp>0){e.phase='active';e.boss=g.boss;e.boss.generation=1000000000+e.cycle;}else{e.phase='cooldown';e.respawnAt=Date.now()+MILK_COOLDOWN;}g.boss={...rollBoss(),position:[40,0,0],revision:0,generation:oldGeneration+1};g.pendingBossHits=[];}return g;}
export function resetEncounter(g,now=Date.now(),rng=Math.random){ensureWorld(g);g.pkMode=false;g.redMode=true;g.boss={...rollBoss(rng),position:[40,0,0],revision:0,generation:g.boss.generation+1};g.pendingBossHits=[];g.bossClock=now;}
export function activateEncounter(g,text,name){
 ensureWorld(g);const command=text.trim().toLowerCase();
 if(command==='/show me the money'&&['Ely','Rae'].includes(name)){g.wallets??={};g.wallets[name]=(g.wallets[name]||0)+100;g.worldRevision++;return true;}
 if(command==='/auntie back'){const pk=g.pkMode;resetEncounter(g);g.pkMode=pk;g.redMode=!pk;g.worldRevision++;return true;}
 if(command==='/pk'){g.pkMode=!g.pkMode;g.redMode=!g.pkMode;g.worldRevision++;return true;}
 if(command!=='/一起打阿姨')return false;g.pkMode=false;g.redMode=true;g.worldRevision++;return true;
}
export function worldView(g){ensureWorld(g);return {fusionRestoration:g.fusionRestoration,tokenSummons:(g.tokenSummons||[]).map(({weapon,...s})=>s),milkEncounter:milkView(g),playerEffects:g.playerEffects||{},deaths:g.deaths||{},garden:gardenView(g),wingDrops:g.wingDrops||[],enemyHitEvents:g.enemyHitEvents||{},weaponInstances:g.weaponInstances||{},combatBuffs:g.combatBuffs||{},progression:g.progression,fishing:fishingView(g),weaponDrops:g.weaponDrops,worldRevision:g.worldRevision,wallets:g.wallets||{},hits:g.hits||{},loot:g.loot||[],redMode:g.redMode,pkMode:g.pkMode,boss:g.boss,destructions:g.destructions||[],blocks:g.blocks,buildRevision:g.buildRevision,inventories:g.inventories||{},equipment:g.equipment||{},shields:g.shields||{},equipmentRevision:g.equipmentRevision||0};}
export function containsBlock(b,x,y,z,padding=0){const [w,h,d]=blockSize(b),p=b.position;if(y<p[1]||y>=p[1]+h)return false;if(b.shape==='cylinder')return Math.hypot(x-p[0],z-p[2])<w/2+padding;return Math.abs(x-p[0])<w/2+padding&&Math.abs(z-p[2])<d/2+padding;}
export function advanceBoss(g,players,now=Date.now()){
 ensureWorld(g);refreshMilk(g,now);tickPlayerPoison(g,players,now);flushMilkHits(g,now);advanceSingleBoss(g,players,now);if(g.milkEncounter.phase==='active')withMilkBoss(g,()=>advanceSingleBoss(g,players,now));advanceTokenSummons(g,players,now);
}
function advanceSingleBoss(g,players,now=Date.now()){
 ensureWorld(g);const dt=Math.max(0,Math.min(.25,(now-(g.bossClock||now))/1000));g.bossClock=now;g.boss.tick++;flushBossHits(g,now);const dot=tickCombatEffects(g,now);if(dot.killer)finishBoss(g,dot.killer,now);g.boss.paused=players.some(p=>p.state?.paused);
 if(g.boss.hp<=0){if(g.boss.kind==='foreman')return;g.boss.respawnAt??=now+30000;if(now<g.boss.respawnAt||!players.length)return;const pk=g.pkMode;resetEncounter(g,now);g.pkMode=pk;g.redMode=!pk;g.worldRevision++;g.boss.paused=players.some(p=>p.state?.paused);}
 if(updateForemanSign(g,now,dt))return;
 const disabled=['stun','root','fear'].some(k=>effectActive(g.boss,k,now));updateEnemySkills(g,players,now,dt,disabled);
 if(g.boss.paused)return;if(g.boss.kind==='foreman'&&g.boss.skills.some(s=>['timber-fall','dark-stomp'].includes(s.type)&&(s.phase==='warning'||now-s.start<900)))return;if(disabled)delete g.boss.dodge;else if(moveDodge(g.boss,now))return;
 const pos=g.boss.position,targets=players.filter(p=>p.state?.visible&&p.state.phase===2&&Math.hypot(p.state.position[0]-pos[0],p.state.position[2]-pos[2])<=45);
 targets.sort((a,b)=>Math.hypot(a.state.position[0]-pos[0],a.state.position[2]-pos[2])-Math.hypot(b.state.position[0]-pos[0],b.state.position[2]-pos[2]));
 g.boss.target=targets[0]?.character||null;if(!targets.length){g.boss.chasing=false;return;}const t=targets[0].state.position;let dx=t[0]-pos[0],dz=t[2]-pos[2],distance=Math.hypot(dx,dz);const fear=effectActive(g.boss,'fear',now);g.boss.chasing=distance<8;if(effectActive(g.boss,'root',now)||effectActive(g.boss,'stun',now))return;if(fear){const a=Math.atan2(-dx,-dz)+Math.sin(now/160)*.9;dx=Math.sin(a)*8;dz=Math.cos(a)*8;distance=8;}else if(distance<1.3)return;
 const step=Math.min(distance-1.3,(fear?6:distance<8?4.5:1.25)*enemySpeed(g.boss.level)*(g.boss.power||1)*(1-(effectActive(g.boss,'slow',now)?.power||0))*dt),nx=pos[0]+dx/distance*step,nz=pos[2]+dz/distance*step;
 const free=(x,z)=>!g.blocks.some(b=>b.position[1]<12&&containsBlock(b,x,b.position[1]+.5,z,1.1));
 if(free(nx,nz)){pos[0]=nx;pos[2]=nz;}else if(free(nx,pos[2]))pos[0]=nx;else if(free(pos[0],nz))pos[2]=nz;
 g.boss.rotation=Math.atan2(dx,dz);
}
export function buildAction(g,actor,players,body,now=Date.now()){
 ensureWorld(g);const pos=actor.state?.position;if(!pos||!actor.state.visible)return {error:'Enter the garden first'};
 if(body.action==='destroy'){
  const i=g.blocks.findIndex(b=>b.id===body.id);if(i<0)return {error:'Block no longer exists'};
  if(Math.hypot(...g.blocks[i].position.map((v,j)=>v-pos[j]))>18)return {error:'Move closer to the block'};
  g.blocks.splice(i,1);g.buildRevision++;return {};
 }
 if(!['cube','bar','cylinder'].includes(body.shape))return {error:'Choose a block shape'};
 const p=body.position;if(!Array.isArray(p)||p.length!==3||!p.every(n=>Number.isFinite(n)&&Math.abs(n)<=500&&Math.abs(n*2-Math.round(n*2))<.001)||p[1]<0||p[1]>40)return {error:'Choose a valid grid position'};
 if(Math.hypot(...p.map((v,i)=>v-pos[i]))>14)return {error:'Build within 14 metres'};
 const size=body.size??(body.shape==='bar'?[6,1,2]:[2,1,2]);if(!validBlockSize(size)||(body.shape==='cylinder'&&size[0]!==size[2]))return {error:'Invalid block dimensions'};
 if(body.surface&&!validSurfaceId(body.surface))return {error:'Invalid skin'};
 const block={surface:body.surface||null,surfaceRevision:0,size:[...size],id:crypto.randomUUID(),shape:body.shape,rotation:body.rotation===1?1:0,position:[...p],color:/^#[0-9a-f]{6}$/i.test(body.color||'')?body.color:'#c6a5dc',createdAt:now};
 const [w,h,d]=blockSize(block),overlap=(b,vertical=true)=>{const [bw,bh,bd]=blockSize(b);return Math.abs(p[0]-b.position[0])<(w+bw)/2-.01&&Math.abs(p[2]-b.position[2])<(d+bd)/2-.01&&(!vertical||(p[1]<b.position[1]+bh-.01&&p[1]+h>b.position[1]+.01));};
 if(Math.hypot(p[0]-g.milkEncounter.position[0],p[2]-g.milkEncounter.position[2])<4+Math.max(w,d)/2)return {error:'Leave the milk shrine clear'};
 if(g.blocks.some(b=>overlap(b)))return {error:'This space is occupied'};
 if([...(g.fishing?.holes||[]),...(g.fishing?.ponds||[])].some(f=>p[1]<1&&Math.abs(p[0]-f.position[0])<w/2+f.radius&&Math.abs(p[2]-f.position[2])<d/2+f.radius))return {error:'Leave the water feature clear'};
 if(p[1]>0&&!g.blocks.some(b=>Math.abs(b.position[1]+blockSize(b)[1]-p[1])<.01&&overlap(b,false)))return {error:'Stack on the ground or an existing block'};
 if(players.some(player=>player.state?.visible&&player.state.position[1]<p[1]+h&&player.state.position[1]+1.5>p[1]&&containsBlock(block,player.state.position[0],p[1]+h/2,player.state.position[2],.5)))return {error:'A player is standing here'};
 if(g.blocks.length>=2000)return {error:'The garden has reached its block limit'};
 g.blocks.push(block);g.buildRevision++;return {block};
}
// Ray/slab intersection; cylinder footprints use their actual circular side/caps.
export function rayBlock(b,origin,direction){
 const [w,h,d]=blockSize(b),p=b.position;let near=0,far=Infinity;
 for(let i=0;i<3;i++){const lo=p[i]-(i===0?w/2:i===2?d/2:0),hi=lo+[w,h,d][i];if(Math.abs(direction[i])<1e-8){if(origin[i]<lo||origin[i]>hi)return Infinity;continue;}let a=(lo-origin[i])/direction[i],c=(hi-origin[i])/direction[i];if(a>c)[a,c]=[c,a];near=Math.max(near,a);far=Math.min(far,c);if(near>far)return Infinity;}
 if(b.shape!=='cylinder')return near;
 const ox=origin[0]-p[0],oz=origin[2]-p[2],a=direction[0]**2+direction[2]**2,c=ox*ox+oz*oz-(w/2)**2,bb=2*(ox*direction[0]+oz*direction[2]);
 if(a<1e-8)return c<=0?near:Infinity;const disc=bb*bb-4*a*c;if(disc<0)return Infinity;
 near=Math.max(near,(-bb-Math.sqrt(disc))/(2*a));far=Math.min(far,(-bb+Math.sqrt(disc))/(2*a));return far>=near?near:Infinity;
}
export function coverDistance(g,origin,direction){return Math.min(direction[1]<-1e-6?Math.max(0,origin[1]/-direction[1]):Infinity,...(g.milkEncounter?.phase==='sealed'?[rayBlock({shape:'cylinder',position:g.milkEncounter.position,size:[5,9,5]},origin,direction)]:[]),...(g.blocks||[]).map(b=>rayBlock(b,origin,direction)),...(g.fishing?.ponds||[]).map(p=>rayBlock({shape:'cube',position:p.position,size:p.size||[6,2.1,4]},origin,direction)));}
function bossIntersection(g,shot){
 const p=g.boss.position,padding=Math.max(0,(shot.radius||.12)-.12),foreman=g.boss.kind==='foreman';
 const angle=-(g.boss.rotation||0),dx=shot.origin[0]-p[0],dz=shot.origin[2]-p[2],c=Math.cos(angle),sn=Math.sin(angle),origin=[dx*c+dz*sn,shot.origin[1]-p[1],-dx*sn+dz*c],direction=[shot.direction[0]*c+shot.direction[2]*sn,shot.direction[1],-shot.direction[0]*sn+shot.direction[2]*c];
 // Keep ground-level legs narrow; shoulders/arms and head have separate upper volumes.
 const boxes=foreman?[[0,[8,16,8]],[16,[18,17,16]],[33,[10,9,10]]]:[[0,[5.6,12,5.6]],[12,[20,30,36]]];
 const along=Math.min(...boxes.map(([y,size])=>rayBlock({position:[0,y-padding,0],size:size.map(v=>v+padding*2)},origin,direction)));
 const center=p.reduce((sum,v,i)=>sum+(v+(i===1?Math.max(1,Math.min(40,origin[1])):0)-shot.origin[i])*shot.direction[i],0),cover=coverDistance(g,shot.origin,shot.direction);if(!Number.isFinite(along)||along>shot.range||center<-(foreman?9:2.8)||cover+.001<Math.max(along,origin[1]<12?center-(foreman?4:2.8):along))return null;return along;
}
function finishBoss(g,name,now){if(g.boss.rewarded)return;g.boss.rewarded=true;g.boss.skills=[];g.boss.minions=[];if(g.boss.kind==='foreman'){const e=ensureMilk(g);e.phase='cooldown';e.defeats++;e.respawnAt=now+MILK_COOLDOWN;e.pendingHits=[];}else g.boss.respawnAt=now+30000;awardKill(g,name);dropWeapon(g,now);dropOutfit(g,now);dropWings(g,now);g.loot??=[];const count=2+Math.floor(g.boss.level/5);for(let i=0;i<count;i++){const a=i*Math.PI*2/count,r=2+(i%3)*.8;g.loot.push({id:crypto.randomUUID(),kind:'coin-bag',position:[g.boss.position[0]+Math.cos(a)*r,0,g.boss.position[2]+Math.sin(a)*r],amount:2+Math.ceil(g.boss.level/4)+Math.floor(g.boss.level*g.boss.level/100),owner:null,time:now});}g.worldRevision++;}
export function attackContactDelay(shot){if(shot.ultimate)return shot.family==='saber'?720:900;if(['saber','whip','swatter','pan','planter','palm'].includes(shot.family))return Math.round(meleeDuration(shot.family,shot.combo||0)*500);return shot.weapon==='water'?650+Math.round((shot.charge||0)*300):618;}
function shootSingleBoss(g,shot,now=Date.now()){
 shot.red=true;if(g.boss.hp<=0)return;const minion=(g.boss.minions||[]).filter(m=>m.hp>0).map(m=>({m,d:rayBlock({position:m.position,size:[2,2.5,2]},shot.origin,shot.direction)})).filter(x=>x.d<=shot.range&&x.d<coverDistance(g,shot.origin,shot.direction)).sort((a,b)=>a.d-b.d)[0];const bossAlong=bossIntersection(g,shot);if(minion&&(bossAlong===null||minion.d<bossAlong)){shot.hit='Minion';shot.impact=shot.origin.map((v,i)=>v+shot.direction[i]*minion.d);shot.contactDelay=attackContactDelay(shot);g.pendingBossHits??=[];g.pendingBossHits.push({shot:{...shot},minionId:minion.m.id,due:now+shot.contactDelay,generation:g.boss.generation});return;}const along=bossAlong;if(along===null)return;
 shot.impact=shot.origin.map((v,i)=>v+shot.direction[i]*along);shot.hit='Auntie';shot.contactDelay=attackContactDelay(shot);requestDodge(g,shot,now,!!g.boss.sign||['stun','root','fear','slow'].some(k=>effectActive(g.boss,k,now)));
 const weapon=activeWeapon(g,shot.shooter);g.pendingBossHits??=[];g.pendingBossHits.push({shot:{...shot},weapon:{...weapon},due:now+shot.contactDelay,generation:g.boss.generation});
}
export function flushBossHits(g,now=Date.now()){
 const pending=g.pendingBossHits||[];g.pendingBossHits=[];
 for(const event of pending){if(event.generation!==g.boss.generation||g.boss.hp<=0)continue;if(event.due>now){g.pendingBossHits.push(event);continue;}
  if(event.minionId){const m=g.boss.minions?.find(m=>m.id===event.minionId);if(m&&rayBlock({position:m.position,size:[2,2.5,2]},event.shot.origin,event.shot.direction)<=Math.min(event.shot.range,coverDistance(g,event.shot.origin,event.shot.direction))){m.hp=Math.max(0,m.hp-event.shot.damage*elementMultiplier(event.shot.element,m.element));m.flash=now;g.worldRevision++;}continue;}
  const {shot,weapon}=event,along=bossIntersection(g,shot);if(along===null)continue;const impact=shot.origin.map((v,i)=>v+shot.direction[i]*along);if(Math.hypot(...impact.map((v,i)=>v-shot.impact[i]))>Math.max(2.8,shot.radius||0))continue;
  const crit=(weapon.affixIds||[weapon.affixId]).includes('brutal')&&Math.random()<.25?1.8:1,damage=(shot.damage??(1+Math.floor(4*shot.charge)))*(1+(effectActive(g.boss,'expose',event.due)?.power||0))*crit*elementMultiplier(shot.element,g.boss.element);
  g.boss.hp=Math.max(0,+(g.boss.hp-damage).toFixed(2));g.boss.revision++;g.boss.lastHit=now;updateForemanSign(g,now,0);applyWeaponTraits(g,weapon,shot,event.due);
  if(shot.knockback){const p=g.boss.position,n=p.map((v,i)=>v+shot.knockback[i]);if(!g.blocks.some(b=>containsBlock(b,n[0],b.position[1]+.5,n[2],1.1)))g.boss.position=n;}
  g.worldRevision++;if(!g.boss.hp)finishBoss(g,shot.shooter,now);
 }
}

export function shootConstruction(g,shot,now=Date.now()){
 if(shot.hit)return;
 const candidates=[...(g.blocks||[]).map(row=>({row,kind:'block',distance:rayBlock(row,shot.origin,shot.direction)})),...(g.fishing?.ponds||[]).map(row=>({row,kind:'pond',distance:rayBlock({shape:'cube',position:row.position,size:row.size||[6,2.1,4]},shot.origin,shot.direction)}))];
 const target=candidates.filter(c=>Number.isFinite(c.distance)&&c.distance<=shot.range&&c.distance<=coverDistance(g,shot.origin,shot.direction)+.001).sort((a,b)=>a.distance-b.distance)[0];if(!target)return;
 const {row,kind,distance}=target;
 row.maxHits??=kind==='pond'?10:3+[...row.id].reduce((n,c)=>n+c.charCodeAt(0),0)%3;
 row.hits=Math.min(row.maxHits,(row.hits||0)+1);row.lastHit=now;
 const destroyed=row.hits===row.maxHits;
 shot.hit=kind==='pond'?'Aquarium':'Block';shot.impact=shot.origin.map((v,i)=>v+shot.direction[i]*distance);
 shot.structureHit={id:row.id,kind,hits:row.hits,maxHits:row.maxHits,destroyed};
 if(kind==='block'){if(destroyed)g.blocks=g.blocks.filter(b=>b.id!==row.id);g.buildRevision++;}
 else {if(destroyed)g.fishing.ponds=g.fishing.ponds.filter(p=>p.id!==row.id);g.fishing.revision++;}
 if(destroyed){g.destructions??=[];g.destructions.push({id:row.id,kind,position:row.position,size:kind==='pond'?row.size||[6,2.1,4]:blockSize(row),color:row.color||'#a7daed',time:now});g.destructions=g.destructions.slice(-12);}
}

function targetDistance(g,shot){const d=g.boss?.hp>0?bossIntersection(g,shot):null;return Math.min(d??Infinity,...(g.boss?.minions||[]).filter(m=>m.hp>0).map(m=>rayBlock({position:m.position,size:[2,2.5,2]},shot.origin,shot.direction)).filter(v=>v<=shot.range&&v<=coverDistance(g,shot.origin,shot.direction)));}
function milkDistance(g,shot){const e=ensureMilk(g),padding=Math.max(0,(shot.radius||.12)-.12),d=rayBlock({shape:'cylinder',position:e.position,size:[5+padding*2,9,5+padding*2]},shot.origin,shot.direction);return d<=shot.range&&d<=coverDistance(g,shot.origin,shot.direction)+.01?d:Infinity;}
export function shootBoss(g,shot,now=Date.now()){const e=ensureMilk(g),normal=targetDistance(g,shot),special=e.phase==='active'?withMilkBoss(g,()=>targetDistance(g,shot)):e.phase==='sealed'?milkDistance(g,shot):Infinity;if(!Number.isFinite(special)||normal<special){shootSingleBoss(g,shot,now);return;}
 shot.enemy='foreman';if(e.phase==='active'){withMilkBoss(g,()=>shootSingleBoss(g,shot,now));if(shot.hit==='Auntie')shot.hit='Foreman';return;}
 shot.hit='Milk';shot.impact=shot.origin.map((v,i)=>v+shot.direction[i]*special);shot.contactDelay=attackContactDelay(shot);e.pendingHits.push({shot:{...shot},due:now+shot.contactDelay,cycle:e.cycle});
}
function flushMilkHits(g,now){const e=ensureMilk(g),pending=e.pendingHits||[];e.pendingHits=[];for(const hit of pending){if(e.phase!=='sealed'||hit.cycle!==e.cycle)continue;if(hit.due>now){e.pendingHits.push(hit);continue;}if(!Number.isFinite(milkDistance(g,hit.shot)))continue;e.hits=Math.min(5,e.hits+1);e.lastHit=now;g.worldRevision++;if(e.hits===5)summonMilkBoss(g,now);}}

// Sign retrieval is authoritative and shared, including damage-over-time thresholds.
export function updateForemanSign(g,now,dt){const b=g.boss;if(b.kind!=='foreman'||b.hp<=0)return false;const lost=b.maxHp-b.hp,interval=b.maxHp/10;if(b.signRule!==2){b.signThreshold=b.signThreshold==null?interval:Math.max(interval,Math.ceil(b.signThreshold/interval)*interval);b.signRule=2;}if(!b.sign&&lost>=b.signThreshold){b.signThreshold=(Math.floor((lost+1e-7)/interval)+1)*interval;const a=(b.rotation||0)+1.2;let pos=[b.position[0]+Math.sin(a)*14,0,b.position[2]+Math.cos(a)*14];for(let i=0;i<16;i++){const angle=a+i*Math.PI/8,q=[Math.max(-470,Math.min(470,b.position[0]+Math.sin(angle)*14)),0,Math.max(-470,Math.min(470,b.position[2]+Math.cos(angle)*14))];if(!g.blocks.some(x=>Array.from({length:16},(_,j)=>[b.position[0]+(q[0]-b.position[0])*j/15,b.position[2]+(q[2]-b.position[2])*j/15]).some(([xPos,zPos])=>containsBlock(x,xPos,.5,zPos,2)))){pos=q;break;}}b.sign={position:pos,from:[...b.position],droppedAt:now};b.skills=[];b.minions=[];delete b.dodge;delete b.leap;b.position[1]=0;b.auraRadius=0;g.worldRevision++;}
 if(!b.sign)return false;b.skills=[];b.minions=[];b.auraRadius=0;b.chasing=false;b.target=null;if(b.paused||now-b.sign.droppedAt<850)return true;const q=b.sign.position,p=b.position,dx=q[0]-p[0],dz=q[2]-p[2],d=Math.hypot(dx,dz);b.rotation=Math.atan2(dx,dz);if(d<=2){b.sign.arrivedAt??=now;if(now-b.sign.arrivedAt<5000)return true;delete b.sign;b.signThreshold=Math.max(b.signThreshold,(Math.floor((lost+1e-7)/interval)+1)*interval);b.nextSkill=now+1500;g.worldRevision++;return true;}const step=Math.min(d-1,8*dt),nx=p[0]+dx/d*step,nz=p[2]+dz/d*step;const free=(x,z)=>!g.blocks.some(v=>containsBlock(v,x,.5,z,1.1));if(free(nx,nz)){p[0]=nx;p[2]=nz;}else if(free(nx,p[2]))p[0]=nx;else if(free(p[0],nz))p[2]=nz;return true;
}

function advanceTokenSummons(g,players,now){const list=g.tokenSummons||[];if(!list.length)return;g.tokenSummons=list.filter(s=>s.expires>now);const paused=players.some(p=>p.state?.paused);for(const s of g.tokenSummons){const dt=Math.max(0,Math.min(.25,(now-s.updated)/1000));s.updated=now;if(paused)continue;const targets=[g.boss,g.milkEncounter.phase==='active'?g.milkEncounter.boss:null].filter(b=>b?.hp>0&&Math.hypot(b.position[0]-s.position[0],b.position[2]-s.position[2])<=90).sort((a,b)=>Math.hypot(a.position[0]-s.position[0],a.position[2]-s.position[2])-Math.hypot(b.position[0]-s.position[0],b.position[2]-s.position[2]));const b=targets[0];if(!b)continue;const dx=b.position[0]-s.position[0],dz=b.position[2]-s.position[2],dist=Math.hypot(dx,dz),dir=[dx/Math.max(.001,dist),0,dz/Math.max(.001,dist)],step=Math.min(Math.max(0,dist-4),18*dt),pos=[s.position[0]+dir[0]*step,Math.max(0,b.position[1]),s.position[2]+dir[2]*step];if(coverDistance(g,[s.position[0],s.position[1]+2,s.position[2]],dir)<step+1)continue;s.position=pos;s.rotation=Math.atan2(dx,dz);if(dist-step>4.5||now<s.nextHit)continue;s.nextHit=now+900;s.flash=now;const impact=()=>{const damage=s.damage*elementMultiplier('dark',b.element);b.hp=Math.max(0,+(b.hp-damage).toFixed(2));b.lastHit=now;b.revision++;applyWeaponTraits(g,s.weapon,{shooter:s.owner,damage,direction:dir},now);updateForemanSign(g,now,0);if(!b.hp)finishBoss(g,s.owner,now);g.worldRevision++;};if(b===g.boss)impact();else withMilkBoss(g,impact);}}
