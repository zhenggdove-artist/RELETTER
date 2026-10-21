import test from 'node:test';import assert from 'node:assert/strict';
import {chooseFishingHole,fishDimensions,aquariumFit,AQUARIUM_SIZES,ABYSSAL_FISH} from '../fishing-catalog.js';
import {ensureFishing,fishingAction} from '../server/fishing-rules.js';import {sampleMeleePose,meleeDuration,meleeFamilies,meleeTrailPattern} from '../melee-motion.js';
test('every hole can be selected automatically or explicitly and cast by its actual id',()=>{
 const holes=[0,20,40].map((x,i)=>({id:'hole-'+i,position:[x,0,0],depth:1,water:'normal'})),g={inventories:{Ely:['rod-1']},equipment:{Ely:{rod:'rod-1'}}};ensureFishing(g);g.fishing.holes=holes;
 for(let i=0;i<3;i++){const position=[i*20,0,3],actor={character:'Ely',state:{position,visible:true}},target=chooseFishingHole(holes,position,'hole-0');assert.equal(target.id,'hole-'+i);assert.ok(!fishingAction(g,actor,{action:'cast',hole:target.id},10000+i*1000,()=>.5).error);assert.equal(g.fishing.sessions.Ely.hole,target.id);fishingAction(g,actor,{action:'cancel-fishing'});}
 assert.equal(chooseFishingHole(holes,[200,0,0]),null);assert.equal(chooseFishingHole(holes,[0,20,0]),null);
 const close=[{id:'a',position:[0,0,0]},{id:'b',position:[4,0,0]}];assert.equal(chooseFishingHole(close,[3,0,1]).id,'b');assert.equal(chooseFishingHole(close,[3,0,1],'a').id,'a');
});
test('giants require actual tank dimensions and swimming capacity, rejected release preserves inventory',()=>{
 for(const species of ABYSSAL_FISH.filter(s=>s.eldritch)){const fish={id:species.id,species:species.id,kg:20};assert.ok(fishDimensions(fish)[0]>=7);for(const size of ['small','medium','large'])assert.ok(aquariumFit({...AQUARIUM_SIZES[size],fish:[]},fish));assert.equal(aquariumFit({...AQUARIUM_SIZES.titan,fish:[]},fish),null);}
 const fish={id:'giant',species:'dream-devourer',kg:35},g={};ensureFishing(g);g.fishing.bags.Ely=[fish];const pond={id:'tank',position:[0,0,0],size:[7,2.8,4],fish:[],owner:'Ely'};g.fishing.ponds=[pond];const actor={character:'Ely',state:{visible:true,position:[5,0,0]}};
 assert.ok(fishingAction(g,actor,{action:'pond-release',id:fish.id,pond:pond.id}).error);assert.equal(g.fishing.bags.Ely.length,1);assert.equal(pond.fish.length,0);
 pond.size=AQUARIUM_SIZES.titan.size;assert.ok(!fishingAction(g,actor,{action:'pond-release',id:fish.id,pond:pond.id}).error);assert.equal(pond.fish.length,1);assert.equal(g.fishing.bags.Ely.length,0);
 assert.ok(aquariumFit({...pond,size:AQUARIUM_SIZES.abyssal.size,fish:[]},fish));
});
test('legacy undersized tanks safely return giants once without deleting or duplicating catches',()=>{const fish={id:'old',species:'abyss-oracle',owner:'Rae'},g={fishing:{holes:[],ponds:[{id:'p',size:[3,1.4,2],fish:[fish]}],bags:{},sessions:{},revision:0}};ensureFishing(g);ensureFishing(g);assert.deepEqual(g.fishing.bags.Rae,[fish]);assert.equal(g.fishing.ponds[0].fish.length,0);});
test('six weapon families have independent full-body choreography and seven variations each',()=>{
 for(let combo=0;combo<7;combo++){const poses=meleeFamilies.map(f=>JSON.stringify(sampleMeleePose(f,combo,meleeDuration(f,combo)*.55).bones));assert.equal(new Set(poses).size,6);const trails=meleeFamilies.map(f=>JSON.stringify(meleeTrailPattern(f,combo)));assert.equal(new Set(trails).size,6);}
 for(const family of meleeFamilies){const poses=Array.from({length:7},(_,combo)=>JSON.stringify(sampleMeleePose(family,combo,meleeDuration(family,combo)*.55).bones));assert.equal(new Set(poses).size,7);}
});

test('giant aquarium can be built outside its own footprint and shares the fish with both players',()=>{
 const g={inventories:{Ely:['pond-kit']},wallets:{Ely:1500}},actor={character:'Ely',state:{position:[0,0,0],visible:true}};ensureFishing(g);
 assert.ok(fishingAction(g,actor,{action:'pond-build',size:'constructor',position:[0,0,22]}).error);
 assert.ok(!fishingAction(g,actor,{action:'pond-build',size:'titan',position:[0,0,22]}).error);assert.equal(g.wallets.Ely,0);assert.deepEqual(g.fishing.ponds[0].size,[30,18,24]);
 const fish={id:'owned-giant',species:'dream-devourer',kg:50};g.fishing.bags.Ely=[fish];assert.ok(!fishingAction(g,actor,{action:'pond-release',pond:g.fishing.ponds[0].id,id:fish.id}).error);
 const restored=JSON.parse(JSON.stringify(g));assert.equal(restored.fishing.ponds[0].fish[0].species,'dream-devourer');assert.equal(restored.fishing.ponds[0].fish[0].owner,'Ely');
});
