import {AFFIXES,affixById,ownedBaseIds} from '../combat-traits.js';
import {validSurfaceId} from './surface-rules.js';
import {FISH,fishById,fishPrice,fishingById,selectedChisel,AQUARIUM_SIZES,aquariumFit} from '../fishing-catalog.js';
import {EQUIPMENT} from '../equipment-catalog.js';
import {blockSize} from '../build-shapes.js';
export function expireHoles(g,now=Date.now(),offline=false){
 const f=ensureFishing(g);let changed=false;
 for(const h of f.holes){if(!Number.isFinite(h.lastUsed)){h.lastUsed=now;changed=true;}}
 const old=f.holes.length;f.holes=f.holes.filter(h=>!offline&&now-h.lastUsed<600000);
 if(old!==f.holes.length){const ids=new Set(f.holes.map(h=>h.id));for(const [name,s] of Object.entries(f.sessions))if(!ids.has(s.hole))delete f.sessions[name];changed=true;}
 if(changed){f.revision++;g.worldRevision=(g.worldRevision||0)+1;}return changed;
}
export const FISH_ACTIONS=['dig','cast','hook','reel','cancel-fishing','sell-fish','pond-build','pond-release','pond-retrieve','pond-destroy','weapon-pickup'];
export function ensureFishing(g){
 g.fishing??={holes:[],ponds:[],bags:{},sessions:{},revision:0};g.weaponDrops??=[];const f=g.fishing;
 if(!f.discoveries){f.discoveries={};for(const [name,bag] of Object.entries(f.bags))f.discoveries[name]=[...new Set(bag.map(x=>x.species))];for(const pond of f.ponds)for(const fish of pond.fish){const list=f.discoveries[fish.owner||pond.owner||'Ely']??=[];if(!list.includes(fish.species))list.push(fish.species);}f.revision++;g.worldRevision=(g.worldRevision||0)+1;}
 if(!f.giantSizeMigration){
  for(const pond of f.ponds)for(let i=pond.fish.length-1;i>=0;i--){const fish=pond.fish[i];if(!fishById(fish.species)?.eldritch)continue;
   if(aquariumFit({...pond,fish:pond.fish.filter((_,j)=>j!==i)},fish)){const owner=fish.owner||pond.owner||'Ely',bag=f.bags[owner]??=[];if(!bag.some(x=>x.id===fish.id))bag.push(fish);pond.fish.splice(i,1);}
  }
  f.giantSizeMigration=true;f.revision++;g.worldRevision=(g.worldRevision||0)+1;
 }
 return f;
}
const random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
export function dropWeapon(g,now=Date.now(),rng=random){ensureFishing(g);if(g.weaponDrops.some(d=>d.generation===g.boss.generation))return;const choices={},affixes={};for(const name of ['Ely','Rae']){const owned=ownedBaseIds(g,name),all=EQUIPMENT.filter(i=>i.slot==='weapon'),fresh=all.filter(i=>!owned.includes(i.id)),pool=fresh.length?fresh:all;choices[name]=pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))].id;affixes[name]=AFFIXES[Math.min(AFFIXES.length-1,Math.floor(rng()*AFFIXES.length))].id;}g.weaponDrops.push({id:crypto.randomUUID(),generation:g.boss.generation,position:[...g.boss.position],choices,affixes,time:now});if(g.weaponDrops.length>30)g.weaponDrops.shift();}
export function fishingView(g){const f=ensureFishing(g);return {...f,sessions:Object.fromEntries(Object.entries(f.sessions).filter(([,s])=>Date.now()-s.updated<120000).map(([n,s])=>[n,{id:s.id,hole:s.hole,stage:s.stage,biteAt:s.biteAt,hookWindow:s.hookWindow,tension:s.tension,progress:s.progress,updated:s.updated,startedAt:s.startedAt,hookedAt:s.hookedAt,reeling:s.reeling,finishedAt:s.finishedAt,result:s.result}]))};}
export function fishingAction(g,actor,body,now=Date.now(),rng=random){
 const f=ensureFishing(g),name=actor.character,pos=actor.state?.position,owned=g.inventories?.[name]||[],bag=f.bags[name]??=[];
 if(!pos||!actor.state.visible)return {error:'Enter the garden first'};
 const close=(p,d=6)=>Math.hypot(pos[0]-p[0],pos[2]-p[2])<=d&&Math.abs(pos[1]-p[1])<3;
 const changed=(extra={})=>{f.revision++;return extra;};
 if(body.action==='weapon-pickup'){const drop=g.weaponDrops.find(d=>d.id===body.id);if(!drop||!close(drop.position,4))return {error:'Move closer to the weapon drop'};const item=EQUIPMENT.find(i=>i.id===drop.choices[name]&&i.slot==='weapon')||EQUIPMENT.find(i=>i.slot==='weapon');const affix=affixById(drop.affixes?.[name])||AFFIXES[Math.floor(rng()*AFFIXES.length)];const instance={id:'loot-'+crypto.randomUUID(),baseId:item.id,affixId:affix.id,obtainedAt:now};g.weaponInstances??={};(g.weaponInstances[name]??=[]).push(instance);g.inventories??={};(g.inventories[name]??=[]).push(instance.id);g.equipmentRevision=(g.equipmentRevision||0)+1;g.weaponDrops=g.weaponDrops.filter(d=>d.id!==drop.id);return changed({notice:'Obtained '+affix.name+' '+item.name});}
 if(body.action==='sell-fish'){const i=bag.findIndex(x=>x.id===body.id);if(i<0)return {error:'Fish is no longer in your collection'};g.wallets??={};g.wallets[name]=(g.wallets[name]||0)+fishPrice(bag[i]);bag.splice(i,1);return changed();}
 if(body.action==='dig'||body.action==='pond-build'){
  if(body.surface&&!validSurfaceId(body.surface))return {error:'Invalid skin'};
  const pond=body.action==='pond-build',chisel=selectedChisel(owned,g.equipment?.[name]?.tool);if(pond?!owned.includes('pond-kit'):!chisel)return {error:pond?'Purchase a fish pond first':'Purchase the chisel first'};
  const sizeKey=body.size||'small',tank=pond&&Object.hasOwn(AQUARIUM_SIZES,sizeKey)?AQUARIUM_SIZES[sizeKey]:null;
  if(pond&&!tank)return {error:'Choose a valid aquarium size'};
  const placementReach=pond?Math.max(8,Math.hypot(tank.size[0],tank.size[2])/2+5):8,p=body.position;
  if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)||p[1]!==0||p.some(v=>Math.abs(v)>480)||!close(p,placementReach)||pos[1]>.5)return {error:pond?'Choose nearby ground outside the aquarium footprint':'Choose ground within 8 metres'};
  const radius=pond?Math.hypot(tank.size[0],tank.size[2])/2:1.5;if([...f.holes,...f.ponds].some(x=>Math.hypot(p[0]-x.position[0],p[2]-x.position[2])<radius+(x.radius||1.5)+.5)||(g.blocks||[]).some(b=>{const [w,,d]=blockSize(b);return Math.abs(p[0]-b.position[0])<w/2+radius&&Math.abs(p[2]-b.position[2])<d/2+radius;}))return {error:'Choose an empty patch of ground'};
  if((pond?f.ponds:f.holes).length>=(pond?20:40))return {error:'The garden has reached its water feature limit'};
  if(pond){g.wallets??={};if((g.wallets[name]||0)<tank.price)return {error:'Aquarium construction needs '+tank.price+' coins'};if(Math.abs(pos[0]-p[0])<tank.size[0]/2+.4&&Math.abs(pos[2]-p[2])<tank.size[2]/2+.4)return {error:'Place the aquarium away from your feet'};g.wallets[name]-=tank.price;f.ponds.push({surface:body.surface||null,surfaceRevision:0,id:crypto.randomUUID(),position:p,radius,fish:[],owner:name,size:[...tank.size],capacity:tank.capacity,tankSize:body.size||'small'});}else f.holes.push({id:crypto.randomUUID(),position:p,radius,owner:name,createdAt:now,lastUsed:now,depth:chisel.depth,tier:chisel.tier,chisel:chisel.id,water:chisel.redChance>0&&rng()<chisel.redChance?'crimson':'normal'});return changed();
 }
 if(body.action.startsWith('pond-')){
  const pond=f.ponds.find(p=>p.id===body.pond);if(!pond||!close(pond.position,Math.max(7,(pond.radius||3)+4)))return {error:'Stand beside the pond'};
  if(body.action==='pond-destroy'){if(pond.fish.length)return {error:'Retrieve the fish before removing this pond'};f.ponds=f.ponds.filter(p=>p!==pond);return changed();}
  if(body.action==='pond-release'){const i=bag.findIndex(x=>x.id===body.id);if(i<0)return {error:'Fish is no longer in your collection'};const fitError=aquariumFit(pond,bag[i]);if(fitError)return {error:fitError};if(pond.fish.length>=(pond.capacity||30))return {error:'This aquarium is full'};pond.fish.push({...bag[i],owner:name});bag.splice(i,1);return changed();}
  if(body.action==='pond-retrieve'){const i=pond.fish.findIndex(x=>x.id===body.id&&x.owner===name);if(i<0)return {error:'Only your own fish can be retrieved'};bag.push(pond.fish[i]);pond.fish.splice(i,1);return changed();}
 }
 if(body.action==='cancel-fishing'){delete f.sessions[name];return changed();}
 const rod=fishingById(g.equipment?.[name]?.rod);
 if(!rod||rod.family!=='rod'||!owned.includes(rod.id))return {error:'Equip a fishing rod in the shop'};
 if(body.action==='cast'){

  const old=f.sessions[name];if(old&&now-old.updated<120000&&['waiting','fight'].includes(old.stage))return {error:'Finish or cancel your current cast'};
  const hole=f.holes.find(h=>h.id===body.hole);if(!hole||!close(hole.position,6))return {error:'Stand beside a fishing hole'};
  const pool=FISH.filter(s=>hole.water==='crimson'?s.redOnly:!s.redOnly),affinity=Math.min(.88,.34+rod.luck*.36+Math.min(28,hole.depth||1)*.006),weights=pool.map(s=>Math.pow(affinity,s.rarity-(hole.water==='crimson'?6:1))),total=weights.reduce((a,b)=>a+b,0);let pick=rng()*total,index=0;for(;index<pool.length-1;index++){pick-=weights[index];if(pick<=0)break;}const species=pool[index],kg=+(species.minKg+rng()*(species.maxKg-species.minKg)).toFixed(2);
  hole.lastUsed=now;f.sessions[name]={id:crypto.randomUUID(),hole:hole.id,rod:rod.id,fish:{id:crypto.randomUUID(),species:species.id,kg,caughtAt:now},stage:'waiting',startedAt:now,biteAt:now+rod.biteDelay+Math.floor(rng()*2200),hookWindow:rod.hookWindow,updated:now,progress:0,tension:.35,strain:0,seed:rng()*100};return changed();
 }
 const s=f.sessions[name],hole=f.holes.find(h=>h.id===s?.hole);if(!s||body.id!==s.id)return {error:'This cast is no longer active'};
 const fail=reason=>{s.stage='escaped';s.finishedAt=now;s.result=reason;s.updated=now;return changed({notice:reason});};
 if(!hole||!close(hole.position,7)||rod.id!==s.rod)return fail('The fish escaped · stay beside your cast');
 if(['waiting','fight'].includes(s.stage))hole.lastUsed=now;
 if(body.action==='hook'){
  if(s.stage!=='waiting')return {error:'No bite to hook'};
  if(now<s.biteAt)return fail('Too early · wait for the float to dip');
  if(now>s.biteAt+s.hookWindow)return fail('Missed bite');s.stage='fight';s.hookedAt=now;s.updated=now;return changed();
 }
 if(body.action==='reel'){
  if(s.stage==='waiting'){if(now>s.biteAt+s.hookWindow)return fail('Missed bite');return {};}
  if(s.stage!=='fight')return {};
  if(now-s.updated>5000)return fail('Line went slack');
  const dt=Math.min(.5,Math.max(0,(now-s.updated)/1000));s.updated=now;
  const species=fishById(s.fish.species),load=Math.min(2.4,s.fish.kg/rod.power),surge=Math.sin(now/1200+s.seed)*.5+.5,reeling=body.reeling===true;
  s.reeling=reeling;s.tension=Math.max(0,Math.min(1,s.tension+dt*(reeling?.19+load*.12+surge*.18-rod.control*.14:-.35-rod.control*.15)));
  const safe=s.tension>.13&&s.tension<.88;s.strain=safe?Math.max(0,s.strain-dt):s.strain+dt;
  if(s.strain>1.8)return fail(s.tension>.88?'Line snapped · release to lower tension':'Fish escaped · keep some tension');
  s.progress=Math.max(0,s.progress+dt*(reeling&&safe?(7+rod.power*.4)/(1+load*.55)/species.temper:-1));
  if(s.progress>=100){s.stage='caught';s.finishedAt=now;s.progress=100;s.fish.caughtAt=now;bag.push(s.fish);const discovered=f.discoveries[name]??=[];if(!discovered.includes(s.fish.species))discovered.push(s.fish.species);s.result=s.fish;return changed({notice:'Caught '+species.name+' · '+s.fish.kg+' kg'});}return changed();
 }
 return {error:'Unknown fishing action'};
}
