// Original sculpted spell art. All fine markings are shaded on the GPU; no texture downloads.
// +Z is forward. Models are authored once, batched, and reused by every cast.
export const artPalettes={
 fire:['#481126','#c43b27','#ff923e','#fff2c9','#ffc45e'],ice:['#183c63','#358fae','#9bdaea','#eafaff','#b4c5e5'],lightning:['#38215b','#d59821','#fff088','#fff9d2','#5b52bd'],water:['#133d50','#277e97','#78c2ca','#e1f6da','#cdbd85'],saber:['#252d53','#5f7dba','#b2e7e9','#fff0cc','#d9b873'],whip:['#30213f','#6e486d','#a58b86','#f6d4bc','#c99869'],planter:['#253e39','#4f795e','#9aaf75','#f1dfb2','#b79472'],swatter:['#060e13','#152b2b','#3b534b','#779f88','#56405d'],pan:['#3a3037','#9d6452','#dca86e','#fff1c2','#bea17a'],beam:['#242e40','#566d81','#a6c2c7','#fff0cc','#c8a77c'],palm:['#243e45','#527d73','#9fbd83','#eee0ab','#bb9569'],petal:['#542a55','#a05a81','#e4a6b1','#fff1df','#d3b174'],wave:['#192e45','#3c617e','#8bc6c5','#e7e4c2','#bf9f73']};
const vertex=`
 varying vec2 vUv;varying vec3 vN;varying vec3 vP;varying vec3 vLocal;varying float vSeed;
 uniform float uTime,uMotion,uSpan,uCreature;
 #ifdef USE_INSTANCING
 attribute vec4 aSeed;
 #endif
 void main(){vUv=uv;vec3 p=position;vec3 n=normal;vSeed=0.;
 #ifdef USE_INSTANCING
 p=(instanceMatrix*vec4(p,1.)).xyz;n=mat3(instanceMatrix)*n;vSeed=aSeed.x;
 float t=uTime, a=aSeed.x*6.28318;
 if(uMotion>0.5&&uMotion<1.5){float q=fract(aSeed.y+t*.42);p+=vec3(sin(a+t)*q*4.,sin(a*1.3+t)*q*2.+q*4.,q*uSpan);}
 if(uMotion>1.5&&uMotion<2.5){float q=fract(aSeed.y+t*.26);float r=3.2+sin(aSeed.z*7.)*1.4;p+=vec3(cos(a+t*2.)*r,2.+sin(a+t)*3.,q*uSpan);}
 if(uMotion>2.5&&uMotion<3.5){float k=.12+.8*smoothstep(1.4,2.6,t);p+=vec3(sin(a*7.+t*19.),cos(a*5.+t*13.),sin(a*3.+t*17.))*k;}
 if(uMotion>3.5&&uMotion<4.5){float q=fract(aSeed.y+t*.3);p+=vec3(cos(a+t)*5.,(1.-q)*13.,sin(a+t)*5.+q*uSpan*.6);}
 #endif
 if(uMotion<.5){
 if(uCreature==1.){float tail=1.-smoothstep(-13.,3.,p.z);p.x+=sin(p.z*.45-uTime*3.)*.65*tail;p.y+=cos(p.z*.3-uTime*2.)*.25*tail;}
 if(uCreature==3.){p.x+=sin(p.z*.7+uTime*3.)*.2*smoothstep(0.,5.,p.z);p.y+=cos(p.x*.5+uTime*2.)*.16*smoothstep(1.,4.,p.y);}
 if(uCreature==4.){p.y+=sin(p.x*.6+p.z*.4+uTime*2.)*.12*smoothstep(8.,11.,p.y);}
 if(uCreature==2.&&p.y<5.){float k=1.-smoothstep(0.,5.,p.y);p.x+=sin(p.y*1.8+uTime*3.+p.z)*.35*k;p.z+=cos(p.y+uTime*2.+p.x)*.25*k;}
 }
 vLocal=p;
 vP=(modelViewMatrix*vec4(p,1.)).xyz;vN=normalize(normalMatrix*n);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}
`;
const fragment=`
 precision highp float;varying vec2 vUv;varying vec3 vN;varying vec3 vP;varying vec3 vLocal;varying float vSeed;
 uniform vec3 uDark,uMid,uLight,uPaper;uniform float uPattern,uFade,uTime,uGlow;
 float line(float d,float w){float aa=max(.0001,fwidth(d));return (1.-smoothstep(w,w+aa,abs(d)))*min(1.,w/aa*1.8);}
 void main(){
 // Screen-door dissolve keeps translucent overdraw bounded, including overlapping summons.
 float grain=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);if(grain>uFade)discard;
 vec3 n=normalize(vN);vec3 dpdx=dFdx(vP),dpdy=dFdy(vP);vec2 duvdx=dFdx(vUv),duvdy=dFdy(vUv);vec3 tangent=normalize(dpdx*duvdy.y-dpdy*duvdx.y+vec3(.00001));vec3 bitangent=normalize(cross(n,tangent));float relief=uPattern<.5?sin(vUv.x*113.+sin(vUv.y*239.)*.5)*.07:uPattern<2.5?sin(vUv.y*100.+vUv.x*12.)*.025:sin(vUv.x*35.+vUv.y*21.)*.03;n=normalize(n+tangent*relief+bitangent*relief*.4);float lit=dot(n,normalize(vec3(-.42,.7,.55)))*.5+.5;
 float band=smoothstep(.3,.42,lit)*.48+smoothstep(.67,.79,lit)*.52;
 vec3 c=mix(uDark,uMid,smoothstep(.18,.38,lit));c=mix(c,uLight,band*.43);
 float ink=0.,glint=0.,micro=0.;vec2 uv=vUv;
 if(uPattern<.5){vec2 q=uv*vec2(18.,38.);q.x+=mod(floor(q.y),2.)*.5;vec2 f=fract(q)-.5;float arc=length(vec2(f.x,f.y*.85+.26));ink=line(arc-.48,.025);glint=line(arc-.43,.01)*step(0.,f.y);}
 else if(uPattern<1.5){float x=uv.x+.025*sin(uv.y*28.);ink=line(sin(x*90.+sin(uv.y*18.)*1.7),.09);glint=line(sin(x*90.+sin(uv.y*18.)*1.7+.2),.035);}
 else if(uPattern<2.5){ink=line(uv.x-.5,.009);float vane=fract(uv.y*32.+abs(uv.x-.5)*12.);ink=max(ink,line(vane-.5,.035)*.7);glint=line(abs(uv.x-.5)-.46,.015);}
 else if(uPattern<3.5){vec2 q=abs(fract(uv*vec2(5.,13.))-.5);ink=line(q.x+q.y-.45,.025);glint=line(abs(uv.x-.5)-.42,.018);}
 else if(uPattern<4.5){ink=max(line(uv.x-.5,.01),line(sin((uv.y+abs(uv.x-.5)*.65)*64.),.09)*.65);glint=line(abs(uv.x-.5)-.46,.012);}
 else if(uPattern>5.5){vec2 q=uv*vec2(20.,26.);q.x+=mod(floor(q.y),2.)*.5;vec2 cell=fract(q)-.5;float facet=max(abs(cell.x)*.866+abs(cell.y)*.5,abs(cell.y));ink=line(facet-.44,.045);glint=pow(max(0.,1.-length(cell-vec2(-.15,.16))*2.2),6.)*.65;}
 else{float curl=sin(uv.x*25.+sin(uv.y*20.)*3.);ink=line(curl,.12)*.65;glint=line(curl-.4,.04);}
 // Secondary veins, feather barbules, grain knots and pores use derivative-filtered lines.
 if(uPattern<.5){micro=line(sin(uv.x*310.+sin(uv.y*77.)*2.)*sin(uv.y*283.),.055);glint+=line(sin(uv.y*239.+uv.x*13.),.04)*.18;}
 else if(uPattern<1.5){vec2 knot=(uv-vec2(.37,.58))*vec2(5.,2.);float grainPhase=uv.x*170.+sin(uv.y*22.)*3.+atan(knot.y,knot.x)*.7;micro=line(sin(grainPhase),.06);ink=max(ink,line(sin(length(knot)*29.),.06)*exp(-dot(knot,knot)*2.));}
 else if(uPattern<2.5){float barb=uv.y*113.+abs(uv.x-.5)*44.;micro=line(sin(barb+sin(uv.x*61.)*.4),.055);glint+=micro*.25;}
 else if(uPattern>3.5&&uPattern<4.5){float branch=fract((uv.y+abs(uv.x-.5)*.65)*10.);micro=line(sin((uv.x+abs(branch-.5)*.17)*220.),.075)*smoothstep(.025,.1,abs(uv.x-.5));}
 else {micro=line(sin(uv.x*180.+sin(uv.y*43.)*3.),.06)*.4;}
 float brush=sin(uv.x*390.+sin(uv.y*140.)*2.)*sin(uv.y*430.)*.018;
 c=mix(c,uDark,ink*.18);c=mix(c,uPaper,glint*.22);c+=brush*.3;
 float sheen=pow(max(0.,dot(reflect(-normalize(vec3(-.42,.7,.55)),n),vec3(0,0,1))),24.);c+=uLight*sheen*.16;float rim=pow(1.-abs(n.z),3.);c=mix(c,uPaper,rim*.08);c+=uLight*uGlow*(.65+.2*sin(uTime*3.+vP.y));
 // A fragmented luminous skin: broad moving gaps expose the scenery, fine cells
 // retain anatomical markings; no opaque dark core underneath the energy.
 vec3 q=vLocal*2.8;float drift=sin(q.y*1.7-uTime*3.2+sin(q.z*1.3))*sin(q.x*.9+uTime*1.9);
 float cell=fract(sin(dot(floor(vLocal*58.+vec3(0.,uTime*1.4,0.)),vec3(12.9898,78.233,39.425)))*43758.5453);
 float density=.30+rim*.18+glint*.12+.15*drift;
 if(cell>density)discard;
 float filament=line(sin(vLocal.y*5.-uTime*4.+sin(vLocal.z*2.+vLocal.x)),.12);
 c=mix(c,uLight,.42)+uLight*(glint*.55+micro*.25+filament*.5)+uPaper*rim*.22;
 gl_FragColor=vec4(c,(.55+rim*.15+filament*.15)*uFade);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }
`;
export function makeArt(T,family){
 const root=new T.Group(),palette=artPalettes[family]||artPalettes.water,materials=[],parts=[];let seq=0;
 const material=(pattern=0,swap=false,glow=0)=>{const m=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{uDark:{value:new T.Color(swap?palette[1]:palette[0])},uMid:{value:new T.Color(swap?palette[4]:palette[1])},uLight:{value:new T.Color(swap?palette[3]:palette[2])},uPaper:{value:new T.Color(palette[3])},uPattern:{value:pattern},uFade:{value:1},uTime:{value:0},uGlow:{value:glow},uMotion:{value:0},uCreature:{value:family==='fire'?1:family==='swatter'?2:family==='whip'?3:family==='palm'?4:0},uSpan:{value:30}},side:T.DoubleSide,transparent:true,depthWrite:false,blending:T.NormalBlending});materials.push(m);return m;};
 const skin=material(0),metal=material(3,true),pale=material(2,true),wingMat=material(2),bark=material(1),leafMat=material(4),enamel=material(5),eye=material(3,true,.45);
 if(['ice','lightning'].includes(family))skin.uniforms.uPattern.value=2;
 if(family==='lightning'){wingMat.uniforms.uDark.value.set('#151329');wingMat.uniforms.uMid.value.set('#332943');wingMat.uniforms.uLight.value.set('#69547f');pale.uniforms.uMid.value.set('#e9b02d');pale.uniforms.uLight.value.set('#ffe892');}
 if(['planter','palm','whip'].includes(family)){bark.uniforms.uDark.value.set('#352c31');bark.uniforms.uMid.value.set('#805b49');bark.uniforms.uLight.value.set('#b69268');leafMat.uniforms.uDark.value.set('#193c34');leafMat.uniforms.uMid.value.set('#3b7752');leafMat.uniforms.uLight.value.set('#8eb774');}
 const tint=(color,glow=0)=>{const m=material(5,false,glow);m.uniforms.uMid.value.set(color);m.uniforms.uDark.value.set(color).multiplyScalar(.38);m.uniforms.uLight.value.set(color).lerp(new T.Color('#fff4dc'),.12);m.uniforms.uPaper.value.set(color).lerp(new T.Color('#ffffff'),.12);return m;};
 const ivory=tint('#f6ddb1'),black=tint('#121525'),iris=tint(family==='swatter'?'#68132f':family==='ice'?'#a23b96':'#f6bb31',.04),belly=tint(family==='fire'?'#f7bf75':family==='swatter'?'#647c75':'#c6e6ed');
 if(family==='swatter')iris.uniforms.uPattern.value=6;
 const mesh=(g,m=skin,parent=root)=>{const o=new T.Mesh(g,m);parent.add(o);return o;};
 const group=(parent=root,motion='',side=0)=>{const g=new T.Group();parent.add(g);if(motion)parts.push({o:g,motion,side,phase:seq++*.8});return g;};
 const curve=pts=>new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p)));
 function sweep(pts,rs,m=skin,parent=root,steps=32,sides=10,oval=1){
  const c=curve(pts),frames=c.computeFrenetFrames(steps,false),v=[],n=[],uv=[],idx=[];
  for(let i=0;i<=steps;i++){const t=i/steps,p=c.getPoint(t),a=t*(rs.length-1),k=Math.min(rs.length-2,Math.floor(a)),r=T.MathUtils.lerp(rs[k],rs[k+1],a-k);
   for(let j=0;j<=sides;j++){const angle=j/sides*Math.PI*2,nn=frames.normals[i].clone().multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[i],Math.sin(angle)*oval),q=p.clone().addScaledVector(nn,r);v.push(...q.toArray());nn.normalize();n.push(...nn.toArray());uv.push(j/sides,t);if(i<steps&&j<sides){const o=i*(sides+1)+j;idx.push(o,o+sides+1,o+1,o+1,o+sides+1,o+sides+2);}}
  }const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setAttribute('normal',new T.Float32BufferAttribute(n,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);return mesh(geo,m,parent);
 }
 // Curved, tapered, thin sculpted leaf/feather with a raised rachis, never a cone.
 function blade(length,width,bend=.25,serrated=false){const v=[],uv=[],idx=[],rows=serrated?12:6,cols=serrated?4:2;for(let i=0;i<=rows;i++){const t=i/rows,w=width*Math.pow(Math.sin(Math.PI*t),.62)*(1-.32*t)*(serrated?1-(family==='lightning'?.23:.055)*Math.sin(t*(family==='lightning'?32:100)):1);for(let j=0;j<=cols;j++){const x=j/cols*2-1;v.push(x*w,t*length,bend*Math.sin(t*Math.PI)+.13*(1-x*x)*Math.sin(t*Math.PI));uv.push(j/cols,t);if(i<rows&&j<cols){const k=i*(cols+1)+j;idx.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);}}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
 const feather=(parent,x,y,z,l,w,angle=0,m=wingMat,bend=.3)=>{const o=mesh(blade(l,w,bend,!['planter','palm'].includes(family)),m,parent);o.position.set(x,y,z);o.rotation.z=angle;return o;};
 const horn=(pts,r=.2,parent=root,m=metal)=>sweep(pts,[r,r*.85,r*.4,.008],m,parent,20,7);
 const jewel=(x,y,z,s=.2,parent=root,m=eye)=>{const o=mesh(new T.OctahedronGeometry(s,1),m,parent);o.position.set(x,y,z);o.scale.y=1.4;return o;};
 function torus(r,t=.04,m=metal,parent=root){return mesh(new T.TorusGeometry(r,t,5,64),m,parent);}
 function flesh(parent,xyz,scale,m=skin,tilt=0){const detailed=Math.max(...scale)>.9,g=new T.SphereGeometry(1,detailed?24:12,detailed?16:8),a=g.attributes.position;for(let i=0;i<a.count;i++){const y=a.getY(i),z=a.getZ(i);a.setX(i,a.getX(i)*(1+.07*Math.sin(y*4+z*2)));}g.computeVertexNormals();const o=mesh(g,m,parent);o.position.set(...xyz);o.scale.set(...scale);o.rotation.z=tilt;return o;}
 function livingEye(parent,x,y,z,side,size=.3){flesh(parent,[x,y,z],[size*.4,size*.72,size],ivory);flesh(parent,[x+side*size*.25,y,z+.04],[size*.22,size*.52,size*.55],iris);flesh(parent,[x+side*size*.4,y,z+.07],[size*.12,size*.42,size*.2],black);flesh(parent,[x+side*size*.45,y+size*.23,z+.11],[size*.08,size*.12,size*.13],ivory);horn([[x,y+size*.5,z-size],[x+side*.06,y+size*.9,z],[x,y+size*.32,z+size]],size*.18,parent,skin);}
 function birdWing(parent,side,ice){const w=group(parent,'wing',side);w.position.set(side*.75,3.1,0);w.rotation.x=-.1;
  sweep([[0,0,0],[side*2,.8,-.2],[side*4.4,1,-1],[side*6,.4,-2]],[.55,.65,.43,.025],skin,w,28,14,.65);
  for(let layer=0;layer<3;layer++)for(let j=0;j<(layer===0?12:9);j++){const x=side*(.4+j*.43),y=.3+Math.sin(j*.2)*.8,z=-layer*.2-j*.16;const f=feather(w,x,y,z,(layer===0?(ice?3.8:4.7):2.6)-j*.06,layer===0?.43:.36,side*(-.6-j*.048),ice?(layer===2?belly:wingMat):(layer===0?wingMat:pale),ice?.35:.6);f.rotation.x=-.95-layer*.09;}
  return w;
 }
 function dragonHead(parent,water=false){const h=group(parent,'head');
  sweep([[0,3.1,4],[0,3.4,5],[0,3.1,6.2],[0,2.85,7.1]],[.6,.8,.52,.28],skin,h,28,14,.65);
  sweep([[0,2.65,4.9],[0,2.3,5.8],[0,2.5,6.9]],[.5,.38,.12],bark,h,20,10,.38);
  for(const side of [-1,1]){horn([[side*.45,3.8,4.8],[side*.8,4.9,4.4],[side*1.5,5.8,3.5],[side*1.8,5.5,2.9]],.25,h);horn([[side*.3,3,6.5],[side*1.5,3.1,7],[side*2.2,2.7,5.7],[side*2.7,3.3,4]],.045,h,pale);
   for(let j=0;j<9;j++){const z=5.1+j*.19;horn([[side*.37,2.82,z],[side*.32,2.6,z+.06],[side*.28,2.5,z+.11]],.065,h,pale);}for(let j=0;j<6;j++)feather(h,side*.45,3.5-j*.08,4.5-j*.2,1.25,.23,side*(1.1+j*.06),water?wingMat:metal);
  }return h;
 }
 const body=group(root,'body');
 if(family==='fire'){
  // Long, continuous eastern-dragon anatomy, not a short winged lizard.
  const path=[[0,2,-17],[-2.8,2.4,-14],[-3.5,4,-10],[-1.5,4.7,-6],[2.2,3.5,-2],[1.5,3,1],[0,3.2,4]];
  sweep(path,[.025,.32,.7,1.05,1.15,.95,.7],skin,body,84,24,.9);
  sweep(path.map(p=>[p[0],p[1]-.55,p[2]+.06]),[.01,.1,.35,.58,.65,.5,.4],belly,body,64,14,.48);
  dragonHead(body);flesh(body,[0,3.35,5.1],[.78,.62,1.05]);flesh(body,[0,2.94,6.35],[.52,.28,.86],belly);
  for(const side of [-1,1]){livingEye(body,side*.69,3.66,5.5,side,.33);flesh(body,[side*.27,3.14,6.9],[.12,.09,.17],black);
   for(let j=0;j<8;j++){const z=4.7-j*.15;const f=feather(body,side*.62,3.45,z,2.2+j*.12,.3,side*(.7+j*.08),j%2?metal:pale,.7);f.rotation.x=-.8;}
   for(const z of [-5,1]){const x=z<0?-1.5:1.5;sweep([[x+side*.7,3.7,z],[x+side*1.7,2.5,z+.3],[x+side*2,1.3,z+1.5]],[.5,.36,.18],skin,body,24,12);flesh(body,[x+side*2,1.15,z+1.7],[.38,.2,.55],belly);for(let k=0;k<3;k++)horn([[x+side*2+(k-1)*.28,1.2,z+1.8],[x+side*2+(k-1)*.36,.9,z+2.3],[x+side*2+(k-1)*.3,1.1,z+2.5]],.12,body,ivory);}
  }
  const c=curve(path);for(let j=0;j<24;j++){const t=.12+j*.033,p=c.getPoint(t);const f=feather(body,p.x,p.y+.6,p.z,1.1+Math.sin(t*Math.PI)*1.1,.24,0,j%2?metal:pale,.5);f.rotation.x=-.6;}
  for(let j=0;j<7;j++){const f=feather(body,0,2,-16,4,.35,(j-3)*.15,metal,.8);f.rotation.x=-1.5;}
 }else if(family==='ice'||family==='lightning'){
  const ice=family==='ice';flesh(body,[0,2.6,-.1],ice?[1.05,1.45,1.8]:[1.45,1.6,1.7],skin);flesh(body,[0,2.6,1.12],[.86,1.2,.65],belly);
  sweep([[0,3.2,.8],[0,4,1.5],[0,4.9,1.8]],[.65,.5,.48],skin,body,24,16);
  flesh(body,[0,4.95,2.1],ice?[.68,.76,.85]:[.86,.8,.85]);flesh(body,[0,4.65,2.75],[.44,.3,.38],belly);
  sweep([[0,4.9,2.65],[0,4.7,3.25],[0,4.36,3.5]],[.35,.23,.005],metal,body,20,14,.65);
  for(const side of [-1,1]){livingEye(body,side*(ice?.57:.74),5.1,2.4,side,.35);for(let j=0;j<3;j++){const f=feather(body,side*.5,4.8,1.8,1.1,.25,side*(.9+j*.3),belly,.25);f.rotation.x=-.4;}}
  birdWing(body,-1,ice);birdWing(body,1,ice);
  for(let j=0;j<(ice?7:5);j++){const f=feather(body,(j-(ice?3:2))*.24,2.6,-1.2,(ice?7:3.8)+Math.cos(j)*.6,.4,(j-(ice?3:2))*.17,j%2?belly:wingMat,.65);f.rotation.x=-1.85;}
  for(let j=0;j<5;j++){const f=feather(body,(j-2)*.14,5.45,1.9,ice?1.8:2.7,.28,(j-2)*-.26,ice?wingMat:metal,.4);f.rotation.x=-.55;}
  for(const side of [-1,1]){sweep([[side*.6,1.7,0],[side*.85,.8,.8],[side*.9,.5,1.5]],[.22,.16,.08],metal,body,18,10);for(let j=0;j<3;j++)horn([[side*.9,.5,1.5],[side*.9+(j-1)*.36,.25,2.1],[side*.9+(j-1)*.4,.45,2.5]],.095,body,ivory);}
 }else if(family==='water'){
  sweep([[0,1,-7],[0,2,-3],[0,2.8,1],[0,3.2,4],[0,3.1,5.6]],[.03,.5,1.7,1.2,.65],skin,body,54,18,.68);
  for(const side of [-1,1]){const fin=group(body,'fin',side);fin.position.set(side*.8,2.5,1);for(let j=0;j<12;j++){const f=feather(fin,side*j*.27,0,-j*.19,4.8-j*.13,.3,side*(-1.05-j*.04),j%3?wingMat:pale);f.rotation.x=-.5;}horn([[side*.65,3.7,3.8],[side*1.5,5.3,2.3],[side*2.4,5.4,1],[side*2.9,5.1,.3]],.15,body);for(let j=0;j<5;j++)horn([[side*1.1,2.6,4.4],[side*2.2,2.4,4-j*.25],[side*2.8,3.2,3-j*.3]],.035,body,pale);}
  for(let j=0;j<13;j++){const f=feather(body,0,3.5,-3+j*.5,1.1+j*.06,.25,0,pale);f.rotation.y=Math.PI/2;}
  for(const side of [-1,1]){const f=feather(body,0,1,-6,4,.65,side*1.05,wingMat);f.rotation.x=-1;}
  flesh(body,[0,3,3.8],[1.4,.9,1.65],skin);flesh(body,[0,2.55,4.8],[1.05,.35,.8],belly);for(const side of [-1,1])livingEye(body,side*1.1,3.5,4.7,side,.32);
 }else if(family==='saber'){
  // The ultimate is pure luminous cutting energy; no summoned physical sword.
 }else if(family==='planter'||family==='palm'){
  const palm=family==='palm';sweep([[0,-.8,0],[.4,2,0],[-.5,5,.3],[.8,8,0],[.25,11,-.3]],[.65,.5,.38,.25,.08],bark,body,40,12);
  for(let j=0;j<9;j++){const a=j*Math.PI*2/9;horn([[0,-.6,0],[Math.cos(a)*2,-.6,Math.sin(a)*2],[Math.cos(a)*4,-.9,Math.sin(a)*4]],.22,body,bark);}
  if(palm){for(let j=0;j<13;j++){const a=j*Math.PI*2/13,fr=group(body);fr.position.set(.25,10.5,-.3);fr.rotation.y=a;horn([[0,0,0],[2.5,1,0],[5,.4,0],[6,-1.3,0]],.07,fr,metal);for(let k=0;k<19;k++)for(const side of [-1,1]){const f=feather(fr,k*.28,.7*Math.sin(k/19*Math.PI),0,1.1+k*.045,.13,side*1.2,leafMat,.3);f.rotation.x=side*.65;}const o=mesh(new T.SphereGeometry(.42,10,8),bark,body);o.position.set(Math.cos(a)*.7,9.7,Math.sin(a)*.7);}
  }else{
   for(let j=0;j<22;j++){const a=j*2.399,level=3.5+j*.26,span=2.5+Math.sin(j)*1.2,tip=[Math.cos(a)*span,level+1.6,Math.sin(a)*span];sweep([[0,level,0],[tip[0]*.55,level+1.3,tip[2]*.55],tip],[.17,.09,.005],bark,body,12,6);
    for(let k=0;k<19;k++){const v=k*2.399,rr=.25+(k%5)*.18;const f=feather(body,tip[0]+Math.cos(v)*rr,tip[1]+Math.sin(v)*.6,tip[2]+Math.sin(v)*rr,.65+(k%3)*.12,.22,v,leafMat);f.rotation.x=v*.6;}
    if(j%2===0){const a0=tip;for(let k=0;k<6;k++){const f=feather(body,a0[0],a0[1],a0[2],.45,.18,k*Math.PI/3,pale);f.rotation.x=.5;}jewel(a0[0],a0[1]-.3,a0[2],.12,body);}
   }
   // Fluted planter and inset decorative band anchor the botanical summon.
   mesh(new T.LatheGeometry([new T.Vector2(.65,-1),new T.Vector2(.8,-.8),new T.Vector2(1.2,.2),new T.Vector2(1.3,.25),new T.Vector2(1.25,.4)],20),enamel,body);const lip=torus(1.25,.09,metal,body);lip.rotation.x=Math.PI/2;lip.position.y=.3;
  }
  if(palm){flesh(body,[0,1.1,0],[2.4,1.3,2.9],skin);flesh(body,[0,1.2,2.9],[.8,.65,.95],belly);for(const side of [-1,1]){livingEye(body,side*.65,1.55,3.1,side,.23);for(const z of [-1.7,1.6])flesh(body,[side*1.9,.3,z],[.6,.5,.85],bark);}}else{for(const side of [-1,1])livingEye(body,side*.35,4.9,.43,side,.25);sweep([[-.4,4.3,.45],[0,4.15,.65],[.4,4.3,.45]],[.04,.07,.04],black,body,16,7);}
 }else if(family==='swatter'){
  flesh(body,[0,4.8,0],[1.4,2.3,1.05],skin);flesh(body,[0,7.4,.1],[1.5,1.55,1.15],enamel);
  for(const side of [-1,1]){flesh(body,[side*1.05,7.9,.83],[.66,.91,.5],iris,side*.23);
   flesh(body,[side*1.02,8.24,1.26],[.09,.14,.04],iris);
   horn([[side*.5,8.5,0],[side*1.2,9.6,-.2],[side*2.1,10.1,-1],[side*2.4,9.3,-1.3]],.2,body,skin);
   for(let j=0;j<3;j++){const y=6.6-j*.9;sweep([[side*.8,y,0],[side*(2.1+j*.3),y+.4,-.3],[side*(3.1+j*.4),y-1,.4]],[.32,.2,.08],skin,body,22,12);for(let k=0;k<3;k++)horn([[side*(3.1+j*.4),y-1,.4],[side*(3.4+j*.4)+(k-1)*.2,y-1.5,.9],[side*(3.1+j*.4)+(k-1)*.3,y-1.8,1.1]],.085,body,ivory);}
   const w=group(body,'dragon-wing',side);w.position.set(side*.8,6,-.7);for(let j=0;j<3;j++){const f=feather(w,side*j*.2,0,0,6-j*.7,1.1,side*(-1-j*.22),wingMat,1);f.rotation.x=-.4;}
  }
  flesh(body,[0,6.5,1],[.72,.85,.38],black);
  for(let j=0;j<18;j++){const a=j*Math.PI/9,l=j%3===0?.2:.4;horn([[Math.cos(a)*.7,6.5+Math.sin(a)*.8,1.22],[Math.cos(a)*.46,6.5+Math.sin(a)*.5,1.55],[Math.cos(a)*l,6.5+Math.sin(a)*l,1.4]],.075,body,ivory);}
  for(let j=0;j<10;j++){const a=j*Math.PI/5,x=Math.cos(a),z=Math.sin(a),pts=[[x*.8,4.8,z*.7],[x*1.3,3,z*1.3],[x*2.6,.8,z*2.2],[x*3.2,.3,z*2.7],[x*3.8,1.4,z*2.3]];sweep(pts,[.3,.27,.19,.1,.003],skin,body,32,12);for(let k=0;k<7;k++){const p=curve(pts).getPoint(.2+k*.095);flesh(body,[p.x,p.y,p.z+.15],[.1,.11,.07],belly);}}
  for(let j=0;j<9;j++){const a=(j-4)*.42;sweep([[Math.sin(a)*.65,6.3,1.4],[Math.sin(a)*1.4,5.4,2],[Math.sin(a)*2.2,4.9+Math.abs(a)*.4,2.3],[Math.sin(a+.4)*2.4,5.7,2.7],[Math.sin(a+.7)*2,5.9,2.8]],[.19,.15,.1,.07,.003],skin,body,28,12);}
 }else if(family==='whip'){
  for(let j=0;j<7;j++){const a=(j-3)*.38,h=group(body),x=Math.sin(a)*5,y=3+Math.cos(a)*2,z=4+Math.cos(a)*3;
   sweep([[0,0,-3],[Math.sin(a+1)*2,1,-1],[x*.7,y*.7,z*.5],[x,y,z]],[.14,.27,.34,.2],bark,h,35,9);
   for(let k=0;k<13;k++){const t=k/13;feather(h,x*t,1+(y-1)*t,-1+(z+1)*t,1,.22,(k%2?1:-1)*1.2,leafMat);}
   flesh(h,[x,y,z],[.58,.62,.85],skin);for(const side of [-1,1])livingEye(h,x+side*.47,y+.22,z+.4,side,.19);flesh(h,[x,y-.12,z+.6],[.4,.18,.45],belly);
   for(let k=0;k<6;k++){const p=feather(h,x,y,z,1.2,.28,k*Math.PI/3,wingMat);p.rotation.x=.8;}jewel(x,y+.3,z+.2,.22,h);for(let side of [-1,1])horn([[x+side*.25,y+.2,z],[x+side*.4,y+.6,z+.2],[x+side*.3,y+.8,z+.5]],.08,h,metal);
  }
 }else if(family==='pan'){
  const pan=group(body,'pan');pan.rotation.x=.45;const profile=[[0,0],[1.8,0],[2.3,.12],[2.55,.4],[2.65,.55],[2.55,.61],[2.4,.35],[2.1,.18],[0,.18]].map(p=>new T.Vector2(...p));mesh(new T.LatheGeometry(profile,40),skin,pan);horn([[2.5,.4,0],[3.5,.5,0],[5.3,.7,0],[5.6,.6,0]],.22,pan,metal);const r=torus(2.57,.05,metal,pan);r.rotation.x=Math.PI/2;r.position.y=.57;
  flesh(body,[0,2,0],[1.2,1,1],belly);for(const side of [-1,1]){livingEye(body,side*.85,2.4,.65,side,.26);horn([[side*.8,2.7,0],[side*1.3,3.5,0],[side*1.5,3.1,.2]],.24,body,skin);}
  for(let j=0;j<8;j++){const a=j*Math.PI/4;jewel(Math.cos(a)*2.5,.6,Math.sin(a)*2.5,.1,pan);}
 }else if(family==='beam'){
  flesh(body,[0,3,-.4],[1.4,2,1],enamel);flesh(body,[0,4.8,.15],[.8,.8,.7],skin);for(const side of [-1,1]){livingEye(body,side*.62,5,.5,side,.25);horn([[side*.4,5.3,0],[side*.8,6.5,0],[side*1.3,6.8,.3]],.13,body,metal);}
  for(let j=0;j<12;j++){const a=j*Math.PI/6,gun=group(body);gun.name='Cannon '+j;gun.position.set(Math.cos(a)*3.4,3+Math.sin(a)*3.4,0);sweep([[0,0,-1],[0,0,0],[0,0,1],[0,0,1.8]],[.35,.42,.3,.18],enamel,gun,12,8);const lens=torus(.28,.05,metal,gun);lens.position.z=1.35;jewel(0,0,1.6,.19,gun);for(let k=0;k<4;k++){const f=feather(gun,0,0,-.5,1.8,.15,k*Math.PI/2,metal);f.rotation.x=.8;}}
  for(const r of [2.7,3.4,4.1]){const o=torus(r,.045,metal,body);o.position.y=3;}jewel(0,3,0,.65,body);for(let j=0;j<24;j++){const a=j*Math.PI/12;jewel(Math.cos(a)*4.1,3+Math.sin(a)*4.1,0,.1,body);}
 }else if(family==='petal'){
  flesh(body,[0,1.8,.9],[.8,1.25,.7],skin);flesh(body,[0,3.3,1.1],[.75,.72,.7],belly);for(const side of [-1,1]){livingEye(body,side*.55,3.4,1.45,side,.22);horn([[side*.4,3.7,1],[side*.7,4.7,.9],[side*.85,4.95,1]],.24,body,wingMat);sweep([[side*.6,2.3,1],[side*1.2,1.4,1.3],[side*1.3,.7,1.5]],[.2,.17,.08],skin,body,18,10);}
  const flower=group(body,'flower');flower.position.y=3;
  for(let layer=0;layer<4;layer++)for(let j=0;j<9;j++){const a=j*Math.PI*2/9+layer*.19,p=feather(flower,Math.cos(a)*.3,Math.sin(a)*.3,layer*.22,4.8-layer*.7,.7-layer*.09,-a,layer%2?wingMat:pale,.9);p.rotation.x=.3+layer*.12;}
  jewel(0,3,.8,.8,body);for(let j=0;j<18;j++){const a=j*Math.PI/9;horn([[0,3,.4],[Math.cos(a)*1.2,3+Math.sin(a)*1.2,.8],[Math.cos(a)*1.4,3+Math.sin(a)*1.4,1]],.025,body,metal);jewel(Math.cos(a)*1.4,3+Math.sin(a)*1.4,1,.08,body);}
  for(let j=0;j<7;j++)sweep([[(j-3)*.4,2,0],[(j-3)*.7,0,.3],[(j-3)*.5,-1,1]], [.06,.04,.005],metal,body,20,5);
 }else{
  flesh(body,[0,3,0],[1.7,1.45,1.7],skin);flesh(body,[0,2.6,1.3],[1,.6,.55],enamel);for(const side of [-1,1])livingEye(body,side*.7,3,1.48,side,.34);for(let j=0;j<9;j++){const a=j*6.283/9;sweep([[Math.cos(a)*1.2,2.5,Math.sin(a)*1.2],[Math.cos(a)*1.5,.5,Math.sin(a)*1.5],[Math.cos(a+.5)*2,-1,Math.sin(a+.5)*2],[Math.cos(a+1)*2.2,-1.8,Math.sin(a+1)*2.2]],[.16,.14,.08,.005],wingMat,body,26,10);}
  for(let j=0;j<5;j++){const g=group(body,'orrery',j),r=2.2+j*.5;g.position.y=3;g.rotation.set(j*.45,j*.72,j*.25);torus(r,.065,metal,g);for(let k=0;k<18;k++){const a=k*Math.PI/9;const tick=mesh(new T.BoxGeometry(.025,k%3?.14:.32,.06),pale,g);tick.position.set(Math.cos(a)*r,Math.sin(a)*r,0);tick.rotation.z=a-Math.PI/2;}jewel(r,0,0,.14,g);}
 }
 batch(T,root,new Set(parts.map(p=>p.o)));
 addEnergyDust(T,root,materials);
 return {root,materials,parts,body,palette};
}
function batch(T,root,moving){
 const visit=parent=>{for(const c of [...parent.children])if(c.isGroup){visit(c);if(!moving.has(c)){c.updateMatrix();for(const child of [...c.children]){child.applyMatrix4(c.matrix);parent.add(child);}c.removeFromParent();}}const by=new Map();for(const c of parent.children){if(!c.isMesh||c.isInstancedMesh)continue;const list=by.get(c.material)||[];list.push(c);by.set(c.material,list);}for(const [mat,list]of by){if(list.length<2)continue;const gs=list.map(o=>{o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);return g;}),count=gs.reduce((n,g)=>n+g.attributes.position.count,0),geo=new T.BufferGeometry();for(const [key,size]of [['position',3],['normal',3],['uv',2]]){const a=new Float32Array(count*size);let at=0;for(const g of gs){if(g.attributes[key])a.set(g.attributes[key].array,at);at+=g.attributes.position.count*size;}geo.setAttribute(key,new T.BufferAttribute(a,size));}for(const o of list){o.removeFromParent();o.geometry.dispose();}for(const g of gs)g.dispose();parent.add(new T.Mesh(geo,mat));}};visit(root);
}

// Sample cached anatomy once. Each articulated group gets one point batch, and
// every cast shares these buffers. No particle positions are uploaded per frame.
function addEnergyDust(T,root,materials){
 const groups=new Map();let total=0,seed=7123;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,n=(g.index?.count||g.attributes.position.count)/3;total+=n;const list=groups.get(o.parent)||[];list.push({o,n});groups.set(o.parent,list);});
 const deform=vertex.slice(vertex.indexOf(' if(uMotion<.5){'),vertex.indexOf(' vLocal=p;'));
 for(const [parent,meshes] of groups){const positions=[],normals=[],colors=[],seeds=[];let creature=0;
  for(const {o,n} of meshes){o.updateMatrix();const g=o.geometry,p=g.attributes.position,no=g.attributes.normal,ix=g.index;creature=o.material.uniforms.uCreature.value;const color=o.material.uniforms.uLight.value,normalMatrix=new T.Matrix3().getNormalMatrix(o.matrix),count=Math.floor(6500*n/Math.max(1,total));
   for(let i=0;i<count;i++){const k=Math.floor(rand()*n)*3,ids=[0,1,2].map(j=>ix?ix.getX(k+j):k+j),a=Math.sqrt(rand()),b=rand(),weights=[1-a,a*(1-b),a*b],point=new T.Vector3(),normal=new T.Vector3();for(let j=0;j<3;j++){point.addScaledVector(new T.Vector3().fromBufferAttribute(p,ids[j]),weights[j]);normal.addScaledVector(new T.Vector3().fromBufferAttribute(no,ids[j]),weights[j]);}point.applyMatrix4(o.matrix);normal.applyMatrix3(normalMatrix).normalize();positions.push(...point.toArray());normals.push(...normal.toArray());colors.push(...color.toArray());seeds.push(rand());}
  }
  if(!seeds.length)continue;const geo=new T.BufferGeometry();for(const [key,data,width] of [['position',positions,3],['normal',normals,3],['color',colors,3],['aLife',seeds,1]])geo.setAttribute(key,new T.Float32BufferAttribute(data,width));
  const mat=new T.ShaderMaterial({uniforms:{uTime:{value:0},uFade:{value:1},uMotion:{value:0},uCreature:{value:creature}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexShader:`
   attribute float aLife;attribute vec3 color;varying vec3 vColor;varying float vAlpha;uniform float uTime,uFade,uMotion,uCreature;
   void main(){vec3 p=position;${deform}
   float t=uTime,a=aLife*6.28318,life=fract(aLife+t*.35),escape=pow(life,4.);
   p+=normal*(.035+escape*.8)+vec3(sin(t*11.+a+p.y*3.),cos(t*9.+a+p.z*2.),sin(t*13.+a+p.x*2.))*(.025+escape*.12);p.y+=escape*.7;
   vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(120.*(.25+aLife*.25)/max(1.,-mv.z),1.,3.5);vColor=color;vAlpha=(1.-life*.75)*uFade;
   }`,fragmentShader:`varying vec3 vColor;varying float vAlpha;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;gl_FragColor=vec4(vColor*.8,(1.-smoothstep(.1,.5,r))*vAlpha*.5);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   }`});materials.push(mat);const points=new T.Points(geo,mat);points.name='Anatomical energy motes';points.frustumCulled=false;parent.add(points);
 }
}
