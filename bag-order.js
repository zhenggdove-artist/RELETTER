import {RARITIES,itemRarity} from './equipment-rarity.js';
// Inventory append order is authoritative for purchases and drops, including legacy items.
export function sortBagItems(items,mode='acquired'){
 return items.map((value,index)=>({value,index})).sort((a,b)=>{
  if(mode==='rarity'){const rank=x=>RARITIES.findIndex(r=>r.id===itemRarity(x.value.item).id),delta=rank(a)-rank(b);if(delta)return delta;}
  return a.index-b.index;
 }).map(x=>x.value);
}
