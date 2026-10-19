import {test} from 'node:test';import assert from 'node:assert/strict';
import {battleAction} from '../server/game-rules.js';import {ensureWorld,resetEncounter,activateEncounter,advanceBoss,buildAction,rayBlock} from '../server/world-rules.js';
const a={id:'a',character:'Ely',state:{position:[30,0,0],visible:true,phase:2}},b={id:'b',character:'Rae',state:{position:[32,0,0],visible:true,phase:2}};
test('co-op trigger, 100 health, 1/5 damage, no friendly fire, defeat and reset preserve buildings',()=>{
 const g={};ensureWorld(g);assert.equal(g.boss.hp,100);assert.equal(activateEncounter(g,'other'),false);assert.equal(activateEncounter(g,'一起打阿姨'),true);
 let shot=battleAction(g,a,[a,b],{action:'shoot',direction:[1,0,0],charge:0},10000).shot;assert.equal(g.boss.hp,99);assert.equal(shot.red,true);assert.equal(g.hits.Rae,undefined);
 shot=battleAction(g,b,[a,b],{action:'shoot',direction:[1,0,0],charge:1},11000).shot;assert.equal(shot.damage,5);assert.equal(g.boss.hp,94);
 for(let i=0;i<19;i++)battleAction(g,a,[a,b],{action:'shoot',direction:[1,0,0],charge:1},12000+i*700);assert.equal(g.boss.hp,0);assert.equal(g.loot.length,0);
 activateEncounter(g,'一起打阿姨');assert.equal(g.boss.hp,0);g.blocks.push({id:'saved'});const gen=g.boss.generation;resetEncounter(g);assert.equal(g.boss.hp,100);assert.equal(g.redMode,false);assert.equal(g.boss.generation,gen+1);assert.equal(g.blocks.length,1);
});
test('normal water takes exactly 100 successful hits to defeat the monster',()=>{const g={};activateEncounter(g,'一起打阿姨');for(let i=0;i<100;i++){battleAction(g,a,[a,b],{action:'shoot',direction:[1,0,0],charge:0},10000+i*700);assert.equal(g.boss.hp,99-i);}});
test('building validation, rotation, stacking, safe placement, destruction, ray and monster cover',()=>{
 const g={},actor={...a,state:{...a.state,position:[0,0,0]}};const build=(shape,position,rotation=0)=>buildAction(g,actor,[actor],{action:'build',shape,position,rotation,size:shape==='bar'?[6,2,2]:[2,2,2]});
 assert.ok(build('cube',[0,0,0]).error);assert.ok(build('cube',[0,2,4]).error);assert.ok(build('bad',[0,0,4]).error);assert.ok(build('cube',[0,0,4.1]).error);assert.ok(build('cube',[100,0,0]).error);
 const base=build('cube',[0,0,4]).block;assert.ok(base);assert.ok(build('bar',[0,2,4],1).block);assert.ok(build('cube',[0,0,4]).error);assert.ok(build('cylinder',[4,0,4]).block);
 assert.equal(rayBlock(base,[0,1,0],[0,0,1]),3);assert.equal(rayBlock({shape:'cylinder',position:[4,0,4]},[4,1,0],[0,0,1]),3);
 g.redMode=true;g.boss.position=[0,0,8];g.bossClock=10000;for(let i=1;i<=100;i++)advanceBoss(g,[actor],10000+i*100);assert.ok(g.boss.position[2]>=6.09);
 const shot=battleAction(g,actor,[actor],{action:'shoot',direction:[0,0,1],charge:1},30000).shot;assert.equal(shot.hit,null);assert.deepEqual(shot.impact,[0,1,3]);assert.equal(g.boss.hp,100);
 assert.ok(buildAction(g,{...actor,state:{...actor.state,position:[100,0,0]}},[actor],{action:'destroy',id:base.id}).error);assert.ok(!buildAction(g,actor,[actor],{action:'destroy',id:base.id}).error);
});
test('server monster pauses while either player edits and ignores missed shots',()=>{const g={};activateEncounter(g,'一起打阿姨');g.bossClock=10000;const before=[...g.boss.position];advanceBoss(g,[{...a,state:{...a.state,paused:true}}],10200);assert.deepEqual(g.boss.position,before);advanceBoss(g,[a],10400);assert.ok(g.boss.position[0]<before[0]);battleAction(g,a,[a],{action:'shoot',direction:[-1,0,0],charge:1},20000);assert.equal(g.boss.hp,100);});
test('a roof blocks the tall monster, not only its feet',()=>{const g={};activateEncounter(g,'一起打阿姨');g.blocks=[{shape:'bar',position:[0,2,4],rotation:0}];g.boss.position=[0,0,8];g.bossClock=10000;const actor={...a,state:{...a.state,position:[0,0,0]}};for(let i=1;i<=100;i++)advanceBoss(g,[actor],10000+i*100);assert.ok(g.boss.position[2]>=6.09);});
