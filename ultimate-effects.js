import {makeArt,artPalettes} from './ultimate-art.js';
export const ultimateNames={saber:'Heavenfall Cleave',fire:'Inferno Dragon',ice:'Glacier Roc',lightning:'Tempest Thunderbird',planter:'World Tree',swatter:'Lord of the Swarm',pan:'Feast Avalanche',beam:'Solar Battery',water:'Leviathan Tide',whip:'Thorn Hydra',palm:'Emerald Monsoon',petal:'Lotus Empress',wave:'Event Horizon'};
const banks=new WeakMap();
const fieldVertex=`varying vec2 vUv;uniform float uTime,uKind,uSpan;varying float vSeed;
#ifdef USE_INSTANCING
attribute vec4 aSeed;
#endif
void main(){vUv=uv;vSeed=0.;vec3 p=position;
#ifdef USE_INSTANCING
vSeed=aSeed.x;p=(instanceMatrix*vec4(p,1.)).xyz;
float a=aSeed.x*6.28318,q=fract(aSeed.y+uTime*.38);
if(uKind<1.5){p+=vec3(sin(a+uTime*2.)*q*3.,3.+cos(a*1.3+uTime)*q*1.8,q*uSpan);}
else if(uKind<2.5){p.z*=uSpan*smoothstep(0.,.28,uTime);}
else if(uKind<3.5){p+=vec3(sin(a*7.+uTime*17.),cos(a*5.+uTime*13.),sin(a*3.+uTime*19.))*(.12+.9*smoothstep(1.8,2.8,uTime));}
#endif
p.x+=sin(vUv.y*14.-uTime*8.)*.05*vUv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const fieldFragment=`precision highp float;varying vec2 vUv;varying float vSeed;uniform float uTime,uKind,uFade;uniform vec3 uColor,uEdge;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
void main(){float edge=pow(max(0.,sin(vUv.x*3.14159)),1.4);float ends=sin(clamp(vUv.y,0.,1.)*3.14159);float noise=sin(vUv.y*37.-uTime*9.+sin(vUv.x*21.+uTime)*1.6);float a=edge*ends;
if(uKind<1.5){vec2 p=vUv*vec2(3.,5.)-vec2(0.,uTime*2.+vSeed*9.);float cloud=noise2(p)*.65+noise2(p*2.13)*.35;a*=smoothstep(.25,.75,cloud)*.85;}
else if(uKind<2.5)a*=.55+.16*sin(vUv.y*110.-uTime*20.);
else if(uKind<3.5)a*=.32;
else a*=.65+.25*sin(vUv.y*35.-uTime*7.);
vec3 c=mix(uEdge,uColor,pow(edge,.8));gl_FragColor=vec4(c,a*uFade);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
function addFields(T,art,family){
 const {root,materials,palette}=art;const fields=new T.Group();fields.name='Spell field';root.add(fields);const flows=[];
 function field(kind,color=palette[2],edge=palette[1]){const m=new T.ShaderMaterial({vertexShader:fieldVertex,fragmentShader:fieldFragment,uniforms:{uTime:{value:0},uFade:{value:1},uKind:{value:kind},uSpan:{value:30},uColor:{value:new T.Color(color)},uEdge:{value:new T.Color(edge)}},transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.NormalBlending});materials.push(m);return m;}
 const dummy=new T.Object3D();
 function instances(geometry,material,count,mode,position){const seeds=new Float32Array(count*4),o=new T.InstancedMesh(geometry,material,count);for(let i=0;i<count;i++){const h=(i*.61803398875)%1;seeds.set([h,(i*.41421356)%1,(i*.73205)%1,i/count],i*4);dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.setScalar(.7+h*.6);position?.(dummy,i,h);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix);}geometry.setAttribute('aSeed',new T.InstancedBufferAttribute(seeds,4));o.instanceMatrix.setUsage(T.StaticDrawUsage);o.frustumCulled=false;o.userData.cachedInstances=true;o.boundingBox=new T.Box3(new T.Vector3(-8,-2,-2),new T.Vector3(8,14,160));fields.add(o);if(material.uniforms.uMotion)material.uniforms.uMotion.value=mode;return o;}
 function artMaterial(index,motion){const m=art.materials[index].clone();m.uniforms.uMotion.value=motion;materials.push(m);return m;}
 function ribbon(points,width,material){const c=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),v=[],uv=[],idx=[];for(let i=0;i<=64;i++){const t=i/64,p=c.getPoint(t),tangent=c.getTangent(t),side=new T.Vector3(-tangent.y,tangent.x,.1).normalize(),w=Math.sin(t*Math.PI)*width;for(const sign of [-1,1]){v.push(p.x+side.x*w*sign,p.y+side.y*w*sign,p.z+side.z*w*sign);uv.push(sign<0?0:1,t);}if(i<64){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const o=new T.Mesh(g,material);o.frustumCulled=false;fields.add(o);return o;}
 if(family==='fire'){
  const g=new T.PlaneGeometry(1.1,3,2,10);instances(g,field(1,'#ffc97d','#ce3a23'),64,0,(d,i,h)=>{d.rotation.y=i*2.399;d.rotation.x=.5;d.position.z=6;d.scale.set(.6+h,1+h,1);});
  for(let j=0;j<3;j++){const r=ribbon([[0,3,4],[2-j*2,3.5,8],[-2+j*2,3,15],[0,4,25]],.65,field(1));flows.push({o:r,kind:'flame',index:j});}
 }else if(family==='beam'){
  const g=new T.CylinderGeometry(.045,.12,1,6,1,true);g.rotateX(Math.PI/2);g.translate(0,0,.5);instances(g,field(2,'#d9eee3','#6bafc0'),12,0,(d,i)=>{const a=i*Math.PI/6;d.position.set(Math.cos(a)*3.4,3+Math.sin(a)*3.4,1.6);d.scale.setScalar(1);});
  for(let j=0;j<2;j++){const r=ribbon([[0,0,2],[2,3,6],[0,6,10],[-2,3,14],[0,0,18]],.12,field(4));flows.push({o:r,kind:'helix',index:j});}
 }else if(family==='lightning'){
  // Branched fractal bolts use thin, tapered ribbons instead of thick glowing tubes.
  for(let j=0;j<9;j++){const side=j%2?1:-1,pts=[];for(let k=0;k<11;k++)pts.push([side*(k*.45)+Math.sin(k*9+j)*.28,2+Math.sin(k*.7+j)*2,k*1.2]);const o=ribbon(pts,.045,field(4,'#efdfab','#7768bd'));flows.push({o,kind:'lightning',index:j});}
 }else if(family==='ice'){
  const g=new T.OctahedronGeometry(.2);g.scale(.6,3,.6);instances(g,artMaterial(2,1),64,1);
  for(let j=0;j<3;j++){const pts=Array.from({length:25},(_,k)=>{const a=k/24*Math.PI*2;return [Math.cos(a)*(3+j),2+Math.sin(a)*2,j*4];});flows.push({o:ribbon(pts,.12,field(4)),kind:'snow',index:j});}
 }else if(family==='saber'){
  for(let j=0;j<3;j++){const pts=Array.from({length:25},(_,k)=>{const a=-1.2+k/24*2.4;return [Math.sin(a)*(7+j*.7),Math.cos(a)*(7+j*.7)-2,0];});const o=ribbon(pts,j===0?.6:.15,field(4,palette[3],palette[1]));flows.push({o,kind:'cleave',index:j});}
 }else if(family==='swatter'){
  const positions=(d,i,h)=>{const a=i*2.399,part=i%4,y=part===0?6+h*3:part===1?2+h*4:h*2;const r=part===0?.6:part===1?.6+h*.5:1+h*1.7;d.position.set(Math.cos(a)*r,y,Math.sin(a)*r);d.rotation.set(i,i*.4,0);d.scale.set(.6+h,.6+h,.6+h);};
  instances(new T.SphereGeometry(.055,5,4),artMaterial(0,3),320,3,positions);const wing=new T.PlaneGeometry(.23,.075);instances(wing,field(3),320,0,positions);
 }else if(family==='pan'){
  // Dumplings are pleated half-shells, shrimp have articulated curls, eggs are asymmetric.
  const dumpling=new T.SphereGeometry(.38,14,8,0,Math.PI*2,0,Math.PI*.6);dumpling.scale(1,.6,.65);instances(dumpling,artMaterial(2,2),38,2,(d,i,h)=>{d.rotation.set(i,h*6,i*.7);});
  const shrimp=new T.TorusGeometry(.27,.09,5,16,Math.PI*1.6);const shrimpMat=artMaterial(4,2);shrimpMat.uniforms.uMid.value.set('#d87958');shrimpMat.uniforms.uLight.value.set('#efbe8c');instances(shrimp,shrimpMat,32,2,(d,i)=>d.rotation.set(i,i*.7,i*.3));
  const egg=new T.SphereGeometry(.34,10,6);egg.scale(1.3,.1,.85);instances(egg,artMaterial(2,2),28,2,(d,i)=>d.rotation.set(i*.2,i*.4,i*.1));const yolk=new T.SphereGeometry(.16,8,5);yolk.translate(0,.08,0);const yolkMat=artMaterial(1,2);yolkMat.uniforms.uMid.value.set('#ed9d35');instances(yolk,yolkMat,28,2,(d,i)=>d.rotation.set(i*.2,i*.4,i*.1));
 }else if(family==='wave'){
  const rocks=new T.IcosahedronGeometry(.22,0);instances(rocks,artMaterial(4,2),48,2);
  for(let j=0;j<4;j++){const pts=Array.from({length:49},(_,k)=>{const a=k/48*Math.PI*2;return [Math.cos(a)*(3+j*.5),3+Math.sin(a)*(3+j*.5),Math.sin(a*2)*.5];});const o=ribbon(pts,.16,field(4));flows.push({o,kind:'orbit',index:j});}
 }else{
  const petal=new T.SphereGeometry(.13,5,4);petal.scale(1,.15,2.5);instances(petal,artMaterial(family==='palm'?4:2,family==='palm'?4:1),family==='planter'?72:56,family==='palm'?4:1);
  for(let j=0;j<3;j++){const pts=Array.from({length:33},(_,k)=>{const a=k/32*Math.PI*3;const r=2+a*.28;return [Math.cos(a+j)*r,1+k*.18,Math.sin(a+j)*r+k*.5];});flows.push({o:ribbon(pts,family==='water'?.36:.12,field(4)),kind:family==='water'?'tide':'helix',index:j});}
 }
 // One bounded point draw, GPU animated, soft core rather than geometric confetti.
 const count=family==='swatter'?40:96,positions=new Float32Array(count*3),seed=new Float32Array(count*4);for(let i=0;i<count;i++){positions[i*3]=0;seed.set([(i*.618)%1,(i*.414)%1,(i*.732)%1,i/count],i*4);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));geo.setAttribute('aSeed',new T.BufferAttribute(seed,4));
 const pm=new T.ShaderMaterial({uniforms:{uTime:{value:0},uFade:{value:1},uSpan:{value:30},uColor:{value:new T.Color(palette[2])}},vertexShader:'attribute vec4 aSeed;uniform float uTime,uSpan;varying float life;void main(){float t=fract(aSeed.y+uTime*.32);life=sin(t*3.14159);float a=aSeed.x*6.28318;vec3 p=vec3(cos(a+uTime)*(.5+t*4.),t*6.+sin(a)*2.,t*uSpan);vec4 view=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp((1.+aSeed.z*2.)*30./max(1.,-view.z),1.,5.);gl_Position=projectionMatrix*view;}',fragmentShader:'uniform vec3 uColor;uniform float uFade;varying float life;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(uColor,pow(1.-d,2.)*life*uFade*.65);}',transparent:true,depthWrite:false});materials.push(pm);const points=new T.Points(geo,pm);points.frustumCulled=false;fields.add(points);
 return {fields,flows};
}
function bankFor(T){let bank=banks.get(T);if(!bank){bank=new Map();banks.set(T,bank);}return bank;}
function template(T,family){const bank=bankFor(T);if(bank.has(family))return bank.get(family);const start=performance.now(),art=makeArt(T,family),{fields,flows}=addFields(T,art,family);art.root.name='Ultimate: '+ultimateNames[family];art.body.name='Sculpted summon';let id=0;art.root.traverse(o=>{o.userData.artId=id++;});const descriptors=art.parts.map(p=>({id:p.o.userData.artId,motion:p.motion,side:p.side,phase:p.phase})),flowDescriptors=flows.map(p=>({id:p.o.userData.artId,kind:p.kind,index:p.index}));const result={...art,descriptors,flowDescriptors,buildMs:performance.now()-start};bank.set(family,result);return result;}
export async function prepareUltimates(T,renderer,camera){
 const target=new T.WebGLRenderTarget(32,32,{depthBuffer:true}),temp=new T.Scene(),view=camera.clone();view.position.set(16,10,22);view.lookAt(0,4,4);const timings=[];
 try{for(const family of ['water','saber','fire','ice','lightning','planter','swatter','pan','beam','whip','palm','petal','wave']){await new Promise(resolve=>setTimeout(resolve,30));const art=template(T,family);temp.add(art.root);await renderer.compileAsync(temp,view);const previous=renderer.getRenderTarget();renderer.setRenderTarget(target);renderer.render(temp,view);renderer.setRenderTarget(previous);temp.remove(art.root);timings.push({family,buildMs:art.buildMs});}}finally{target.dispose();}return timings;
}
export function createUltimate(T,item,shot){
 const family=item.family in ultimateNames?item.family:'water',source=template(T,family),root=source.root.clone(true),objects=new Map(),clones=new Map(),materials=[];
 root.traverse(o=>{objects.set(o.userData.artId,o);if(o.material){if(!clones.has(o.material)){const m=o.material.clone();clones.set(o.material,m);materials.push(m);}o.material=clones.get(o.material);}});
 const bind=d=>({...d,o:objects.get(d.id),rotation:objects.get(d.id).rotation.clone(),position:objects.get(d.id).position.clone()});
 const f={root,family,age:0,duration:2.9,materials,parts:source.descriptors.map(bind),flows:source.flowDescriptors.map(bind),body:objects.get(source.body.userData.artId),range:shot.range||30,radius:shot.radius||6,tier:item.tier||1};
 root.position.fromArray(shot.origin);root.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...shot.direction).normalize());
 f.travel=Math.min(f.range,shot.impact?new T.Vector3(...shot.impact).distanceTo(new T.Vector3(...shot.origin)):f.range);
 for(const m of materials)if(m.uniforms.uSpan)m.uniforms.uSpan.value=f.travel;
 updateUltimate(T,f,0);return f;
}
export function updateUltimate(T,f,dt){
 f.age+=dt;const t=f.age,u=Math.min(1,t/f.duration),open=Math.min(1,t/.22),fade=Math.min(1,open,(f.duration-t)/.5),advance=Math.min(f.travel*.4,18)*(1-Math.pow(1-Math.min(1,t/1.5),2));
 f.root.scale.setScalar(.8+Math.min(5,f.tier)*.04);f.root.visible=fade>0;
 for(const m of f.materials){if(m.uniforms.uTime)m.uniforms.uTime.value=t;if(m.uniforms.uFade)m.uniforms.uFade.value=Math.max(0,fade);}
 for(const p of f.parts){const o=p.o;o.rotation.copy(p.rotation);o.position.copy(p.position);
  switch(p.motion){case 'body':o.position.z=advance;if(['fire','water'].includes(f.family)){o.position.y=Math.sin(t*2.4)*.18;o.rotation.y=Math.sin(t*2)*.06;}if(['ice','lightning'].includes(f.family))o.position.y=.6+Math.sin(t*2)*.25;if(f.family==='saber'){o.rotation.z=-.9+Math.min(1,t/.8)*1.8;o.position.y=2;}if(['planter','palm'].includes(f.family))o.scale.y=Math.max(.02,Math.min(1,t/.65));break;
   case 'wing':o.rotation.z+=p.side*Math.sin(t*5.5)*.32;o.rotation.x+=Math.cos(t*5.5)*.08;break;
   case 'dragon-wing':o.rotation.z+=p.side*(.1+Math.sin(t*4)*.23);break;
   case 'head':o.rotation.y+=Math.sin(t*2.3)*.025;break;
   case 'fin':o.rotation.z+=p.side*Math.sin(t*3)*.16;break;
   case 'frond':o.rotation.z+=Math.sin(t*2.5+p.phase)*.07;break;
   case 'hydra':o.rotation.y+=Math.sin(t*3+p.phase)*.09;o.rotation.z+=Math.sin(t*4+p.phase)*.05;break;
   case 'pan':o.rotation.z+=Math.sin(t*2)*.12;break;
   case 'flower':o.rotation.z+=t*.12;break;
   case 'barrel':o.position.z+=Math.sin(t*12+p.phase)*.09;break;
   case 'orrery':o.rotation.x+=t*(p.side%2?.35:-.35);o.rotation.y+=t*.2;break;
  }
 }
 for(const p of f.flows){const o=p.o;o.position.copy(p.position);o.rotation.copy(p.rotation);
  if(p.kind==='cleave'){o.position.z=Math.min(f.travel,Math.max(0,t-p.index*.12)*f.travel*.7);o.rotation.z=.4+p.index*.15;}
  else if(p.kind==='lightning'){o.position.z=advance*.7;o.visible=Math.sin(t*26+p.index*2)>.05;}
  else if(p.kind==='orbit'){o.position.z=advance;o.rotation.y=t*.35+p.index*.5;o.rotation.x=p.index*.4;}
  else if(p.kind==='snow'){o.position.z=advance+p.index*3;o.rotation.z=t*.3;}
  else if(p.kind==='tide'){o.position.z=t*5;o.rotation.y=t*.25;}
  else if(p.kind==='helix'){o.position.z=advance*.6;o.rotation.z=t*.2+p.index*2;}
 }
}
export function disposeUltimate(f){f.root.removeFromParent();for(const m of f.materials)m.dispose();f.root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}
export function ultimateCacheStats(T){return [...bankFor(T)].map(([family,a])=>{let triangles=0,draws=0,bytes=0;const geometries=new Set();a.root.traverse(o=>{if(o.isMesh||o.isPoints){draws++;if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);geometries.add(o.geometry);}});for(const g of geometries){for(const attr of Object.values(g.attributes))bytes+=attr.array.byteLength;bytes+=g.index?.array.byteLength||0;}return {family,draws,triangles,bytes,buildMs:a.buildMs};});}
