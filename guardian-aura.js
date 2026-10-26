const geometries=new WeakMap();
// Two bounded GPU layers: etched particle sigils and rising silk-like energy ribbons.
export function attachGuardianAura(T,root,clock){
 let geo=geometries.get(T);if(!geo){geo=new T.BufferGeometry();const ids=Float32Array.from({length:3600},(_,i)=>i);geo.setAttribute('position',new T.BufferAttribute(new Float32Array(ids.length*3),3));geo.setAttribute('id',new T.BufferAttribute(ids,1));geo.userData.sharedGuardian=true;geometries.set(T,geo);}
 for(let layer=0;layer<2;layer++){
 const material=new T.ShaderMaterial({uniforms:{time:clock.time,fade:clock.fade,flash:clock.flash,layer:{value:layer}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
 vertexShader:`attribute float id;uniform float time,layer;varying float life,tone;float hash(float n){return fract(sin(n*127.1)*43758.5453);}void main(){float h=hash(id),u=id/3600.,a=u*6.283185;vec3 p;
 if(layer<.5){float band=mod(id,5.);a=floor(id/5.)/720.*6.283185+time*(mod(band,2.)<1.? .18:-.22);float r=band<2.?2.65+band*.22:band<4.?2.25+.2*sin(a*12.):1.75+.3*abs(sin(a*6.));p=vec3(cos(a)*r,.08+band*.025,sin(a)*r);if(id>2400.){a=(id-2400.)/1200.*6.283185-time*.25;r=3.35+.16*sin(a*24.);p=vec3(cos(a)*r,4.+sin(a)*r,-.75);}life=.65+.3*sin(a*24.+time*2.);tone=band/5.;}
 else{float strand=floor(id/600.),t=fract(mod(id,600.)/600.+time*.65),angle=strand*1.0472+t*7.-time*1.2,r=2.5+sin(t*5.+strand)*.5;float width=(h-.5)*.5*sin(t*3.14159);p=vec3(cos(angle)*(r+width),t*9.,sin(angle)*(r+width));life=pow(sin(t*3.14159),.7)*(.35+.65*h);tone=t;}
 vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp((layer<.5?85.:110.)/max(.5,-v.z),1.2,9.);}`,
 fragmentShader:`uniform float fade,flash,layer;varying float life,tone;void main(){float r=length(gl_PointCoord*2.-1.);if(r>1.)discard;vec3 c=layer<.5?mix(vec3(.78,.39,.12),vec3(1.,.87,.53),tone):mix(vec3(.35,.10,.85),vec3(.90,.47,1.),tone);c=mix(c,vec3(1.,.85,.55),flash);gl_FragColor=vec4(c,pow(1.-r,1.6)*life*fade*.7);}`});
 const points=new T.Points(geo,material);points.name=layer?'Guardian flowing silk':'Guardian etched sigils';points.frustumCulled=false;root.add(points);
 }
}
