import {equipmentById} from './equipment-catalog.js';
import {createWeaponSignature,updateWeaponSignature,disposeWeaponSignature} from './weapon-effects.js';
// Visual echoes only: no additional projectiles, hits, or inherited ultimate summons.
export function createFusionEcho(T,shot){
 const items=(shot.fusionEffects||[]).slice(0,2).map(equipmentById).filter(x=>x?.slot==='weapon');
 if(!items.length)return null;
 const root=new T.Group(),direction=new T.Vector3(...shot.direction).normalize();
 root.name='First two fusion echoes';root.position.fromArray(shot.origin);
 root.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),direction);
 const layers=items.map((item,index)=>{const fx=createWeaponSignature(T,{...item,tier:Math.min(3,item.tier||1)},'burst');
  // Keep the source's distinct particle paths and line filaments; omit solid ornaments.
  const geometries=new Set(),materials=new Set();for(const mesh of [...fx.parts,...fx.ornaments]){mesh.removeFromParent();geometries.add(mesh.geometry);materials.add(mesh.material);}geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());fx.parts=[];fx.ornaments=[];
  const anchor=new T.Group();anchor.rotation.z=index*Math.PI*.7;anchor.add(fx.root);root.add(anchor);return {fx,anchor};});
 return {root,layers,shot,age:0,duration:shot.ultimate?1.7:.65};
}
export function updateFusionEcho(T,e,dt){
 e.age+=dt;const p=Math.min(1,e.age/e.duration),melee=['saber','whip','swatter','pan','planter','palm'].includes(e.shot.family);
 for(let i=0;i<e.layers.length;i++){const {fx,anchor}=e.layers[i];updateWeaponSignature(T,fx,e.age+i*.3,p);
  const size=e.shot.ultimate?2.5:1;fx.root.scale.multiplyScalar(size*.6);
  if(melee){const a=(p-.5)*Math.PI*1.3+i*.18;anchor.position.set(Math.sin(a)*Math.min(e.shot.range,6),Math.sin(p*Math.PI)*.8,Math.cos(a)*Math.min(e.shot.range,6));}
  else{anchor.position.set(Math.sin(p*12+i*Math.PI)*size*.5,Math.cos(p*12+i*Math.PI)*size*.5,Math.min(e.shot.range||10,120)*p);}
 }
 return p>=1;
}
export function disposeFusionEcho(e){for(const {fx} of e.layers)disposeWeaponSignature(fx);e.root.removeFromParent();}
