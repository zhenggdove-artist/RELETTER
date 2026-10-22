import {equipmentById,DEFAULT_WEAPON} from './equipment-catalog.js';
export const AFFIXES=[
 ['exultant','高亢的','Movement speed +55%.',{speed:1.55}],
 ['dread','恐懼的','Hits cause panic flight for 2.4s (6s recovery).',{}],
 ['searing','灼熱的','Burn: 2 damage/s for 5s.',{}],
 ['venomous','劇毒的','Poison: 0.8 damage/s for 14s.',{}],
 ['glacial','凜冽的','Slow movement by 50% for 4s.',{}],
 ['thunderous','雷鳴的','Stun for 0.65s (4s recovery).',{}],
 ['vampiric','嗜血的','Heal 0.35 HP on a hit (2s cooldown).',{}],
 ['renewing','再生的','Hits restore 0.3 HP/s over 5s; refreshes.',{}],
 ['stalwart','堅毅的','Incoming damage -25%.',{defense:.75}],
 ['mighty','巨力的','Attack +30%; movement -10%.',{attack:1.3,speed:.9}],
 ['featherlight','輕盈的','Jump +35%; movement +10%.',{jump:1.35,speed:1.1}],
 ['swift','迅捷的','Attack cooldown -30%.',{cooldown:.7}],
 ['farseeing','遠見的','Attack range +35%.',{range:1.35}],
 ['vast','廣域的','Attack radius +50%.',{radius:1.5}],
 ['brutal','殘暴的','25% chance to deal 1.8x direct damage.',{}],
 ['sundering','破甲的','Target takes +20% damage for 5s.',{}],
 ['enfeebling','虛弱的','Target contact damage -35% for 5s.',{}],
 ['binding','纏繞的','Root target for 1.2s (5s recovery).',{}],
 ['avaricious','貪婪的','Monster hits grant 2 coins (3s cooldown).',{}],
 ['resonant','共鳴的','Consecutive hits: +8% attack, up to 5 stacks; lasts 6s.',{}]
].map(([id,name,description,stats])=>({id,name,description,stats}));
export const affixById=id=>AFFIXES.find(a=>a.id===id);
export const FAMILY_TRAITS={water:'Soak: contact damage -20% for 3s.',fire:'Burn for 5s; damage ticks every second.',swatter:'Poison for 12s; smaller damage ticks every second.',ice:'Chill: movement -40% for 4s.',lightning:'Shock: stun 0.4s, with 3s recovery.',beam:'Expose: target takes +15% damage for 4s.',saber:'Bleed for 6s.',pan:'Knock target back 2m on impact.',wave:'Stagger: root 0.5s, with 3s recovery.',petal:'While equipped: +2 max HP, +12% attack, +8% speed, +10% jump.',planter:'While equipped: +2 max HP, +12% attack, +8% speed, +10% jump.',palm:'While equipped: +2 max HP, +12% attack, +8% speed, +10% jump.',whip:'While equipped: +2 max HP, +12% attack, +8% speed, +10% jump.'};
export function resolveItem(game,name,id){const instance=(game.weaponInstances?.[name]||[]).find(x=>x.id===id);if(!instance)return equipmentById(id);const base=equipmentById(instance.baseId),affix=affixById(instance.affixId);if(!base||!affix)return null;const s=affix.stats;return {...base,instanceId:instance.id,affixId:affix.id,name:affix.name+' '+base.name,cooldown:Math.round(base.cooldown*(s.cooldown||1)),range:base.range*(s.range||1),chargeRange:base.chargeRange*(s.range||1),radius:base.radius*(s.radius||1)};}
export function activeWeapon(game,name){const slots=game.equipment?.[name]||{};return resolveItem(game,name,slots.weaponInstance||slots.weapon)||DEFAULT_WEAPON;}
export function ownedBaseIds(game,name){return (game.inventories?.[name]||[]).map(id=>resolveItem(game,name,id)?.id||id);}
export function traitStats(game,name,now=Date.now()){
 const w=activeWeapon(game,name),s=affixById(w.affixId)?.stats||{},plant=['petal','planter','palm','whip'].includes(w.family),res=game.combatBuffs?.[name]?.resonance;
 return {hp:plant?2:0,attack:(plant?1.12:1)*(s.attack||1)*(w.affixId==='resonant'&&res?.until>now?1+.08*res.stacks:1),speed:(plant?1.08:1)*(s.speed||1),jump:(plant?1.1:1)*(s.jump||1),defense:s.defense||1};
}
