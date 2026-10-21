import test from 'node:test';
import assert from 'node:assert/strict';
import {fishingAction,fishingView,ensureFishing} from '../server/fishing-rules.js';
import {CHISELS,FISH,ABYSSAL_FISH,selectedChisel} from '../fishing-catalog.js';
import {fishSVG} from '../fish-art.js';
const actor={character:'Ely',state:{visible:true,position:[0,0,0]}};
function world(chisel='chisel'){const g={inventories:{Ely:[chisel,'rod-20']},equipment:{Ely:{tool:chisel,rod:'rod-20'}}};ensureFishing(g);return g;}
test('five owned chisel grades define persistent depth and only Eclipse rolls crimson',()=>{
 for(const c of CHISELS){const g=world(c.id);assert.ok(!fishingAction(g,actor,{action:'dig',position:[0,0,4],depth:999,water:'crimson'},1000,()=>.1).error);
  const hole=g.fishing.holes[0];assert.equal(hole.depth,c.depth);assert.equal(hole.water,c.tier===5?'crimson':'normal');assert.equal(JSON.parse(JSON.stringify(g)).fishing.holes[0].depth,c.depth);}
 const g=world('chisel-5');fishingAction(g,actor,{action:'dig',position:[0,0,4]},1000,()=>.25);assert.equal(g.fishing.holes[0].water,'normal');
 assert.equal(selectedChisel(['chisel','chisel-5'],'chisel').tier,1);
 assert.equal(selectedChisel(['chisel'],'chisel-5').tier,1);
 assert.ok(fishingAction(world('unowned'),actor,{action:'dig',position:[0,0,4]},1000).error);
});
test('ordinary water excludes all red-only creatures; crimson pool is exclusively relic/eldritch',()=>{
 for(const water of ['normal','crimson'])for(let i=0;i<=100;i++){
  const g=world('chisel-5');g.fishing.holes=[{id:'hole',position:[0,0,4],depth:28,water}];
  fishingAction(g,actor,{action:'cast',hole:'hole',species:'dream-devourer'},1000,()=>i/101);
  const species=FISH.find(f=>f.id===g.fishing.sessions.Ely.fish.species);
  assert.equal(!!species.redOnly,water==='crimson');
  if(water==='crimson')assert.ok(species.rarity>=6);
 }
 assert.equal(ABYSSAL_FISH.length,10);assert.equal(new Set(ABYSSAL_FISH.map(fishSVG)).size,10);
});
test('Eldritch catch completes once and exposes shared animation stages without exposing the secret fish',()=>{
 const g=world('chisel-5');g.fishing.holes=[{id:'hole',position:[0,0,4],depth:28,water:'crimson'}];let now=Date.now();
 const act=body=>fishingAction(g,actor,body,now,()=>.999);
 act({action:'cast',hole:'hole'});const s=g.fishing.sessions.Ely;
 assert.equal(s.fish.species,'dream-devourer');assert.equal(fishingView(g).sessions.Ely.fish,undefined);
 now=s.biteAt+50;act({action:'hook',id:s.id});assert.equal(s.hookedAt,now);
 for(let i=0;i<1200&&s.stage==='fight';i++){now+=250;act({action:'reel',id:s.id,reeling:s.tension<.65});}
 assert.equal(s.stage,'caught');assert.equal(s.finishedAt,now);assert.equal(g.fishing.bags.Ely.length,1);
 act({action:'reel',id:s.id,reeling:true});assert.equal(g.fishing.bags.Ely.length,1);
 const saved=JSON.parse(JSON.stringify(g));assert.equal(saved.fishing.bags.Ely[0].species,'dream-devourer');
});
