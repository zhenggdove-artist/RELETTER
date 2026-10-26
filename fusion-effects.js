import {equipmentById} from './equipment-catalog.js';
const families=['water','ice','fire','lightning','beam','petal','wave','saber','whip','swatter','pan','planter','palm','token'];
// Distinct source silhouettes, not tinted copies of the main attack. Two GPU draws maximum.
export function createFusionEcho(T,shot){
 const items=(shot.fusionEffects||[]).slice(0,2).map(equipmentById).filter(x=>x?.slot==='weapon');if(!items.length)return null;
 const root=new T.Group();root.name='First two fusion echoes';root.position.fromArray(shot.origin);root.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...shot.direction).normalize());
 const layers=items.map((item,index)=>{const n=2200,geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3),3));geo.setAttribute('seed',new T.Float32BufferAttribute(Array.from({length:n*3},(_,i)=>Math.abs(Math.sin((i+1)*127.13)*43758.5)%1),3));
 const material=new T.ShaderMaterial({uniforms:{time:{value:0},progress:{value:0},power:{value:shot.ultimate?3.4:1.35},kind:{value:Math.max(0,families.indexOf(item.family))},tint:{value:new T.Color(item.color||'#cc91ff')}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
 vertexShader:`attribute vec3 seed;uniform float time,progress,power,kind;varying float life,heat,shape;void main(){float a=seed.x*6.283185,t=fract(seed.y+time*.65),q=seed.z;vec3 p;shape=0.;heat=t;
 if(kind<.5){p=vec3(cos(a)*(1.+t),sin(a)*(1.+t),sin(a*3.+time*6.)*.4);life=1.-t*.7;}
 else if(kind<1.5){float ray=floor(seed.x*6.)*1.0472+time*.35;p=vec3(cos(ray)*(t*2.5),sin(ray)*(t*2.5), (q-.5)*.8);p.xy+=vec2(cos(ray+1.0472),sin(ray+1.0472))*max(0.,sin(t*18.))*.45;life=.85;shape=1.;}
 else if(kind<2.5){p=vec3(sin(a)*(1.-t)*.8+sin(t*8.-time*4.)*.35,t*3.-1.,cos(a)*(1.-t)*.7);life=pow(1.-t,.7);}
 else if(kind<3.5){float branch=floor(seed.x*5.)*1.2566,zig=sin(floor(t*18.)*41.+floor(time*12.))*.27;p=vec3(cos(branch)*t*2.8+zig,sin(branch)*t*2.8+zig,(q-.5)*.3);life=.8;shape=2.;}
 else if(kind<4.5){float beam=floor(seed.x*6.)*1.0472;p=vec3(cos(beam)*.75+(q-.5)*.08,sin(beam)*.75+(q-.5)*.08,(t-.5)*5.);life=.9;shape=2.;}
 else if(kind<5.5){float r=sin(a*3.)*(.7+t);p=vec3(cos(a)*r,sin(a)*r,sin(a*3.+time)*.6);life=.8;shape=1.;}
 else if(kind<6.5){float r=.4+t*2.6;p=vec3(cos(a)*r,sin(a)*r,sin(t*20.-time*6.)*.25);life=1.-t*.65;}
 else if(kind<7.5){float angle=(t-.5)*2.6,r=1.6+q*.7;p=vec3(sin(angle)*r,cos(angle)*r-1.,(seed.x-.5)*.18);life=sin(t*3.14159);shape=2.;}
 else if(kind<8.5){float angle=t*16.-time*5.;p=vec3(sin(angle)*(.4+q*.2),t*4.-2.,cos(angle)*(.4+q*.2));life=.8;}
 else if(kind<9.5){float r=.4+q*1.5;p=vec3(cos(a+time*4.)*r,sin(a)*r*.7,sin(a*3.+time*7.)*.7);life=.8;shape=3.;}
 else if(kind<10.5){float r=.4+t*1.7;p=vec3(cos(a)*r,sin(t*3.14159)*1.5-.7,sin(a)*r);life=.85;shape=1.;}
 else if(kind<12.5){float branch=floor(seed.x*7.)*.8976,r=sin(t*3.14159)*(kind>11.5?2.:1.4);p=vec3(cos(branch)*r,t*3.-1.,sin(branch)*r);life=.8;shape=1.;}
 else{float r=1.7+.2*sin(a*12.);p=vec3(cos(a)*r,sin(a)*r,(q-.5)*.3);life=.9;}
 life*=smoothstep(0.,.1,progress)*(1.-smoothstep(.65,1.,progress));vec4 v=modelViewMatrix*vec4(p*power,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp((kind>1.5&&kind<2.5?140.:70.)*power/max(1.,-v.z),1.5,20.);}`,
 fragmentShader:`uniform vec3 tint;uniform float kind;varying float life,heat,shape;void main(){vec2 uv=gl_PointCoord*2.-1.;float r=shape>.5&&shape<1.5?abs(uv.x)+abs(uv.y):length(uv);if(r>1.)discard;vec3 c=mix(tint,vec3(1.,.94,.8),pow(1.-r,4.)*.7);if(kind>1.5&&kind<2.5)c=mix(vec3(1.,.12,.015),vec3(1.,.8,.22),1.-heat);float alpha=pow(1.-r,1.6)*life*(kind>1.5&&kind<2.5?.23:.65);gl_FragColor=vec4(c,alpha);}`});
 const points=new T.Points(geo,material),anchor=new T.Group();points.frustumCulled=false;points.name=item.family+' fusion trail';anchor.add(points);root.add(anchor);return {points,anchor,index};});return {root,layers,shot,age:0,duration:shot.ultimate?1.8:.8};
}
export function updateFusionEcho(T,e,dt){e.age+=dt;const p=Math.min(1,e.age/e.duration),melee=['saber','whip','swatter','pan','planter','palm'].includes(e.shot.family);for(const {points,anchor,index} of e.layers){points.material.uniforms.time.value=e.age+index*.3;points.material.uniforms.progress.value=p;const scale=e.shot.ultimate?2:1;if(melee){const a=(p-.5)*Math.PI*1.3;anchor.position.set(Math.sin(a)*Math.min(e.shot.range,9),index*.6,Math.cos(a)*Math.min(e.shot.range,9));anchor.rotation.z=a+index*.7;}else anchor.position.set((index?1:-1)*scale*.8,0,Math.min(e.shot.range||10,120)*p);}return p>=1;}
export function disposeFusionEcho(e){for(const {points} of e.layers){points.geometry.dispose();points.material.dispose();}e.root.removeFromParent();}
