// Volumetric catch specimens. Shared geometry uses owned materials/textures and explicit disposal.
export function createFishModel(T,species){
 const root=new T.Group(),swimmers=[],tentacles=[],[base,light,dark]=species.colors;
 root.name=species.name;root.userData.species=species.id;
 const textureCanvas=document.createElement('canvas');textureCanvas.width=1024;textureCanvas.height=512;
 const ctx=textureCanvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,512);
 gradient.addColorStop(0,dark);gradient.addColorStop(.28,base);gradient.addColorStop(.6,light);gradient.addColorStop(1,dark);ctx.fillStyle=gradient;ctx.fillRect(0,0,1024,512);
 for(let y=0;y<512;y+=18)for(let x=0;x<1024;x+=22){ctx.strokeStyle=(x/22+y/18)%3?light:dark;ctx.globalAlpha=.36;ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(x+(y/18%2)*11,y,12,0,Math.PI);ctx.stroke();}
 ctx.globalAlpha=.75;for(let i=0;i<95;i++){const x=(i*137+species.index*31)%1024,y=70+(i*97)%360;ctx.fillStyle=i%4?dark:light;ctx.beginPath();if(species.pattern%3===0)ctx.ellipse(x,y,4+i%7,2+i%5,.4,0,Math.PI*2);else if(species.pattern%3===1)ctx.ellipse(x,y,4,30+i%25,.5,0,Math.PI*2);else ctx.ellipse(x,y,10,3,-.4,0,Math.PI*2);ctx.fill();}
 ctx.globalAlpha=1;
 const map=new T.CanvasTexture(textureCanvas);map.colorSpace=T.SRGBColorSpace;
 const skin=new T.MeshStandardMaterial({map,color:'#ffffff',metalness:.2,roughness:.42,emissive:dark,emissiveIntensity:.12});
 const luminous=new T.MeshStandardMaterial({color:light,emissive:light,emissiveIntensity:.3,metalness:.3,roughness:.25});
 const black=new T.MeshStandardMaterial({color:'#080e22',roughness:.12,metalness:.3});
 const membrane=new T.MeshStandardMaterial({color:base,emissive:base,emissiveIntensity:.12,metalness:.25,roughness:.4,side:T.DoubleSide,transparent:true,opacity:.78});
 const sphere=(parent,p,s,mat=skin)=>{const m=new T.Mesh(new T.SphereGeometry(1,32,20),mat);m.position.set(...p);m.scale.set(...s);parent.add(m);return m;};
 const tube=(parent,points,r,mat=skin)=>{const m=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),40,r,7,false),mat);parent.add(m);return m;};
 function fin(parent,points,origin,mat=membrane){
  const vertices=[],indices=[];vertices.push(...origin);points.forEach(p=>vertices.push(...p));
  for(let i=1;i<points.length;i++)indices.push(0,i,i+1);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=new T.Mesh(geo,mat);parent.add(mesh);
  const rays=[];for(const p of points)rays.push(...origin,...p);
  const lines=new T.BufferGeometry();lines.setAttribute('position',new T.Float32BufferAttribute(rays,3));parent.add(new T.LineSegments(lines,new T.LineBasicMaterial({color:light,transparent:true,opacity:.6})));
  return mesh;
 }
 const abyss=species.eldritch||species.shape==='manta';
 if(!abyss){
  const deep=['discus','angel','tang','emperor','butterfly','ryukin','pearlscale'].includes(species.shape),slim=['arowana','ribbon','gar','pike','sturgeon'].includes(species.shape);
  const height=deep?.66:slim?.26:.43;
  sphere(root,[0,0,0],[1.08,height,.32]);
  // Sculpted cheeks and paired eyes keep a true silhouette throughout a full turn.
  for(const side of [-1,1]){sphere(root,[.76,.11,side*.25],[.16,.15,.07],luminous);sphere(root,[.79,.12,side*.3],[.085,.09,.04],black);sphere(root,[.81,.155,side*.33],[.025,.025,.016],luminous);
   tube(root,[[.53,height*.65,side*.2],[.45,0,side*.325],[.55,-height*.65,side*.2]],.012,luminous);
   const sideFin=new T.Group();sideFin.position.set(.25,-.08,side*.25);root.add(sideFin);fin(sideFin,Array.from({length:13},(_,i)=>[-.12-i*.036,-.05-Math.sin(i/12*Math.PI)*.18,side*(.08+Math.sin(i/12*Math.PI)*.5)]),[0,0,0]);swimmers.push({part:sideFin,axis:'y',amount:.16,phase:side});
  }
  const tail=new T.Group();tail.position.x=-.95;root.add(tail);
  fin(tail,Array.from({length:25},(_,i)=>{const t=i/24;return [-.62-Math.sin(t*Math.PI)*.13,(t-.5)*(deep?1.6:1.15),Math.sin(t*Math.PI*6)*.04];}),[.02,0,0]);
  swimmers.push({part:tail,axis:'y',amount:.25,phase:0});
  fin(root,Array.from({length:27},(_,i)=>{const t=i/26;return [-.8+t*1.25,height*.8+Math.sin(t*Math.PI)*(species.shape==='sailfish'?.85:.4),.01];}),[-.15,height*.4,0]);
  fin(root,Array.from({length:17},(_,i)=>[-.65+i*.055,-height*.65-Math.sin(i/16*Math.PI)*.3,0]),[-.1,-height*.3,0]);
  sphere(root,[1.03,-.015,0],[.075,.06,.11],black);
  if(['catfish','loach','sturgeon','lantern'].includes(species.shape))for(const side of [-1,1])tube(root,[[.95,0,side*.1],[1.22,-.12,side*.35],[1.35,-.35,side*.4]],.009,luminous);
 }else{
  const jelly=species.shape==='jelly',nautilus=species.shape==='nautilus',leviathan=species.shape==='leviathan',ray=species.shape==='manta';
  sphere(root,[0,.35,0],jelly?[.74,.55,.65]:nautilus?[.68,.72,.48]:leviathan?[.47,.94,.4]:[.48,.67,.4]);
  if(jelly){const crown=new T.Mesh(new T.SphereGeometry(.8,48,24,0,Math.PI*2,0,Math.PI*.52),membrane);crown.position.y=.2;root.add(crown);}
  if(nautilus){const points=[];for(let i=0;i<=100;i++){const a=i*.18,r=.02+i*.0066;points.push([Math.cos(a)*r,.35+Math.sin(a)*r,.46]);}tube(root,points,.026,luminous);
   for(let i=0;i<28;i++){const a=i/28*Math.PI*2;tube(root,[[Math.cos(a)*.34,.35+Math.sin(a)*.34,.47],[Math.cos(a+.2)*.67,.35+Math.sin(a+.2)*.67,.25]],.009,luminous);}}
  const limbCount=jelly?16:nautilus?10:ray?3:12;
  for(let i=0;i<limbCount;i++){
   const a=i/limbCount*Math.PI*2,points=[];for(let j=0;j<=24;j++){const t=j/24,r=.3+t*.55;points.push(new T.Vector3(Math.cos(a)*r+Math.sin(t*7+a)*t*.23,-.12-t*1.35+Math.sin(t*6+a)*t*.18,Math.sin(a)*r*.65));}
   const curve=new T.CatmullRomCurve3(points),geo=new T.TubeGeometry(curve,36,.055,7,false);
   const attr=geo.attributes.position,basePositions=attr.array.slice();
   // Taper from the mantle to a fine curled tip.
   for(let j=0;j<=36;j++){const center=curve.getPointAt(j/36),scale=1-j/36*.93;for(let k=0;k<=7;k++){const n=j*8+k;attr.setXYZ(n,center.x+(attr.getX(n)-center.x)*scale,center.y+(attr.getY(n)-center.y)*scale,center.z+(attr.getZ(n)-center.z)*scale);}}
   geo.computeVertexNormals();const limb=new T.Mesh(geo,i%3?skin:luminous);root.add(limb);tentacles.push({mesh:limb,base:attr.array.slice(),phase:a});
   for(let j=1;j<9;j++){const point=curve.getPoint(j/10);const bead=sphere(root,[point.x,point.y,point.z+.04],[.022,.028,.018],luminous);swimmers.push({part:bead,axis:'z',amount:.07,phase:a+j});}
  }
  if(['cthulhu','seraph','manta'].includes(species.shape))for(const side of [-1,1]){
   const wing=new T.Group();wing.position.set(side*.25,.3,-.12);root.add(wing);
   fin(wing,Array.from({length:33},(_,i)=>{const t=i/32;return [side*(.25+Math.sin(t*Math.PI)*1.05),.7-t*1.5+Math.sin(t*Math.PI*5)*.1,-Math.sin(t*Math.PI)*.3];}),[0,0,0]);
   swimmers.push({part:wing,axis:'y',amount:.12,phase:side});
  }
  // Overlapping chitin plates and fine luminous seams give the mantle a carved surface.
  if(!jelly&&!nautilus)for(let row=0;row<7;row++)for(const side of [-1,1]){const plate=new T.Mesh(new T.OctahedronGeometry(.1,0),skin);plate.position.set(side*(.19+Math.sin(row*.45)*.17),.8-row*.16,.28+Math.sin(row*.4)*.07);plate.scale.set(1.15,.7,.3);plate.rotation.z=side*.35;root.add(plate);tube(root,[[plate.position.x-side*.08,plate.position.y+.025,plate.position.z+.03],[plate.position.x,plate.position.y-.045,plate.position.z+.04],[plate.position.x+side*.08,plate.position.y+.025,plate.position.z+.03]],.004,luminous);}
  const eyeCount=species.shape==='oracle'?7:3;
  for(let i=0;i<eyeCount;i++){const a=(i-(eyeCount-1)/2)*.32,x=Math.sin(a)*.44,y=.4+Math.cos(a)*.17,z=.35+Math.cos(a)*.04;sphere(root,[x,y,z],[.085,.075,.035],luminous);sphere(root,[x,y,z+.03],[.022,.056,.015],black);}
  if(!jelly&&!nautilus)for(let i=0;i<9;i++){const a=i/9*Math.PI*2;tube(root,[[Math.cos(a)*.32,.7,Math.sin(a)*.25],[Math.cos(a)*.44,1.05,Math.sin(a)*.36],[Math.cos(a)*.38,1.25,Math.sin(a)*.32]],.022,luminous);}
 }
 root.userData.swimmers=swimmers;root.userData.tentacles=tentacles;root.userData.ownedTexture=map;
 return root;
}
export function animateFishModel(model,time){
 for(const s of model.userData.swimmers||[])s.part.rotation[s.axis]=Math.sin(time*2.5+s.phase)*s.amount;
 for(const t of model.userData.tentacles||[]){const attr=t.mesh.geometry.attributes.position;for(let i=0;i<attr.count;i++){const x=t.base[i*3],y=t.base[i*3+1],z=t.base[i*3+2],w=Math.max(0,-y)*.055;attr.setXYZ(i,x+Math.sin(time*3+y*5+t.phase)*w,y,z+Math.cos(time*2.5+y*4+t.phase)*w);}attr.needsUpdate=true;}
}
export function disposeFishModel(model){
 const geometries=new Set(),materials=new Set();model.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());model.userData.ownedTexture?.dispose();
}
