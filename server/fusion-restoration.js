import {EQUIPMENT,equipmentById} from '../equipment-catalog.js';
import {AFFIXES,rollDropStats} from '../combat-traits.js';
// One-time, explicit user-approved approximate restoration. Originals remain in a private backup.
export function restoreLegacyFusion(g,now=Date.now()){
 if(g.fusionResetVersion===2)return false;
 g.fusionResetBackup=structuredClone({weaponInstances:g.weaponInstances||{},inventories:g.inventories||{},equipment:g.equipment||{},fusionReceipts:g.fusionReceipts||{},time:now});
 const report={time:now,targets:0,materials:0,unresolved:[],approximate:true};
 for(const [name,list] of Object.entries(g.weaponInstances||{})){
  const restored=[];g.inventories??={};const own=g.inventories[name]??=[];
  for(const i of list){if(!i.fusionCount)continue;report.targets++;const base=equipmentById(i.baseId);if(!base){report.unresolved.push(i.id);continue;}
   for(const [n,source] of (i.fusionSources||[]).entries()){
    const base=EQUIPMENT.filter(x=>source.name===x.name||source.name.endsWith(' '+x.name)).sort((a,b)=>b.name.length-a.name.length)[0];
    if(!base){report.unresolved.push(source.name);continue;}
    const affix=AFFIXES.find(a=>source.name.endsWith(a.name+' '+base.name));
    const id='restored-'+i.id+'-'+n,level=i.sourceLevel||30;
    restored.push({id,baseId:base.id,affixId:affix?.id,...rollDropStats(base,level,()=>.5),obtainedAt:now,origin:affix||base.notForSale?'monster':'shop',restoredApproximate:true});own.push(id);report.materials++;
   }
   i.stats=rollDropStats(base,i.sourceLevel||30,()=>.5).stats;i.fusionCount=0;i.fusionSources=[];i.fusionEffects=[];i.restoredApproximate=true;
  }
  list.push(...restored);
 }
 g.fusionResetVersion=2;g.fusionRestoration=report;g.equipmentRevision=(g.equipmentRevision||0)+1;g.worldRevision=(g.worldRevision||0)+1;return true;
}
