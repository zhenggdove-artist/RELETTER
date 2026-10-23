import {activeHead} from '../combat-traits.js';
// Time-based effects are server-owned; one slot per effect prevents unbounded stacks.
export function effectActive(boss,key,now){const e=boss.effects?.[key];return e&&e.until>now?e:null;}
function status(boss,key,owner,now,duration,power=0,recovery=0){boss.effects??={};boss.effectLocks??={};if(recovery&&(boss.effectLocks[key]||0)>now)return;const old=boss.effects[key];if(old&&old.until>now){old.until=Math.max(old.until,now+duration);if(power>=old.power){old.power=power;old.owner=owner;}return;}boss.effects[key]={owner,power,until:now+duration,next:now+1000};if(recovery)boss.effectLocks[key]=now+duration+recovery;}
export function applyWeaponTraits(g,weapon,shot,now){
 const boss=g.boss,name=shot.shooter,rank=weapon.tier||0,put=(key,dur,power=0,lock=0)=>status(boss,key,name,now,dur,power,lock);
 if(weapon.family==='fire')put('burn',5000,1+rank*.4);
 if(weapon.family==='swatter')put('poison',12000,.35+rank*.12);
 if(weapon.family==='ice')put('slow',4000,.4);
 if(weapon.family==='lightning')put('stun',400,0,3000);
 if(weapon.family==='beam')put('expose',4000,.15);
 if(weapon.family==='saber')put('bleed',6000,.6+rank*.15);
 if(weapon.family==='water')put('weak',3000,.2);
 if(weapon.family==='wave')put('root',500,0,3000);
 if(weapon.family==='pan'){const dx=shot.direction[0]*2,dz=shot.direction[2]*2;shot.knockback=[dx,0,dz];}
 const head=activeHead(g,name),proc=head?.proc;if(proc){const config={burn:[4000,1],poison:[9000,.5],bleed:[4000,.7],slow:[2500,.25],weak:[2500,.2],expose:[2500,.1],fear:[900,0,5000],stun:[300,0,4000],root:[650,0,5000]}[proc];if(config)put(proc,...config);}
 for(const a of new Set([...(weapon.affixIds||[weapon.affixId]),head?.affixId].filter(Boolean))){
 if(a==='searing')put('burn',5000,2);if(a==='venomous')put('poison',14000,.8);if(a==='glacial')put('slow',4000,.5);
 if(a==='dread')put('fear',2400,0,6000);if(a==='thunderous')put('stun',650,0,4000);if(a==='sundering')put('expose',5000,.2);if(a==='enfeebling')put('weak',5000,.35);if(a==='binding')put('root',1200,0,5000);
 g.combatBuffs??={};const buff=g.combatBuffs[name]??={};g.hits??={};
 if(a==='vampiric'&&now>=(buff.drainAt||0)){g.hits[name]=Math.max(0,(g.hits[name]||0)-.35);buff.drainAt=now+2000;}
 if(a==='renewing'){buff.regen={until:now+5000,next:buff.regen?.until>now?buff.regen.next:now+1000};}
 if(a==='avaricious'&&now>=(buff.goldAt||0)){g.wallets??={};g.wallets[name]=(g.wallets[name]||0)+2;buff.goldAt=now+3000;}
 if(a==='resonant'){const old=buff.resonance;buff.resonance={stacks:old?.until>now?Math.min(5,old.stacks+1):1,until:now+6000};}
}
}
export function tickCombatEffects(g,now){
 let changed=false,killer=null;const boss=g.boss;
 for(const [key,e] of Object.entries(boss.effects||{})){
  if(['burn','poison','bleed'].includes(key)&&boss.hp>0){const end=Math.min(now,e.until),ticks=Math.max(0,Math.floor((end-e.next)/1000)+1);if(ticks){boss.hp=Math.max(0,+(boss.hp-e.power*ticks).toFixed(2));e.next+=ticks*1000;boss.revision++;boss.lastHit=now;changed=true;if(!boss.hp)killer=e.owner;}}
  if(now>=e.until){delete boss.effects[key];changed=true;}
 }
 for(const [name,buff] of Object.entries(g.combatBuffs||{})){const e=buff.regen;if(e){const ticks=Math.max(0,Math.floor((Math.min(now,e.until)-e.next)/1000)+1);if(ticks){g.hits??={};g.hits[name]=Math.max(0,+((g.hits[name]||0)-ticks*.3).toFixed(2));e.next+=ticks*1000;changed=true;}if(now>=e.until)delete buff.regen;}}
 if(changed)g.worldRevision++;return {changed,killer};
}
