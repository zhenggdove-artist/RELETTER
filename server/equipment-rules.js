import {equipmentById,DEFAULT_WEAPON} from '../equipment-catalog.js';
export function ensureEquipment(g){g.inventories??={};g.equipment??={};g.shields??={};g.equipmentRevision??=0;g.wallets??={};}
export function equippedWeapon(g,name){return equipmentById(g.equipment?.[name]?.weapon)||DEFAULT_WEAPON;}
export function equipmentAction(g,name,body){
 ensureEquipment(g);const owned=g.inventories[name]??=[],slots=g.equipment[name]??={weapon:'water',shield:null};
 if(body.action==='buy'){
  const item=equipmentById(body.item);if(!item||item.id==='water')return {error:'Unknown item'};
  if(owned.includes(item.id))return {error:'Already owned'};
  if((g.wallets[name]||0)<item.price)return {error:'Not enough coins'};
  g.wallets[name]-=item.price;owned.push(item.id);
 }else if(body.action==='equip'){
  const item=equipmentById(body.item);if(!item||item.id!=='water'&&!owned.includes(item.id))return {error:'Purchase this item first'};
  slots[item.slot]=item.id;
 }else if(body.action==='unequip'){
  if(!['weapon','shield','rod','tool','pond'].includes(body.slot))return {error:'Invalid equipment slot'};
  slots[body.slot]=body.slot==='weapon'?'water':null;
 }else return {error:'Unknown equipment action'};
 g.equipmentRevision++;return {};
}
export function absorbShield(g,name,damage,now){
 ensureEquipment(g);const item=equipmentById(g.equipment[name]?.shield);if(!item)return {damage,blocked:0};
 const state=g.shields[name]??={used:0,lastHit:0};if(now-state.lastHit>=item.recharge*1000)state.used=0;
 const blocked=Math.min(damage,Math.max(0,item.capacity-state.used));state.used+=blocked;state.lastHit=now;g.equipmentRevision++;
 return {damage:Math.max(0,damage-blocked),blocked};
}
