import {fuseEquipment} from './fusion-rules.js';
import {RARITIES,itemRarity,equipmentSaleValue} from '../equipment-rarity.js';
import {activeWeapon,resolveItem,traitStats} from '../combat-traits.js';
import {equipmentById,DEFAULT_WEAPON} from '../equipment-catalog.js';
export function ensureEquipment(g){g.weaponInstances??={};g.inventories??={};g.equipment??={};g.shields??={};g.equipmentRevision??=0;g.wallets??={};}
export function equippedWeapon(g,name){return activeWeapon(g,name);}
export function equipmentAction(g,name,body){
 ensureEquipment(g);const owned=g.inventories[name]??=[],slots=g.equipment[name]??={weapon:'water',shield:null};
 if(body.action==='fuse')return fuseEquipment(g,name,body);
 if(body.action==='sell-rarity'){
  if(!RARITIES.some(r=>r.id===body.rarity))return {error:'Invalid rarity'};
  const equipped=slots.weaponInstance||slots.weapon||'water',sold=new Set(),items=[];
  for(const id of owned){const item=resolveItem(g,name,id);if(id!==equipped&&item?.id!=='water'&&item?.slot==='weapon'&&itemRarity(item).id===body.rarity&&!sold.has(id)){sold.add(id);items.push(item);}}
  const proceeds=items.reduce((sum,item)=>sum+equipmentSaleValue(item),0);g.inventories[name]=owned.filter(id=>!sold.has(id));g.weaponInstances[name]=(g.weaponInstances[name]||[]).filter(i=>!sold.has(i.id));g.wallets[name]=(g.wallets[name]||0)+proceeds;g.equipmentRevision++;return {sold:sold.size,proceeds};
 }else if(body.action==='buy'){
  const item=equipmentById(body.item);if(!item||item.notForSale||['seed','harvest'].includes(item.slot)||item.id==='water')return {error:'Unknown item'};
  if(owned.includes(item.id))return {error:'Already owned'};
  if((g.wallets[name]||0)<item.price)return {error:'Not enough coins'};
  g.wallets[name]-=item.price;owned.push(item.id);
 }else if(body.action==='equip'){
  const item=resolveItem(g,name,body.item);if(!item||['seed','harvest'].includes(item.slot)||item.id!=='water'&&!owned.includes(body.item))return {error:'Purchase this item first'};
  slots[item.slot]=item.id;slots[item.slot+'Instance']=item.instanceId||null;if(item.slot==='wings')slots.wingsInstance=item.instanceId||null;if(item.slot==='head')slots.headInstance=item.instanceId||null;if(item.slot==='weapon'){slots.weaponInstance=item.instanceId||null;if(g.combatBuffs?.[name])delete g.combatBuffs[name].resonance;}
 }else if(body.action==='unequip'){
  if(!['weapon','shield','rod','tool','pond','head','outfit','wings'].includes(body.slot))return {error:'Invalid equipment slot'};
  if(body.slot==='wings')slots.wingsInstance=null;slots[body.slot+'Instance']=null;slots[body.slot]=body.slot==='weapon'?'water':null;if(body.slot==='head')slots.headInstance=null;if(body.slot==='weapon'){slots.weaponInstance=null;if(g.combatBuffs?.[name])delete g.combatBuffs[name].resonance;}
 }else return {error:'Unknown equipment action'};
 g.equipmentRevision++;return {};
}
export function absorbShield(g,name,damage,now){
 ensureEquipment(g);damage*=traitStats(g,name,now).defense;const food=g.garden?.buffs?.[name]?.defense;if(food?.until>now)damage*=1-food.power;const item=resolveItem(g,name,g.equipment[name]?.shieldInstance||g.equipment[name]?.shield);if(!item)return {damage,blocked:0};
 const state=g.shields[name]??={used:0,lastHit:0};if(now-state.lastHit>=item.recharge*1000)state.used=0;
 const blocked=Math.min(damage,Math.max(0,item.capacity-state.used));state.used+=blocked;state.lastHit=now;g.equipmentRevision++;
 return {damage:Math.max(0,damage-blocked),blocked};
}
