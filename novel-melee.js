// Four hand-held garden weapons; every origin is the grip, never a world-space floating prop.
function makeNovelWeapon(item){
 const g=new THREE.Group(),tier=item.tier||1,scale=1+(tier-1)*.17;
 g.name='Hand-held '+item.family;g.userData.family=item.family;
 const steel=new THREE.MeshStandardMaterial({color:'#aab9bf',metalness:.85,roughness:.27});
 const enamel=new THREE.MeshStandardMaterial({color:item.color,metalness:.35,roughness:.28});
 const gold=new THREE.MeshStandardMaterial({color:'#e3bc78',metalness:.75,roughness:.3});
 const wood=new THREE.MeshStandardMaterial({color:'#76513f',roughness:.8});
 const leafMat=new THREE.MeshStandardMaterial({color:'#4d9b64',roughness:.6,side:THREE.DoubleSide});
 function mesh(geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);g.add(m);return m;}
 function bar(x,y,z,w,h,d,mat){return mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
 const shaft=(height,radius=.045,mat=wood)=>mesh(new THREE.CylinderGeometry(radius,radius,height,12),mat,0,height/2-.1,0);
 const leaf=(x,y,z,a,length,width)=>{
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(width,length*.4,0,length);shape.quadraticCurveTo(-width,length*.4,0,0);
  const m=mesh(new THREE.ShapeGeometry(shape,12),leafMat,x,y,z);m.rotation.set(.4,a,-.6);return m;
 };
 if(item.family==='swatter'){
  shaft(1.05,.035,enamel);const y=1.25,w=.65*scale,h=.75*scale;
  for(const side of [-1,1]){bar(side*w/2,y,0,.035,h,.045,enamel);bar(0,y+side*h/2,0,w,.035,.045,enamel);}
  for(let i=1;i<9;i++){bar(-w/2+w*i/9,y,0,.012,h,.015,steel);bar(0,y-h/2+h*i/9,0,w,.012,.015,steel);}
  for(let i=0;i<tier;i++)mesh(new THREE.OctahedronGeometry(.035),gold,0,.25+i*.11,0);
 }else if(item.family==='pan'){
  shaft(.85,.055,wood);const pan=mesh(new THREE.CylinderGeometry(.48*scale,.44*scale,.11,48),new THREE.MeshStandardMaterial({color:'#29323d',metalness:.9,roughness:.3}),0,1.12,0);pan.rotation.x=Math.PI/2;
  const rim=mesh(new THREE.TorusGeometry(.48*scale,.027,10,64),steel,0,1.12,.07);
  const base=mesh(new THREE.CylinderGeometry(.31*scale,.31*scale,.012,48),steel,0,1.12,-.062);base.rotation.x=Math.PI/2;
  for(let i=0;i<tier;i++){const ring=mesh(new THREE.TorusGeometry((.15+i*.045)*scale,.008,6,48),gold,0,1.12,-.075);ring.rotation.z=i*.3;}
 }else if(item.family==='planter'){
  mesh(new THREE.CylinderGeometry(.48*scale,.3*scale,.65*scale,32),new THREE.MeshStandardMaterial({color:'#c08266',roughness:.72}),0,.34*scale,0);
  const rim=mesh(new THREE.TorusGeometry(.48*scale,.05,10,40),enamel,0,.67*scale,0);rim.rotation.x=Math.PI/2;
  mesh(new THREE.CylinderGeometry(.43*scale,.43*scale,.045,32),new THREE.MeshStandardMaterial({color:'#302a28',roughness:1}),0,.64*scale,0);
  for(let i=0;i<8+tier*2;i++){const a=i*2.4,r=.18*scale;const m=leaf(Math.cos(a)*r,.67*scale,Math.sin(a)*r,a,.55*scale,.17*scale);m.rotation.z=Math.sin(a)*.65;}
  for(let i=0;i<tier+2;i++){const a=i*2.4;mesh(new THREE.IcosahedronGeometry(.09,1),enamel,Math.cos(a)*.28*scale,.95*scale+Math.sin(a)*.2,Math.sin(a)*.28*scale);}
 }else{
  const h=2.5*scale;shaft(h,.105,wood);
  for(let i=0;i<18;i++){const ring=mesh(new THREE.TorusGeometry(.108,.009,5,14),gold,0,i*h/18,0);ring.rotation.x=Math.PI/2;}
  for(let i=0;i<9+tier;i++){const a=i/(9+tier)*Math.PI*2;const shape=new THREE.Shape();shape.moveTo(0,0);for(let j=1;j<=14;j++){const t=j/14;shape.lineTo(t*1.3*scale,Math.sin(t*Math.PI)*.26*scale*(j%2?.7:1));}for(let j=14;j>=0;j--){const t=j/14;shape.lineTo(t*1.3*scale,-Math.sin(t*Math.PI)*.26*scale*(j%2?.7:1));}const frond=mesh(new THREE.ShapeGeometry(shape),leafMat,0,h-.12,0);frond.rotation.set(Math.PI/2+.25,a,0);}
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;mesh(new THREE.SphereGeometry(.17,12,10),wood,Math.cos(a)*.18,h-.15,Math.sin(a)*.18);}
 }
 g.userData.reach=new THREE.Box3().setFromObject(g).max.y+.2;return g;
}
