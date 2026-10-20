import {FISH,fishById,fishPrice,fishingById} from '../fishing-catalog.js';
import {EQUIPMENT} from '../equipment-catalog.js';
import {blockSize} from '../build-shapes.js';
export const FISH_ACTIONS=['dig','cast','hook','reel','cancel-fishing','sell-fish','pond-build','pond-release','pond-retrieve','pond-destroy','weapon-pickup'];
export function ensureFishing(g){g.fishing??={holes:[],ponds:[],bags:{},sessions:{},revision:0};g.weaponDrops??=[];return g.fishing;}
const random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
export function dropWeapon(g,now=Date.now(),rng=random){ensureFishing(g);if(g.weaponDrops.some(d=>d.generation===g.boss.generation))return;const choices={};for(const name of ['Ely','Rae']){const options=EQUIPMENT.filter(i=>i.slot==='weapon'&&!(g.inventories?.[name]||[]).includes(i.id));choices[name]=options.length?options[Math.floor(rng()*options.length)].id:null;}g.weaponDrops.push({id:crypto.randomUUID(),generation:g.boss.generation,position:[...g.boss.position],choices,time:now});if(g.weaponDrops.length>30)g.weaponDrops.shift();}
export function fishingView(g){const f=ensureFishing(g);return {...f,sessions:Object.fromEntries(Object.entries(f.sessions).filter(([,s])=>Date.now()-s.updated<120000).map(([n,s])=>[n,{id:s.id,hole:s.hole,stage:s.stage,biteAt:s.biteAt,hookWindow:s.hookWindow,tension:s.tension,progress:s.progress,updated:s.updated,result:s.result}]))};}
export function fishingAction(g,actor,body,now=Date.now(),rng=random){
 const f=ensureFishing(g),name=actor.character,pos=actor.state?.position,owned=g.inventories?.[name]||[],bag=f.bags[name]??=[];
 if(!pos||!actor.state.visible)return {error:'Enter the garden first'};
 const close=(p,d=6)=>Math.hypot(pos[0]-p[0],pos[2]-p[2])<=d&&Math.abs(pos[1]-p[1])<3;
 const changed=(extra={})=>{f.revision++;return extra;};
 if(body.action==='weapon-pickup'){const drop=g.weaponDrops.find(d=>d.id===body.id);if(!drop||!close(drop.position,4))return {error:'Move closer to the weapon drop'};const choices=EQUIPMENT.filter(i=>i.slot==='weapon'&&!owned.includes(i.id));let item=choices.find(i=>i.id===drop.choices[name])||choices[0];if(item){(g.inventories[name]??=[]).push(item.id);g.equipmentRevision=(g.equipmentRevision||0)+1;}else {g.wallets??={};g.wallets[name]=(g.wallets[name]||0)+50;}g.weaponDrops=g.weaponDrops.filter(d=>d.id!==drop.id);return changed({notice:item?'Obtained '+item.name:'All weapons collected · +50 coins'});}
 if(body.action==='sell-fish'){const i=bag.findIndex(x=>x.id===body.id);if(i<0)return {error:'Fish is no longer in your collection'};g.wallets??={};g.wallets[name]=(g.wallets[name]||0)+fishPrice(bag[i]);bag.splice(i,1);return changed();}
 if(body.action==='dig'||body.action==='pond-build'){
  const pond=body.action==='pond-build';if(!owned.includes(pond?'pond-kit':'chisel'))return {error:pond?'Purchase a fish pond first':'Purchase the chisel first'};
  const p=body.position;if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)||p[1]!==0||p.some(v=>Math.abs(v)>480)||!close(p,8)||pos[1]>.5)return {error:'Choose ground within 8 metres'};
  const radius=pond?3:1.5;if([...f.holes,...f.ponds].some(x=>Math.hypot(p[0]-x.position[0],p[2]-x.position[2])<radius+(x.radius||1.5)+.5)||(g.blocks||[]).some(b=>{const [w,,d]=blockSize(b);return Math.abs(p[0]-b.position[0])<w/2+radius&&Math.abs(p[2]-b.position[2])<d/2+radius;}))return {error:'Choose an empty patch of ground'};
  if((pond?f.ponds:f.holes).length>=(pond?20:40))return {error:'The garden has reached its water feature limit'};
  if(pond){g.wallets??={};if((g.wallets[name]||0)<15)return {error:'Pond construction needs 15 coins'};g.wallets[name]-=15;f.ponds.push({id:crypto.randomUUID(),position:p,radius,fish:[],owner:name});}else f.holes.push({id:crypto.randomUUID(),position:p,radius,owner:name});return changed();
 }
 if(body.action.startsWith('pond-')){
  const pond=f.ponds.find(p=>p.id===body.pond);if(!pond||!close(pond.position,7))return {error:'Stand beside the pond'};
  if(body.action==='pond-destroy'){if(pond.fish.length)return {error:'Retrieve the fish before removing this pond'};f.ponds=f.ponds.filter(p=>p!==pond);return changed();}
  if(body.action==='pond-release'){const i=bag.findIndex(x=>x.id===body.id);if(i<0)return {error:'Fish is no longer in your collection'};if(pond.fish.length>=30)return {error:'This pond holds at most 30 fish'};pond.fish.push({...bag[i],owner:name});bag.splice(i,1);return changed();}
  if(body.action==='pond-retrieve'){const i=pond.fish.findIndex(x=>x.id===body.id&&x.owner===name);if(i<0)return {error:'Only your own fish can be retrieved'};if(bag.length>=1000)return {error:'Collection full'};bag.push(pond.fish[i]);pond.fish.splice(i,1);return changed();}
 }
 if(body.action==='cancel-fishing'){delete f.sessions[name];return changed();}
 const rod=fishingById(g.equipment?.[name]?.rod);
 if(!rod||rod.family!=='rod'||!owned.includes(rod.id))return {error:'Equip a fishing rod in the shop'};
 if(body.action==='cast'){
  if(bag.length>=1000)return {error:'Sell or release fish to make room'};
  const old=f.sessions[name];if(old&&now-old.updated<120000&&['waiting','fight'].includes(old.stage))return {error:'Finish or cancel your current cast'};
  const hole=f.holes.find(h=>h.id===body.hole);if(!hole||!close(hole.position,6))return {error:'Stand beside a fishing hole'};
  const weights=FISH.map(s=>Math.pow(.34+rod.luck*.36,s.rarity-1)),total=weights.reduce((a,b)=>a+b,0);let pick=rng()*total,index=0;for(;index<FISH.length-1;index++){pick-=weights[index];if(pick<=0)break;}const species=FISH[index],kg=+(species.minKg+rng()*(species.maxKg-species.minKg)).toFixed(2);
  f.sessions[name]={id:crypto.randomUUID(),hole:hole.id,rod:rod.id,fish:{id:crypto.randomUUID(),species:species.id,kg,caughtAt:now},stage:'waiting',biteAt:now+rod.biteDelay+Math.floor(rng()*2200),hookWindow:rod.hookWindow,updated:now,progress:0,tension:.35,strain:0,seed:rng()*100};return changed();
 }
 const s=f.sessions[name],hole=f.holes.find(h=>h.id===s?.hole);if(!s||body.id!==s.id)return {error:'This cast is no longer active'};
 const fail=reason=>{s.stage='escaped';s.result=reason;s.updated=now;return changed({notice:reason});};
 if(!hole||!close(hole.position,7)||rod.id!==s.rod)return fail('The fish escaped · stay beside your cast');
 if(body.action==='hook'){
  if(s.stage!=='waiting')return {error:'No bite to hook'};
  if(now<s.biteAt)return fail('Too early · wait for the float to dip');
  if(now>s.biteAt+s.hookWindow)return fail('Missed bite');s.stage='fight';s.updated=now;return changed();
 }
 if(body.action==='reel'){
  if(s.stage==='waiting'){if(now>s.biteAt+s.hookWindow)return fail('Missed bite');return {};}
  if(s.stage!=='fight')return {};
  if(now-s.updated>5000)return fail('Line went slack');
  const dt=Math.min(.5,Math.max(0,(now-s.updated)/1000));s.updated=now;
  const species=fishById(s.fish.species),load=Math.min(2.4,s.fish.kg/rod.power),surge=Math.sin(now/1200+s.seed)*.5+.5,reeling=body.reeling===true;
  s.tension=Math.max(0,Math.min(1,s.tension+dt*(reeling?.19+load*.12+surge*.18-rod.control*.14:-.35-rod.control*.15)));
  const safe=s.tension>.13&&s.tension<.88;s.strain=safe?Math.max(0,s.strain-dt):s.strain+dt;
  if(s.strain>1.8)return fail(s.tension>.88?'Line snapped · release to lower tension':'Fish escaped · keep some tension');
  s.progress=Math.max(0,s.progress+dt*(reeling&&safe?(7+rod.power*.4)/(1+load*.55)/species.temper:-1));
  if(s.progress>=100){s.stage='caught';s.progress=100;s.fish.caughtAt=now;bag.push(s.fish);s.result=s.fish;return changed({notice:'Caught '+species.name+' · '+s.fish.kg+' kg'});}return changed();
 }
 return {error:'Unknown fishing action'};
}
