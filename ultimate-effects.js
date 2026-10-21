// Authored full-charge summons. +Z is the attack axis; all geometry is owned/disposed.
export const ultimateNames={saber:'Heavenfall Cleave',fire:'Inferno Dragon',ice:'Glacier Roc',lightning:'Tempest Thunderbird',planter:'World Tree',swatter:'Lord of the Swarm',pan:'Feast Avalanche',beam:'Solar Battery',water:'Leviathan Tide',whip:'Thorn Hydra',palm:'Emerald Monsoon',petal:'Lotus Empress',wave:'Event Horizon'};
export function createUltimate(T,item,shot){
 const root=new T.Group();root.name='Ultimate: '+ultimateNames[item.family];
 const f={root,family:item.family,age:0,duration:2.6,movers:[],materials:[],range:shot.range||35,radius:shot.radius||7};
 const colors={fire:0xff5720,ice:0x68ddff,lightning:0xb68aff,water:0x26bbdf,planter:0x64be86,swatter:0x6d9479,pan:0xffbc65,beam:0xffe6ac,palm:0x80e8a1,petal:0xff92d6,wave:0x8affdf,saber:item.color,whip:0xd587d4};const color=colors[f.family]||0xffffff;
 const mat=(c,glow=false)=>{const m=new (glow?T.MeshBasicMaterial:T.MeshPhongMaterial)({color:c,...(glow?{}:{emissive:c,emissiveIntensity:.16,shininess:85,specular:0xb5d5ed}),transparent:true,opacity:glow?.65:1,depthWrite:!glow,side:T.DoubleSide,blending:glow?T.AdditiveBlending:T.NormalBlending});m.userData.baseOpacity=m.opacity;f.materials.push(m);return m;};
 const main=mat(color),light=mat(0xf5eeff),dark=mat(f.family==='fire'?0x7d201c:0x28344c),glow=mat(color,true),gold=mat(0xffd784),green=mat(0x36775a);
 const mesh=(geo,m=main,parent=root)=>{const o=new T.Mesh(geo,m);parent.add(o);return o;};
 const ball=(x,y,z,s=1,m=main,parent=root)=>{const o=mesh(new T.IcosahedronGeometry(1,2),m,parent);o.position.set(x,y,z);o.scale.setScalar(s);return o;};
 const tube=(pts,r=.15,m=main,parent=root)=>mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),Math.max(16,pts.length*5),r,10,false),m,parent);
 const ring=(r,y,z,m=glow,parent=root)=>{const o=mesh(new T.TorusGeometry(r,.07,5,64),m,parent);o.position.set(0,y,z);return o;};
 const shard=(x,y,z,l,w,m=main,parent=root)=>{const o=mesh(new T.ConeGeometry(w,l,5),m,parent);o.position.set(x,y,z);return o;};
 const wing=(side,parent,featherMat=main)=>{const pivot=new T.Group();parent.add(pivot);pivot.position.set(side*.6,1,0);for(let j=0;j<11;j++){const feather=shard(side*(1+j*.32),-.2-j*.13,-j*.3,3+j*.13,.32,featherMat,pivot);feather.rotation.z=side*(-.8-j*.03);}tube([[0,0,0],[side*2,.6,0],[side*4,-1,-2]],.18,gold,pivot);f.movers.push({kind:'wing',o:pivot,side});return pivot;};
 const batch=(count,geo,m,kind)=>{const o=new T.InstancedMesh(geo,m,count);o.frustumCulled=false;o.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(o);f.movers.push({kind,o,count});return o;};
 const summon=new T.Group();root.add(summon);f.summon=summon;
 if(f.family==='fire'||f.family==='water'){
  // Sculpted serpentine body, plated spine, horned head, jaws and articulated wings/fins.
  tube([[0,1,-5],[-2,2,-2],[1,3,1],[0,3,5]],.95,main,summon);
  for(let j=0;j<22;j++){const z=-4+j*.4,x=Math.sin(j*.34)*.9;const scale=ball(x,3,z,.55,j%3?main:gold,summon);scale.scale.set(1,.4,.65);shard(x,4,z,.8,.24,gold,summon);}
  const head=ball(0,3.2,5.5,1.3,main,summon);head.scale.set(1,.8,1.5);const jaw=ball(0,2.5,6,.8,dark,summon);jaw.scale.set(1,.22,1.7);
  for(const side of [-1,1]){tube([[side*.7,3.7,5],[side*1.1,4.8,4.7],[side*.8,5.3,4]],.18,gold,summon);ball(side*.88,3.5,6.1,.22,light,summon);for(let j=0;j<5;j++)shard(side*.65,2.8,5+j*.35,.36,.1,light,summon);}
  if(f.family==='fire'){for(const side of [-1,1]){const w=wing(side,summon);const membrane=new T.Shape();membrane.moveTo(0,0);membrane.quadraticCurveTo(side*2,3,side*5,0);membrane.quadraticCurveTo(side*3,-1,side*3,-3);membrane.quadraticCurveTo(side*1.3,-1,0,0);const skin=mesh(new T.ShapeGeometry(membrane,24),main,w);skin.rotation.x=.5;for(let k=1;k<4;k++)tube([[0,0,0],[side*k,.5,-1],[side*(k+1),-1,-2]],.06,gold,w);}const flame=new T.ShaderMaterial({uniforms:{time:{value:0},fade:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;vec4 p=vec4(position,1.);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\ngl_Position=projectionMatrix*modelViewMatrix*p;}',fragmentShader:'varying vec2 vUv;uniform float time;uniform float fade;void main(){float n=sin(vUv.y*23.-time*14.+sin(vUv.x*19.)*2.);float edge=pow(max(0.,sin(vUv.x*3.14159)*sin(vUv.y*3.14159)),1.5);float a=edge*(.4+.2*n);gl_FragColor=vec4(mix(vec3(1.,.14,.015),vec3(1.,.88,.22),edge),a*fade);}',transparent:true,depthWrite:false,side:T.DoubleSide});flame.userData.baseOpacity=1;f.materials.push(flame);batch(160,new T.SphereGeometry(.6,10,8),flame,'breath');}
  else{for(const side of [-1,1]){const fin=shard(side*2,2,1,5,1.2,main,summon);fin.rotation.z=side*1.1;}for(let j=0;j<7;j++){const r=ring(2+j*.4,1,j*3);f.movers.push({kind:'wave',o:r,index:j});}batch(100,new T.SphereGeometry(.12,5,4),light,'spray');}
  f.movers.push({kind:'serpent',o:summon});
 }else if(['ice','lightning'].includes(f.family)){
  for(let j=0;j<34;j++){const a=j*2.399,yy=1+(j/34)*2.4;const armor=shard(Math.cos(a)*.8,yy,Math.sin(a)*1.2,1.2,.22,j%3?main:light,summon);armor.rotation.x=.6;}for(let j=0;j<7;j++){const crest=shard((j-3)*.17,4.3+j*.08,1.1-j*.15,1.2,.16,j%2?gold:main,summon);crest.rotation.x=-.6;}const body=ball(0,2,0,1.5,main,summon);body.scale.set(.7,1.2,1.7);ball(0,3.5,1.3,.8,main,summon);const beak=shard(0,3.3,2.3,1,.35,gold,summon);beak.rotation.x=Math.PI/2;for(const side of [-1,1]){ball(side*.45,3.7,1.8,.13,light,summon);wing(side,summon);tube([[side*.5,1,0],[side*.8,-.2,1],[side*1.2,-.4,1.7]],.13,gold,summon);}
  for(let j=0;j<7;j++){const tail=shard((j-3)*.3,1,-3,4,.3,main,summon);tail.rotation.x=-.8;}
  if(f.family==='ice'){for(let j=0;j<18;j++){const a=j*2.399;const s=shard(Math.cos(a)*5,Math.sin(a)*3+2,j*.6,2,.4,light);f.movers.push({kind:'crystal',o:s,index:j});}}
  else{for(let j=0;j<16;j++){const a=j*2.399,pts=Array.from({length:9},(_,k)=>[Math.cos(a)*k*.8+(k%2?.5:-.5),2+Math.sin(a)*k*.6,k*.9]);const bolt=tube(pts,.065,j%2?light:glow);f.movers.push({kind:'bolt',o:bolt,index:j});}}
  f.movers.push({kind:'bird',o:summon});
 }else if(f.family==='saber'){
  const blade=new T.Group();summon.add(blade);const edge=mesh(new T.BoxGeometry(.85,13,.22),light,blade);edge.position.y=6;const tip=shard(0,13,0,2,.6,light,blade);const core=mesh(new T.BoxGeometry(.28,12,.28),main,blade);core.position.y=6;mesh(new T.BoxGeometry(3,.35,.6),gold,blade);tube([[0,0,0],[0,-2,0]],.25,dark,blade);
  for(let j=0;j<10;j++){const rune=ring(.22,j+1,0,gold,blade);rune.rotation.z=j*.5;}
  f.movers.push({kind:'cleave',o:blade});
  for(let j=0;j<5;j++){const shape=new T.Shape();shape.absarc(0,0,5+j*.9,-1.25,1.25,false);shape.absarc(0,0,4.6+j*.9,1.25,-1.25,true);const arc=mesh(new T.ShapeGeometry(shape,48),j%2?glow:main);arc.rotation.y=Math.PI/2;f.movers.push({kind:'slash',o:arc,index:j});}
 }else if(f.family==='planter'||f.family==='palm'){
  tube([[0,-1,0],[.4,3,0],[-.3,7,.4],[0,12,0]],.65,dark,summon);
  for(let j=0;j<12;j++){const a=j*2.399,level=4+j*.55,ex=Math.cos(a)*(4+j%3),ez=Math.sin(a)*(4+j%3);tube([[0,level,0],[ex*.5,level+2,ez*.5],[ex,level+2,ez]],.15,green,summon);
   if(f.family==='planter'){for(let k=0;k<3;k++){const foliage=ball(ex+k*.4,level+2,ez,1.5,k===2?main:green,summon);foliage.scale.y=.65;ball(ex,level+1.4,ez,.3,gold,summon);}}
   else{const leaf=shard(ex*.8,level+2,ez*.8,6,1,green,summon);leaf.rotation.z=a;leaf.rotation.x=.9;ball(ex*.3,level,ez*.3,.65,gold,summon);}}
  for(let j=0;j<8;j++){const a=j*Math.PI/4;tube([[0,0,0],[Math.cos(a)*3,-.6,Math.sin(a)*3],[Math.cos(a)*6,-.8,Math.sin(a)*6]],.2,green,summon);}
  f.movers.push({kind:'grow',o:summon});batch(100,new T.IcosahedronGeometry(f.family==='palm'?.45:.13,0),f.family==='palm'?gold:light,f.family==='palm'?'meteors':'leaves');
 }else if(f.family==='swatter'){
  // Hundreds of individual flies assemble a horned, many-eyed silhouette.
  batch(650,new T.IcosahedronGeometry(.16,0),dark,'flies');const wings=mat(0x9cb5b4);wings.opacity=wings.userData.baseOpacity=.24;wings.depthWrite=false;batch(650,new T.SphereGeometry(.18,5,4),wings,'flywings');
  for(const side of [-1,1]){tube([[side,7,0],[side*3,10,0],[side*1.8,12,1]],.25,main,summon);for(let j=0;j<5;j++)ball(side*(.35+j*.28),7.8-j*.3,1,.22,light,summon);}
  const halo=ring(4,7,0,glow,summon);f.movers.push({kind:'halo',o:halo});
 }else if(f.family==='pan'){
  const portal=ring(4,3,0,gold);f.movers.push({kind:'halo',o:portal});
  const pan=mesh(new T.CylinderGeometry(3.7,3.3,.5,32),dark,summon);pan.rotation.x=Math.PI/2;pan.position.y=3;tube([[3,3,0],[7,3,0]],.3,dark,summon);
  batch(70,new T.TorusGeometry(.4,.22,6,12),gold,'food');batch(65,new T.SphereGeometry(.42,8,6),light,'eggs');batch(55,new T.ConeGeometry(.35,1,6),green,'vegetables');
 }else if(f.family==='beam'){
  for(let j=0;j<12;j++){const a=j*Math.PI/6,barrel=new T.Group();root.add(barrel);barrel.position.set(Math.cos(a)*4,Math.sin(a)*4+2,0);const gun=mesh(new T.CylinderGeometry(.4,.65,2,10),dark,barrel);gun.rotation.x=Math.PI/2;ring(.58,0,1,gold,barrel);const ray=mesh(new T.CylinderGeometry(.14,.34,1,8),light,barrel);ray.rotation.x=Math.PI/2;const sheath=mesh(new T.CylinderGeometry(.32,.55,1,8),glow,barrel);sheath.rotation.x=Math.PI/2;f.movers.push({kind:'laser',o:barrel,ray,sheath,index:j});}ring(5,2,0,gold);
 }else if(f.family==='whip'){
  for(let j=0;j<7;j++){const a=j*Math.PI*2/7,head=new T.Group();summon.add(head);const pts=Array.from({length:15},(_,k)=>[Math.cos(a+k*.4)*k*.35,1+Math.sin(k*.4+a)*2,k*1.1]);tube(pts,.32,main,head);for(let k=2;k<14;k++){const p=pts[k];shard(p[0],p[1]+.5,p[2],1,.2,gold,head);}const p=pts[14];const h=ball(...p,.8,dark,head);for(const side of [-1,1])ball(p[0]+side*.35,p[1]+.3,p[2]+.6,.12,light,head);f.movers.push({kind:'hydra',o:head,index:j});}
 }else if(f.family==='petal'){
  for(let j=0;j<24;j++){const a=j*2.399,petal=mesh(new T.SphereGeometry(1,12,8),j%3?main:light,summon);petal.scale.set(1.3,3.5,.18);petal.position.set(Math.cos(a)*(2+j%3),2+Math.sin(a)*2,j%3);petal.rotation.z=a;f.movers.push({kind:'petal',o:petal,index:j});}ball(0,2,0,1.2,gold,summon);batch(180,new T.OctahedronGeometry(.16,0),main,'leaves');
 }else{
  ball(0,3,0,2.5,dark,summon);for(let j=0;j<8;j++){const r=ring(3+j*.5,3,0,j%2?gold:glow,summon);r.rotation.set(j*.6,j*.4,j*.2);f.movers.push({kind:'orbit',o:r,index:j});}batch(100,new T.IcosahedronGeometry(.3,0),main,'rocks');
 }
 // Sparse luminous motes give depth without per-particle draw calls.
 batch(100,new T.OctahedronGeometry(.08,0),glow,'embers');
 root.position.fromArray(shot.origin);root.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...shot.direction).normalize());
 f.travel=Math.min(f.range,shot.impact?new T.Vector3(...shot.impact).distanceTo(new T.Vector3(...shot.origin)):f.range);
 batchStatic(T,f);f.transform=new T.Object3D();updateUltimate(T,f,0);return f;
}
export function updateUltimate(T,f,dt){
 f.age+=dt;const u=Math.min(1,f.age/f.duration),t=f.age,open=Math.min(1,u*7),fade=Math.min(1,(1-u)*5),travel=f.travel;
 f.root.scale.setScalar(Math.max(.01,open));for(const m of f.materials){m.opacity=m.userData.baseOpacity*fade;if(m.uniforms?.time)m.uniforms.time.value=t;if(m.uniforms?.fade)m.uniforms.fade.value=fade;}
 // A directional, expanding summon travels across the real attack corridor.
 f.summon.position.z=Math.min(travel*.55,18)*Math.min(1,u*2);
 for(const a of f.movers){const o=a.o,j=a.index||0;
  if(a.kind==='wing'){o.rotation.z=a.side*Math.sin(t*8)*.45;continue;}
  if(a.kind==='cleave'){o.rotation.z=-1.2+Math.min(1,u*2.5)*2.5;o.rotation.x=.3;continue;}
  if(a.kind==='slash'){o.position.set(0,2,travel*Math.max(0,Math.min(1,(u-j*.045)*1.5)));o.scale.setScalar(.6+u*.7);continue;}
  if(a.kind==='serpent'){o.position.y=Math.sin(t*5)*.5;o.rotation.y=Math.sin(t*3)*.15;continue;}
  if(a.kind==='bird'){o.position.y=1+Math.sin(t*3);o.rotation.x=-.15;continue;}
  if(a.kind==='grow'){o.scale.y=Math.max(.01,Math.min(1,u*4));continue;}
  if(a.kind==='halo'){o.rotation.z=t*.7;continue;}
  if(a.kind==='orbit'){o.rotation.x+=dt*(j%2?1:-1);o.rotation.y+=dt*.7;continue;}
  if(a.kind==='wave'){o.scale.setScalar(1+u);o.position.z=j*3+u*travel*.5;continue;}
  if(a.kind==='hydra'){o.rotation.z=Math.sin(t*5+j)*.22;continue;}
  if(a.kind==='petal'){o.rotation.y=Math.sin(t*2+j)*.8;continue;}
  if(a.kind==='bolt'){o.visible=Math.sin(t*36+j)>-.35;continue;}
  if(a.kind==='crystal'){o.rotation.z=t+j;o.position.z+=dt*travel*.5;continue;}
  if(a.kind==='laser'){const length=travel*Math.min(1,u*7);for(const beam of [a.ray,a.sheath]){beam.scale.y=length;beam.position.z=length/2+1;}o.rotation.z=t*.2;continue;}
  if(!a.count)continue;
  const d=f.transform;
  for(let i=0;i<a.count;i++){
   const h=((i*.61803398875)%1),angle=i*2.39996+t,flow=(u*1.5+h)%1;let x,y,z,s=1;
   if(a.kind==='flies'||a.kind==='flywings'){
    const section=i%5,yy=h*10;let xx=0,zz=Math.sin(i*3)*.65;
    if(section===0){xx=Math.sin(i)*1.3;y=7+Math.cos(i)*1.3;}else if(section===1){xx=Math.sin(i)*1.5;y=3+yy*.4;}else if(section===2){xx=(i%2?1:-1)*(1+h*4);y=6-h*2;}else{xx=(i%2?1:-1)*(.7+h);y=h*3;}
    const scatter=Math.max(0,1-u*5)+Math.max(0,u-.7)*4;x=xx+Math.sin(angle*3)*scatter*5;y+=Math.cos(angle*2)*scatter*3;z=zz+Math.sin(angle)*scatter*4+Math.min(travel*.55,18)*Math.min(1,u*2);s=a.kind==='flywings'?.25+Math.abs(Math.sin(t*50+i))*.35:.8;
   }else if(['food','eggs','vegetables'].includes(a.kind)){x=Math.cos(angle)*f.radius*flow;y=3+Math.sin(angle)*f.radius*.5*flow+Math.sin(flow*Math.PI)*2;z=flow*travel;s=.6+h;}
   else if(a.kind==='rocks'){x=Math.cos(angle)*6;y=3+Math.sin(angle)*4;z=Math.sin(angle*.7)*5+f.summon.position.z;s=.5+h*2;}
   else if(a.kind==='meteors'){x=Math.cos(angle)*f.radius;y=(1-flow)*14;z=h*travel;s=.8+h;}
   else if(a.kind==='breath'){x=Math.cos(angle)*flow*4;y=3+Math.sin(angle)*flow*3;z=6+flow*Math.max(5,travel-6);s=(.6+flow*2)*(1-flow*.4);}
   else{x=Math.cos(angle)*f.radius*(.2+flow);y=a.kind==='leaves'?flow*12:1+Math.sin(angle)*3+flow*3;z=flow*travel;s=.6+h;}
   d.position.set(x,y,z);d.rotation.set(t+i,t*.8+i,i);d.scale.setScalar(s);if(a.kind==='flywings')d.scale.set(s*2,.1,s);if(a.kind==='eggs')d.scale.y*=.3;if(a.kind==='breath')d.scale.set(s,s*1.3,s*3);d.updateMatrix();o.setMatrixAt(i,d.matrix);
  }o.instanceMatrix.needsUpdate=true;
 }
}
export function disposeUltimate(f){f.root.removeFromParent();const gs=new Set(),ms=new Set();f.root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);if(o.isInstancedMesh)o.dispose();});for(const g of gs)g.dispose();for(const m of ms)m.dispose();}

function batchStatic(T,f){
 const moving=new Set(f.movers.flatMap(m=>[m.o,m.ray,m.sheath]).filter(Boolean));
 const visit=parent=>{for(const child of [...parent.children])if(child.isGroup)visit(child);const groups=new Map();for(const child of parent.children){if(!child.isMesh||child.isInstancedMesh||moving.has(child))continue;const list=groups.get(child.material)||[];list.push(child);groups.set(child.material,list);}
 for(const [material,meshes] of groups){if(meshes.length<2)continue;const parts=meshes.map(m=>{m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);return g;}),total=parts.reduce((n,g)=>n+g.attributes.position.count,0),g=new T.BufferGeometry();for(const [name,width] of [['position',3],['normal',3],['uv',2]]){const array=new Float32Array(total*width);let offset=0;for(const part of parts){if(part.attributes[name])array.set(part.attributes[name].array,offset);offset+=part.attributes.position.count*width;}g.setAttribute(name,new T.BufferAttribute(array,width));}for(const m of meshes){m.removeFromParent();m.geometry.dispose();}for(const part of parts)part.dispose();parent.add(new T.Mesh(g,material));}};visit(f.root);
}
