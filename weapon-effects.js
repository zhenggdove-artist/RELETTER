// Family-specific charge and impact compositions. Bounded meshes, one particle buffer,
// and one line buffer per effect keep rapid combinations predictable on phones.
export const signatureStyles={saber:'astral-blades',whip:'thorn-helix',swatter:'prism-lattice',pan:'thermal-anvil',planter:'world-blossom',palm:'canopy-cyclone',water:'tidal-orbit',ice:'crystal-snowflake',fire:'phoenix-furnace',lightning:'branching-storm',beam:'prismatic-iris',petal:'lotus-spiral',wave:'gravity-ripples'};
export function createWeaponSignature(T,item,mode='charge'){
 const family=item.family||'water',tier=Math.max(1,item.tier||1),root=new T.Group(),parts=[],count=6+tier*2;
 root.name=signatureStyles[family]||signatureStyles.water;root.userData.style=root.name;
 const material=new T.MeshBasicMaterial({color:item.color||'#89eaff',transparent:true,opacity:.72,side:T.DoubleSide,depthWrite:false,blending:T.NormalBlending});
 const leaf=()=>{const g=new T.BufferGeometry(),v=[],uv=[],indices=[];for(let i=0;i<=20;i++){const t=i/20,width=Math.sin(t*Math.PI)*.28;for(const side of [-1,1]){v.push(side*width,t,Math.sin(t*Math.PI)*.18+side*side*.015);uv.push(side===-1?0:1,t);}if(i<20){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;};

 const geometries={saber:()=>new T.ConeGeometry(.09,.9,4),whip:()=>new T.ConeGeometry(.065,.4,4),swatter:()=>new T.BoxGeometry(.7,.025,.025),pan:()=>new T.TorusGeometry(.45,.04,6,32),planter:leaf,palm:leaf,water:()=>new T.SphereGeometry(.1,8,6),ice:()=>new T.OctahedronGeometry(.19),fire:leaf,lightning:()=>new T.OctahedronGeometry(.12),beam:()=>new T.TorusGeometry(.5,.025,4,6),petal:leaf,wave:()=>new T.TorusGeometry(.5,.028,6,40)};
 const flame=family==='fire'?new T.ShaderMaterial({uniforms:{time:{value:0},fade:{value:1},tint:{value:new T.Color(item.color)}},vertexShader:'varying vec2 vUv;uniform float time;void main(){vUv=uv;vec3 p=position;p.x+=sin(uv.y*9.-time*6.)*.14*uv.y;p.z+=cos(uv.y*7.+time*4.)*.1*uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',fragmentShader:'varying vec2 vUv;uniform float time;uniform float fade;uniform vec3 tint;void main(){float curl=sin(vUv.y*16.-time*8.)*.15;float edge=pow(max(0.,sin(clamp(vUv.x+curl,0.,1.)*3.14159)),.7);float flicker=.75+.25*sin(vUv.y*22.-time*12.);gl_FragColor=vec4(mix(vec3(1.,.7,.15),tint,vUv.y),edge*(1.-vUv.y*.8)*fade*flicker);}',transparent:true,side:T.DoubleSide,depthWrite:false,blending:T.NormalBlending}):material;
 const geometry=(geometries[family]||geometries.water)();for(let i=0;i<count;i++){const mesh=new T.Mesh(geometry,flame);root.add(mesh);parts.push(mesh);}
 const ornaments=[];
 if(tier>=3){const crownGeometries={saber:()=>new T.TorusGeometry(.42,.018,6,32,Math.PI*1.5),whip:()=>new T.IcosahedronGeometry(.18),swatter:()=>new T.BoxGeometry(.45,.45,.035),pan:()=>new T.CylinderGeometry(.3,.22,.08,16),planter:()=>new T.SphereGeometry(.2,12,8),palm:()=>new T.SphereGeometry(.22,10,8),water:()=>new T.TorusGeometry(.34,.035,8,32),ice:()=>new T.ConeGeometry(.13,.7,5),fire:()=>new T.TorusGeometry(.35,.025,6,24),lightning:()=>new T.CylinderGeometry(.01,.06,.7,5),beam:()=>new T.OctahedronGeometry(.28),petal:()=>new T.SphereGeometry(.16,8,8),wave:()=>new T.SphereGeometry(.35,12,8,0,Math.PI*2,0,Math.PI/2)};
  const g=(crownGeometries[family]||crownGeometries.water)();for(let i=0;i<tier-1;i++){const m=new T.Mesh(g,material);root.add(m);ornaments.push(m);}
 }
 const n=80+tier*32,pointsGeo=new T.BufferGeometry();pointsGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3),3));
 const pointMaterial=new T.ShaderMaterial({uniforms:{tint:{value:new T.Color(item.color||'#89eaff')},fade:{value:1},size:{value:4+tier}},vertexShader:'uniform float size;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*12./max(1.,-p.z),2.,14.);gl_Position=projectionMatrix*p;}',fragmentShader:'uniform vec3 tint;uniform float fade;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(mix(tint,vec3(1.),pow(1.-d,4.)),pow(1.-d,2.)*fade);}',transparent:true,depthWrite:false,blending:T.AdditiveBlending});
 const points=new T.Points(pointsGeo,pointMaterial);points.frustumCulled=false;root.add(points);
 const lineGeo=new T.BufferGeometry();lineGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(96*6),3));const lines=new T.LineSegments(lineGeo,new T.LineBasicMaterial({color:item.color||'#89eaff',transparent:true,opacity:.75,depthWrite:false,blending:T.AdditiveBlending}));lines.frustumCulled=false;root.add(lines);
 return {root,family,tier,parts,ornaments,points,lines,mode,age:0};
}
function path(f,a,t,time,out){
 const c=Math.cos(a),s=Math.sin(a);
 switch(f){
 case 'saber':out.set(c*(.6+t),s*(.6+t),Math.sin(a*5+time)*.18);break;
 case 'whip':out.set(Math.sin(a+time*3)*(.3+t),t*2-1,Math.cos(a+time*3)*(.3+t));break;
 case 'swatter':out.set((Math.round(c*3)/3)*1.5,(Math.round(s*3)/3)*1.5,Math.sin(time*5+t*12)*.12);break;
 case 'pan':out.set(c*t*1.5,Math.sin(t*Math.PI)*.2-.7,s*t*1.5);break;
 case 'planter':{const r=.3+Math.sin(a*5)**2*t;out.set(c*r,t*1.6-.7,s*r);break;}
 case 'palm':out.set(c*(1.5-t),t*2-1,s*(1.5-t));break;
 case 'ice':{const r=.3+t;out.set(Math.cos(Math.round(a/Math.PI*3)*Math.PI/3)*r,s*t,Math.sin(Math.round(a/Math.PI*3)*Math.PI/3)*r);break;}
 case 'fire':out.set(c*(1-t)*.8,t*2.4-.8,s*(1-t)*.8);break;
 case 'lightning':out.set(c*t+Math.sin(a*19+time*30)*.15,s*t+Math.cos(a*23+time*31)*.15,t*.4);break;
 case 'beam':out.set(c*(.4+t*.8),s*(.4+t*.8),t*2-1);break;
 case 'petal':out.set(c*(.5+t)*Math.sin(a*3),s*(.5+t)*Math.sin(a*3),Math.sin(a*3)*.4);break;
 case 'wave':out.set(c*(.3+t*1.5),Math.sin(t*12-time*5)*.15-.7,s*(.3+t*1.5));break;
 default:out.set(c*(.4+t),Math.sin(a*2+time*2)*.4,s*(.4+t));
 }
}
export function updateWeaponSignature(T,fx,time,progress){
 fx.age=time;const burst=fx.mode==='burst',p=Math.max(0,Math.min(1,progress)),fade=burst?Math.sin(p*Math.PI):.25+p*.7,scale=burst?.7+p*(1.3+fx.tier*.15):.35+p*(.65+fx.tier*.12),v=new T.Vector3();
 fx.root.scale.setScalar(scale);fx.points.material.uniforms.fade.value=fade;fx.lines.material.opacity=fade*.8;
 const f=fx.family;
 for(let i=0;i<fx.parts.length;i++){
  const m=fx.parts[i],a=i/fx.parts.length*Math.PI*2+time*(f==='pan'?-.8:1.2),t=(i%3+1)/3;
  path(f,a,t,time,m.position);
  if(fx.tier===2&&i%2)m.position.z*=-1;
  if(fx.tier===3)m.position.y+=Math.sin(a*3)*.25;
  if(fx.tier===4)m.position.applyAxisAngle(new T.Vector3(0,0,1),(i%2?1:-1)*.35);
  if(fx.tier===5){m.position.x*=1+Math.sin(a*2)*.22;m.position.z*=1+Math.cos(a*2)*.22;}
  m.rotation.set(a*.3,time*1.5+i,a+(f==='swatter'?Math.floor(i/4)*Math.PI/2:0));m.scale.setScalar(.5+(fx.tier*.1));
  if(f==='pan'||f==='wave'){m.rotation.set(Math.PI/2,0,time);m.scale.setScalar(.35+t*(1+fx.tier*.18));m.position.y=-.7+i*.04;}
  if(f==='swatter'){m.rotation.set(0,0,i%2?Math.PI/2:0);m.scale.set(1+fx.tier*.2,1,1);}
  if(f==='palm'){m.rotation.set(.8,a,Math.PI/2);m.scale.set(.8,1.3+t,1);}
  if(f==='planter'||f==='petal'){m.lookAt(0,1,0);m.rotateZ(a);}
  if(f==='water')m.scale.set(.8,1.7, .8);if(f==='fire'){m.scale.set(1,1.6+t,1);m.rotation.set(0,a,Math.sin(a)*.25);}
  if(f==='beam'){m.rotation.set(0,0,time*(i%2?-1:1));m.scale.setScalar(.6+t);}
  m.material.opacity=fade*.78;if(m.material.uniforms){m.material.uniforms.time.value=time;m.material.uniforms.fade.value=fade;}
 }
 for(let i=0;i<fx.ornaments.length;i++){const o=fx.ornaments[i],a=-time*(1+fx.tier*.15)+i*Math.PI*2/fx.ornaments.length;o.position.set(Math.cos(a)*1.4,Math.sin(a*2)*.4+.3,Math.sin(a)*1.4);o.rotation.set(time,a,time*.7);o.scale.setScalar(.6+fade*.5);}
 const attr=fx.points.geometry.attributes.position;
 for(let i=0;i<attr.count;i++){const t=((i/attr.count+time*.12)%1),a=i*2.39996+time;path(f,a,t,time,v);if(burst){v.multiplyScalar(1+p*.7);v.y+=p*p*(f==='pan'?2.8:f==='fire'?4:1.1);}attr.setXYZ(i,v.x,v.y,v.z);}attr.needsUpdate=true;
 const line=fx.lines.geometry.attributes.position;
 for(let i=0;i<96;i++)for(let j=0;j<2;j++){const t=(i+j)/96,a=t*Math.PI*(f==='whip'?14:f==='ice'?12:f==='planter'?10:6)+time;
  if(f==='swatter'){const k=Math.floor(i/8),u=(i%8+j)/8;v.set(k<6?(k-2.5)*.4:u*2-1,k<6?u*2-1:(k-8.5)*.4,0);}
  else{path(f,a,t,time,v);if(f==='lightning')v.multiplyScalar(1+Math.sin((i+j)*17)*.3);}
  line.setXYZ(i*2+j,v.x,v.y,v.z);
 }line.needsUpdate=true;
}
export function disposeWeaponSignature(fx){const geometry=new Set(),materials=new Set();fx.root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)materials.add(o.material);});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());fx.root.removeFromParent();}
