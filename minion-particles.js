// One bounded draw call per creature. Anatomy and drift are animated on the GPU.
export function createMinionParticles(T,kind='spirit'){
 const count=2400,positions=new Float32Array(count*3),seeds=new Float32Array(count*3),parts=new Float32Array(count),rand=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n);};
 for(let i=0;i<count;i++){const a=rand(i+1),b=rand(i+6001),c=rand(i+12001);let x,y,z,part=0;
 if(i<1050){const phi=a*Math.PI*2,cy=b*2-1,r=Math.sqrt(1-cy*cy),shell=.65+c*.35;x=Math.cos(phi)*r*.62*shell;y=.9+cy*.42*shell;z=Math.sin(phi)*r*.78*shell;}
 else if(i<1830){const k=(i-1050)%6,side=k<3?-1:1,leg=k%3,t=a;x=side*(.36+Math.sin(t*Math.PI*.65)*.72);y=.75*(1-t)+Math.sin(t*Math.PI)*.19;z=(leg-1)*.43+Math.sin(t*Math.PI)*((leg-1)*.23);x+=(b-.5)*.09;y+=(c-.5)*.07;part=1;}
 else if(i<1960){const side=i%2?1:-1,phi=a*Math.PI*2,r=Math.sqrt(b)*.12;x=side*.25+Math.cos(phi)*r;y=1.04+Math.sin(phi)*r;z=.66+c*.04;part=2;}
 else{const phi=a*Math.PI*2,t=b;x=Math.cos(phi)*(.65+t*.55);y=.35+t*1.7;z=Math.sin(phi)*(.72+t*.5);part=3;}
 if(kind==='rat'){
 const phi=a*Math.PI*2,cy=b*2-1,rr=Math.sqrt(1-cy*cy);
 if(i<1000){x=Math.cos(phi)*rr*.28;y=.32+cy*.23;z=Math.sin(phi)*rr*.52;part=0;}
 else if(i<1400){x=Math.cos(phi)*rr*.19;y=.36+cy*.17;z=.43+Math.sin(phi)*rr*.27;part=0;}
 else if(i<1630){const side=i%2?1:-1;x=side*.17+Math.cos(phi)*Math.sqrt(b)*.105;y=.53+Math.sin(phi)*Math.sqrt(b)*.11;z=.44+c*.035;part=1;}
 else if(i<1870){const t=a;x=Math.sin(t*5.)*.25*t;y=.14+.07*Math.sin(t*4.);z=-.45-t*.9;x+=(b-.5)*.024;y+=(c-.5)*.025;part=1;}
 else if(i<2070){const side=i%2?1:-1;x=side*.22;y=b*.19;z=i%4<2?.3:-.3;part=1;}
 else if(i<2160){x=(i%2?1:-1)*.13+(a-.5)*.035;y=.41+(b-.5)*.035;z=.6;part=2;}
 else{const side=i%2?1:-1;x=side*(.07+a*.37);y=.32+Math.sin(i)*a*.05;z=.67-a*.16;part=1;}
 }
 positions.set([x,y,z],i*3);seeds.set([a,b,c],i*3);parts[i]=part;
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('seed',new T.BufferAttribute(seeds,3));geometry.setAttribute('part',new T.BufferAttribute(parts,1));
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{clock:{value:0},hit:{value:0},viewport:{value:800}},vertexShader:`
 attribute vec3 seed;attribute float part;uniform float clock,viewport;varying float alpha,kind;varying vec3 tint;
 void main(){vec3 p=position;float phase=clock*1.9+seed.x*6.283;kind=part;float life=fract(seed.y+clock*.19);
 p+=vec3(sin(phase*1.7+p.y*6.),cos(phase+p.z*5.),sin(phase*1.3+p.x*5.))*(part>2.5?.12:.025);
 if(part>.5&&part<1.5){p.y+=sin(clock*8.+sign(p.x)*2.+p.z*5.)*.09;}
 if(part>2.5){float a=clock*.6+life*1.4;mat2 r=mat2(cos(a),-sin(a),sin(a),cos(a));p.xz=r*p.xz;p.y+=life*.5;}
 else if(part<.5){p.xz*=1.+sin(clock*2.3)*.045;}
 alpha=part>2.5?sin(life*3.14159)*.21:part>1.5?.68:.16+sin(phase*2.)*.07;
 tint=mix(vec3(.34,.62,.9),vec3(.83,.36,.73),seed.z);if(part>1.5&&part<2.5)tint=vec3(1.,.64,.28);
 vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;float size=part>2.5?.065:.03+seed.z*.025;gl_PointSize=clamp(size*viewport*projectionMatrix[1][1]/max(.1,-v.z),1.,18.);}
 `,fragmentShader:`uniform float hit;varying float alpha,kind;varying vec3 tint;void main(){vec2 p=gl_PointCoord*2.-1.;float r=dot(p,p);if(r>1.)discard;float glow=exp(-r*4.)*(1.-smoothstep(.65,1.,r));gl_FragColor=vec4(mix(tint,vec3(1.,.28,.38),hit),alpha*glow);}`});
 const cloud=new T.Points(geometry,material);cloud.name=kind==='rat'?'rat-swarm-particles':'minion-energy-particles';cloud.frustumCulled=false;cloud.userData.particleCount=count;return cloud;
}
