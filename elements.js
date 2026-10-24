// Deterministic element identity shared by UI and authoritative combat.
export const ELEMENTS=['wind','water','fire','earth','light','dark'];
export const ELEMENT_NAMES={wind:'Wind',water:'Water',fire:'Fire',earth:'Earth',light:'Light',dark:'Dark'};
export const ELEMENT_COLORS={wind:'#a8efc0',water:'#83cfff',fire:'#ff9470',earth:'#d9b17a',light:'#fff2a7',dark:'#c292ff'};
export const COUNTERS={water:'fire',fire:'wind',wind:'earth',earth:'water',light:'dark',dark:'light'};
export function elementMultiplier(attack,defense){return attack&&defense&&COUNTERS[attack]===defense?2:1;}
export function itemElement(item){if(!item)return null;if(ELEMENTS.includes(item.element))return item.element;const family={water:'water',ice:'water',fire:'fire',lightning:'wind',beam:'light',saber:'light',petal:'earth',wave:'wind',planter:'earth',palm:'earth',whip:'earth',swatter:'dark',pan:'fire',seed:'earth',harvest:'earth'};if(family[item.family])return family[item.family];const h=[...(item.id||item.species||'fish')].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,0);return ELEMENTS[h%6];}
