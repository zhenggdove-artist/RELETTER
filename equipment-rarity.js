export const RARITIES=[{id:'white',name:'White',color:'#f2eff8'},{id:'green',name:'Green',color:'#7fd59b'},{id:'blue',name:'Blue',color:'#80b6f0'},{id:'red',name:'Red',color:'#ed8a99'},{id:'gold',name:'Gold',color:'#edd17e'},{id:'purple',name:'Purple',color:'#bb82ed'}];
export function itemRarity(item){return RARITIES[item?.affixId?5:Math.max(0,Math.min(5,(item?.tier||1)-1))];}
export function equipmentSaleValue(item){return item?.id==='water'?0:Math.max(1,Math.floor((item?.price||0)*.4)+(item?.affixId?20:0));}
