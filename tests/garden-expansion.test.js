import test from 'node:test';import assert from 'node:assert/strict';
import {AQUARIUM_SIZES} from '../fishing-catalog.js';import {fishingAction,ensureFishing} from '../server/fishing-rules.js';
import {sampleMeleePose,meleeDuration,meleeFamilies} from '../melee-motion.js';import {equipmentById} from '../equipment-catalog.js';import {battleAction} from '../server/game-rules.js';import {ensureWorld} from '../server/world-rules.js';
test('tank size, price and capacity are server-owned and survive serialization; invalid sizes cannot spend coins',()=>{
 for(const [size,option] of Object.entries(AQUARIUM_SIZES)){const g={wallets:{Ely:5000},inventories:{Ely:['pond-kit']}};ensureFishing(g);const actor={character:'Ely',state:{visible:true,position:[0,0,0]}};
  assert.ok(!fishingAction(g,actor,{action:'pond-build',size,position:[0,0,option.size[2]/2+2],price:0,capacity:9999}).error);
  assert.equal(g.wallets.Ely,5000-option.price);const pond=JSON.parse(JSON.stringify(g)).fishing.ponds[0];assert.deepEqual(pond.size,option.size);assert.equal(pond.capacity,option.capacity);
 }
 const g={wallets:{Ely:99},inventories:{Ely:['pond-kit']}};const actor={character:'Ely',state:{visible:true,position:[0,0,0]}};
 assert.ok(fishingAction(g,actor,{action:'pond-build',size:'large',position:[0,0,6]}).error);assert.equal(g.wallets.Ely,99);
 assert.ok(fishingAction(g,actor,{action:'pond-build',size:'forged',position:[0,0,6]}).error);
 assert.ok(fishingAction(g,actor,{action:'pond-build',size:'small',position:[0,0,0]}).error);assert.equal(g.wallets.Ely,99);
});
test('new melee weapons participate in server combos and shared boss combat; poses have distinct anticipation/contact/recovery',()=>{
 for(const family of meleeFamilies){
  const fingerprints=new Set();
  for(let combo=0;combo<7;combo++){const d=meleeDuration(family,combo),wind=sampleMeleePose(family,combo,d*.2),hit=sampleMeleePose(family,combo,d*.57),end=sampleMeleePose(family,combo,d+1);
   assert.notDeepEqual(wind.bones.RightArm,hit.bones.RightArm);assert.ok(Object.values(end.bones).flat().every(v=>Math.abs(v)<1e-9));fingerprints.add(JSON.stringify(hit.bones));
  }assert.equal(fingerprints.size,7);
 }
 for(const family of ['swatter','pan','planter','palm']){const item=equipmentById(family+'-1'),g={equipment:{Ely:{weapon:item.id}},redMode:true};ensureWorld(g);g.boss.position=[0,0,3];const actor={id:'a',character:'Ely',state:{visible:true,position:[0,0,0]}};
  const r=battleAction(g,actor,[actor],{action:'shoot',direction:[0,0,1],charge:1},10000);assert.equal(r.shot.combo,6);assert.equal(r.shot.hit,'Auntie');assert.ok(g.boss.hp<100);
 }
});
