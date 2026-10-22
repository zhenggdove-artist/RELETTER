import assert from 'node:assert/strict';
import {test} from 'node:test';
import {battleAction} from '../server/game-rules.js';
const actor={id:'a',character:'Ely',state:{position:[0,0,0],visible:true}},target={id:'b',character:'Rae',state:{position:[0,0,30],visible:true}};
test('charge enlarges visible and authoritative range and radius without changing direction',()=>{
 const weak=battleAction({pkMode:true},actor,[actor,target],{action:'shoot',direction:[0,0,1],charge:0},10000).shot;
 const strong=battleAction({pkMode:true},actor,[actor,target],{action:'shoot',direction:[0,0,1],charge:1},10000).shot;
 assert.equal(weak.hit,null);assert.equal(strong.hit,'Rae');assert.equal(weak.range,18);assert.equal(strong.range,75.6);assert.ok(strong.radius>weak.radius);assert.deepEqual(strong.direction,[0,0,1]);
 const side={...target,state:{position:[1.5,0,10],visible:true}};
 assert.equal(battleAction({pkMode:true},actor,[actor,side],{action:'shoot',direction:[0,0,1]},10000).shot.hit,null);
 assert.equal(battleAction({pkMode:true},actor,[actor,side],{action:'shoot',direction:[0,0,1],charge:1},10000).shot.hit,'Rae');
});
test('charge clamps invalid/extreme input; rear targets never hit; three hits still drop coins',()=>{
 for(const charge of [-1,NaN,Infinity,'1',undefined])assert.equal(battleAction({pkMode:true},actor,[actor],{action:'shoot',direction:[0,0,1],charge},10000).shot.charge,0);
 assert.equal(battleAction({pkMode:true},actor,[actor],{action:'shoot',direction:[0,0,1],charge:100},10000).shot.charge,1);
 assert.equal(battleAction({pkMode:true},actor,[actor,target],{action:'shoot',direction:[0,0,-1],charge:1},10000).shot.hit,null);
 const game={pkMode:true,wallets:{Rae:7}};for(let i=0;i<3;i++)battleAction(game,actor,[actor,target],{action:'shoot',direction:[0,0,1],charge:1},10000+i*700);assert.equal(game.wallets.Rae,0);assert.equal(game.loot[0].amount,7);
});
