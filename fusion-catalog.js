import {resolveItem} from './combat-traits.js';
export function fusionChance(g,name,target,now=Date.now()){
 const count=(g.weaponInstances?.[name]||[]).find(i=>i.id===target)?.fusionCount||0;
 const base=.5*Math.pow(.5,Math.max(0,count-3)),slots=g.equipment?.[name]||{},outfit=resolveItem(g,name,slots.outfitInstance||slots.outfit);
 const clothing=Math.max(0,outfit?.bonuses?.fusion||0),buff=g.garden?.buffs?.[name]?.fusion,food=buff?.until>now?Math.max(0,buff.power):0;
 const bonus=Math.min(1,clothing+food);return {layer:count+1,base,bonus,chance:Math.min(.95,base*(1+bonus))};
}
