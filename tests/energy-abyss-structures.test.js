import test from 'node:test';import assert from 'node:assert/strict';
import {FISH,ABYSSAL_FISH,fishDimensions,AQUARIUM_SIZES,aquariumFit} from '../fishing-catalog.js';
import {ensureWorld,rollBoss,BOSS_VARIANTS,resetEncounter,worldView} from '../server/world-rules.js';
import {battleAction} from '../server/game-rules.js';import {ensureFishing,fishingAction} from '../server/fishing-rules.js';
const actor={id:'a',character:'Ely',state:{visible:true,position:[0,0,0],phase:2}};
const shot={action:'shoot',direction:[0,0,1],charge:1};
test('server rolls persistent ordinary strengths through 3000 HP; no snapshot rerolls',()=>{
 let sum=0;for(const variant of BOSS_VARIANTS){const r=sum+variant.weight/2;sum+=variant.weight;const g={progression:{Ely:{xp:30}}};resetEncounter(g,100,()=>r);assert.equal(g.boss.maxHp,variant.maxHp);assert.equal(g.boss.level,variant.level);const saved=JSON.parse(JSON.stringify(worldView(g)));for(let i=0;i<20;i++)assert.equal(worldView(saved).boss.maxHp,variant.maxHp);g.boss.position=[0,0,2];battleAction(g,actor,[actor],{action:'monster-hit'},10000);assert.equal(g.hits.Ely,variant.damage);assert.equal(g.progression.Ely.xp,30);}
 assert.equal(rollBoss(()=>.999).hp,3000);
});
test('50 distinct eldritch species, legacy IDs and correct aquarium limits',()=>{
 const pool=FISH.filter(f=>f.eldritch);assert.equal(pool.length,50);assert.equal(new Set(FISH.map(f=>f.id)).size,FISH.length);assert.equal(ABYSSAL_FISH.length,54);assert.equal(FISH.length,104);
 for(const s of pool){assert.ok(fishDimensions(s).every(Number.isFinite));assert.ok(aquariumFit({...AQUARIUM_SIZES.small,fish:[]},{species:s.id}));assert.equal(aquariumFit({...AQUARIUM_SIZES.titan,fish:[]},{species:s.id}),null);}
 assert.deepEqual(fishDimensions({id:'dream-devourer'}),[15,12,11]);assert.equal(new Set(pool.filter(f=>f.morphology).map(f=>JSON.stringify([f.shape,f.morphology]))).size,44);
});
test('every crimson monster can actually be hooked, landed, discovered and sold without relocking',()=>{
 const affinity=.34+.36+28*.006,weights=ABYSSAL_FISH.map(s=>Math.pow(affinity,s.rarity-6)),total=weights.reduce((a,b)=>a+b,0);let offset=0;
 for(let i=0;i<ABYSSAL_FISH.length;i++){const spec=ABYSSAL_FISH[i],pick=(offset+weights[i]/2)/total;offset+=weights[i];if(!spec.eldritch)continue;
  const g={inventories:{Ely:['rod-20']},equipment:{Ely:{rod:'rod-20'}}};ensureFishing(g);g.fishing.holes=[{id:'hole',position:[0,0,4],depth:28,water:'crimson'}];let now=10000,calls=0;
  fishingAction(g,actor,{action:'cast',hole:'hole'},now,()=>calls++===0?pick:.5);const s=g.fishing.sessions.Ely;assert.equal(s.fish.species,spec.id);assert.deepEqual(g.fishing.discoveries.Ely||[],[]);
  now=s.biteAt+1;fishingAction(g,actor,{action:'hook',id:s.id},now);
  for(let j=0;j<1200&&s.stage==='fight';j++){now+=250;fishingAction(g,actor,{action:'reel',id:s.id,reeling:s.tension<.65},now);}
  assert.equal(s.stage,'caught',spec.id);assert.ok(g.fishing.discoveries.Ely.includes(spec.id));fishingAction(g,actor,{action:'sell-fish',id:s.fish.id},now);assert.equal(g.fishing.bags.Ely.length,0);assert.ok(JSON.parse(JSON.stringify(g)).fishing.discoveries.Ely.includes(spec.id));
 }
});
test('3–5 hits destroy blocks; cooldown, cover, aimed misses and saved damage remain authoritative',()=>{
 const capacities=new Set();for(const id of ['a','b','c']){let g={};ensureWorld(g);g.blocks=[{id,shape:'cube',position:[0,0,4],size:[2,2,2]}];g.boss.position=[0,0,8];
  const miss=battleAction(g,actor,[actor],{...shot,charge:0,direction:[0,1,0]},10000);assert.equal(miss.shot.hit,null);assert.equal(g.blocks[0].hits,undefined);
  let n=0;while(g.blocks.length){const now=11000+n*1000,r=battleAction(g,actor,[actor],shot,now);n++;assert.equal(r.shot.hit,'Block');assert.equal(r.shot.structureHit.hits,n);assert.ok(n<=5);assert.ok(battleAction(g,actor,[actor],shot,now+1).error);g=JSON.parse(JSON.stringify(g));}
  capacities.add(n);assert.equal(g.destructions.length,1);assert.equal(g.boss.hp,100);assert.equal(g.destructions[0].id,id);
 }assert.deepEqual([...capacities].sort(),[3,4,5]);
});
test('aquarium blocks shots and breaks on tenth hit; residents disappear but discoveries remain',()=>{
 const g={};ensureWorld(g);ensureFishing(g);g.boss.position=[0,0,12];g.fishing.discoveries.Ely=['dream-devourer'];g.fishing.ponds=[{id:'tank',position:[0,0,5],size:[5,3,3],fish:[{id:'caught',species:'dream-devourer',owner:'Ely'}]}];
 for(let i=1;i<=10;i++){const r=battleAction(g,actor,[actor],shot,10000+i*1000);assert.equal(r.shot.hit,'Aquarium');assert.equal(r.shot.structureHit.hits,i);assert.equal(g.fishing.ponds.length,i===10?0:1);assert.equal(g.boss.hp,100);}
 assert.equal(g.destructions[0].kind,'pond');assert.deepEqual(g.fishing.discoveries.Ely,['dream-devourer']);assert.equal(g.fishing.bags.Ely?.length||0,0);assert.equal(JSON.parse(JSON.stringify(g)).fishing.ponds.length,0);
});
