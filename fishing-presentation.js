// Animation is derived from the shared fishing session, so both players see the same stage.
const fishPoseStates=new Map(),fishingPoseRestore=[],fishBoneCache=new WeakMap();
function syncFishingPoses(f){
 for(const [name,s] of Object.entries(f.sessions||{})){
  let p=fishPoseStates.get(name);
  if(!p||p.id!==s.id){p={id:s.id,stage:s.stage,age:0,session:s,presented:s.stage==='caught'};fishPoseStates.set(name,p);}
  if(p.stage!==s.stage){p.stage=s.stage;p.age=0;p.presented=false;}
  p.session=s;
 }
 for(const [name,p] of fishPoseStates)if(!f.sessions?.[name]||f.sessions[name].id!==p.id){if(p.landingFish){scene.remove(p.landingFish);disposeFishModel(p.landingFish);}fishPoseStates.delete(name);}
}
function fishingPoseFor(name){
 const p=fishPoseStates.get(name);return p&&(['waiting','fight'].includes(p.stage)||(p.stage==='caught'&&!p.presented&&p.age<1.7))?p:null;
}
function restoreFishingPoses(){
 for(const saved of fishingPoseRestore){if(saved.quaternion)saved.object.quaternion.copy(saved.quaternion);if(saved.position)saved.object.position.copy(saved.position);}
 fishingPoseRestore.length=0;
}
function fishingBones(model){
 if(!fishBoneCache.has(model)){const bones={};model.traverse(b=>{if(b.isBone)bones[b.name.replace(/[^a-z0-9]/gi,'').replace(/^mixamorig\d*/,'')]=b;});fishBoneCache.set(model,bones);}
 return fishBoneCache.get(model);
}
function applyFishingPoses(){
 const players=[{character:selectedCharacter,model:charModel,root:charRoot},...[...remotePlayers.values()]];
 for(const player of players){
  const p=fishingPoseFor(player.character);if(!p||!player.model)continue;
  const hole=fstate().holes.find(h=>h.id===p.session.hole);if(!hole)continue;
  const model=player.model,bones=fishingBones(model),fight=p.stage==='fight',landing=p.stage==='caught';
  const bite=p.stage==='waiting'&&Date.now()>=p.session.biteAt,shake=bite||fight;
  const wave=Math.sin(globalTime*(bite?24:13)),pull=fight?(.5+.5*Math.sin(globalTime*4)):0,lift=landing?Math.sin(Math.min(1,p.age/1.6)*Math.PI):0;
  fishingPoseRestore.push({object:model,position:model.position.clone(),quaternion:model.quaternion.clone()});
  const root=player.root||model.parent;model.rotation.y=Math.atan2(hole.position[0]-root.position.x,hole.position[2]-root.position.z);
  model.position.y+=(shake?wave*.045:Math.sin(globalTime*2)*.008)+lift*.12;
  const rotates={
   RightArm:[-.85-pull*.35-lift*1.1,0,-.65+(shake?wave*.07:0)],
   RightForeArm:[-.65-pull*.4-lift*.35,.12,.18],
   LeftArm:[-.75-pull*.2-lift*.5,.25,.65],
   LeftForeArm:[-1.2,-.2,-.3+(fight&&p.session.reeling?Math.sin(globalTime*14)*.2:0)],
   Spine2:[.1-pull*.2-lift*.2,0,shake?wave*.025:0],
   Head:[.1-lift*.2,Math.sin(globalTime*1.5)*.04,0]
  };
  for(const [key,angles] of Object.entries(rotates)){const bone=bones[key];if(!bone)continue;fishingPoseRestore.push({object:bone,quaternion:bone.quaternion.clone()});bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles)));}
  model.updateMatrixWorld(true);
 }
}
function updateFishingPresentation(dt){
 for(const [name,p] of fishPoseStates){
  p.age+=dt;
  if(p.stage!=='caught'||p.presented)continue;
  const species=fishById(p.session.result?.species),hole=fstate().holes.find(h=>h.id===p.session.hole);
  if(!species||!hole){p.presented=true;continue;}
  const player=name===selectedCharacter?{model:charModel,root:charRoot}:[...remotePlayers.values()].find(r=>r.character===name);
  if(!player?.model)continue;
  if(!p.landingFish){p.landingFish=createFishModel(THREE,species);p.landingFish.scale.setScalar(.24);scene.add(p.landingFish);}
  const end=player.root.position.clone().add(new THREE.Vector3(0,1.7,0)),start=new THREE.Vector3(...hole.position);start.y=-.24;
  const t=Math.min(1,p.age/1.3);p.landingFish.position.lerpVectors(start,end,t);p.landingFish.position.y+=Math.sin(t*Math.PI)*1.5;
  p.landingFish.rotation.set(.15,globalTime*3,.25*Math.sin(globalTime*10));animateFishModel(p.landingFish,globalTime);
  if(p.age>=1.65){scene.remove(p.landingFish);disposeFishModel(p.landingFish);delete p.landingFish;p.presented=true;
   if(name===selectedCharacter){reelHeld=false;openCatchViewer(p.session.result);}
  }
 }
}

const catchStyle=document.createElement('style');catchStyle.textContent=`
body[data-fishing-active="true"] #fishing-panel{top:var(--panel-top,90px);bottom:auto;max-height:min(300px,40dvh);height:auto}
body[data-fishing-active="true"] #fishing-panel :is(nav,#fishing-feedback,.fishing-guide,#fishing-content>label,header>div){display:none}
body[data-fishing-active="true"] #fishing-panel header{justify-content:flex-end;padding:0;min-height:0}
body[data-fishing-active="true"] #fishing-content{overflow:auto}
body[data-fishing-active="true"] .float-scene{min-height:28px;margin:2px 0}
body[data-fishing-active="true"] #fishing-panel .fish-controls{margin:4px 0}
#catch-viewer{position:fixed;inset:0;margin:auto;padding:0;border:1px solid #c6abdd66;border-radius:28px;width:min(680px,94vw);max-width:94vw;height:min(760px,92dvh);max-height:92dvh;overflow:hidden;color:#eee5fa;background:radial-gradient(ellipse at 50% 40%,#243c46,#121629 60%,#0d1020);box-shadow:0 25px 100px #080714aa;cursor:zoom-out;transition:transform .24s ease,opacity .24s ease}
#catch-viewer::backdrop{background:#080b1bd9;backdrop-filter:blur(7px)}
#catch-viewer.closing{transform:scale(.15) translateY(80px);opacity:0}
#catch-viewer .catch-layout{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;text-align:center}
#catch-viewer header{padding:24px 20px 0;pointer-events:none}
#catch-viewer small{font:11px/1.4 sans-serif;letter-spacing:.24em;color:#b3dccf}
#catch-viewer h2{font:clamp(24px,5vw,38px)/1.15 Georgia,serif;margin:10px 0;color:#f2e3fc}
#catch-stage{position:relative;min-height:0;width:100%;overflow:hidden}
#catch-stage canvas{display:block;width:100%!important;height:100%!important;touch-action:none}
#catch-viewer footer{padding:0 20px 24px;pointer-events:none}
#catch-viewer .catch-weight{font:18px/1.6 Georgia;color:#ffe5af}
#catch-viewer .catch-hint{font:12px/1.6 sans-serif;color:#acafc5;margin:8px 0 0}
@media(max-height:480px){#catch-viewer header{padding:10px 14px 0}#catch-viewer h2{margin:3px;font-size:22px}#catch-viewer footer{padding:0 14px 8px}#catch-viewer .catch-hint{margin:0}}
`;document.head.append(catchStyle);
const catchDialog=document.createElement('dialog');catchDialog.id='catch-viewer';catchDialog.setAttribute('aria-labelledby','catch-name');
catchDialog.innerHTML='<div class="catch-layout"><header><small id="catch-rarity"></small><h2 id="catch-name"></h2></header><div id="catch-stage" role="button" tabindex="0" aria-label="Rotating catch. Click to minimize."></div><footer><div class="catch-weight" id="catch-weight"></div><p class="catch-hint">Saved to your collection · click the specimen to minimize</p></footer></div>';document.body.append(catchDialog);
const catchViewState={model:null,renderer:null,species:null,frame:0,closing:false};
let catchFocus=null;
function openCatchViewer(fish){
 const species=fishById(fish?.species);if(!species||catchViewerOpen)return;
 catchFocus=document.activeElement;keysDown.clear();reelHeld=false;catchViewerOpen=true;catchViewState.closing=false;catchDialog.classList.remove('closing');
 $('catch-name').textContent=species.name;$('catch-rarity').textContent=['','COMMON','UNCOMMON','RARE','EPIC','MYTHIC','RELIC · CRIMSON SPRING','ELDRITCH · CRIMSON SPRING'][species.rarity];
 $('catch-weight').textContent=fish.kg+' kg · '+fishPrice(fish)+' coins';catchDialog.showModal();$('catch-stage').focus();
 const stage=$('catch-stage'),viewScene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,40);
 const viewRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true});viewRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));viewRenderer.outputColorSpace=THREE.SRGBColorSpace;viewRenderer.toneMapping=THREE.ACESFilmicToneMapping;viewRenderer.toneMappingExposure=1.05;stage.replaceChildren(viewRenderer.domElement);
 const model=createFishModel(THREE,species);viewScene.add(model);viewScene.add(new THREE.HemisphereLight('#e4e5ff','#274b50',1.8));
 for(const [color,power,pos] of [['#fff0d5',2.8,[3,4,5]],['#8cebdd',1.8,[-3,1,-2]],['#cf89ff',2,[2,-1,-3]]]){const l=new THREE.DirectionalLight(color,power);l.position.set(...pos);viewScene.add(l);}
 const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());model.position.sub(center);const turntable=new THREE.Group();viewScene.remove(model);turntable.add(model);viewScene.add(turntable);
 Object.assign(catchViewState,{model:turntable,renderer:viewRenderer,species:species.id});
 let elapsed=0,last=performance.now(),lastW=0,lastH=0;
 function frame(now){
  if(!catchViewerOpen)return;elapsed+=Math.min(.05,(now-last)/1000);last=now;
  const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
  if(w!==lastW||h!==lastH){lastW=w;lastH=h;viewRenderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
   const radius=Math.max(size.length()/2,1),fov=THREE.MathUtils.degToRad(36),distance=radius/Math.sin(Math.min(fov/2,Math.atan(Math.tan(fov/2)*camera.aspect)))*1.08;
   camera.position.set(0,.18,distance);camera.lookAt(0,0,0);}
  turntable.rotation.y=elapsed*.55;turntable.rotation.z=Math.sin(elapsed*.7)*.035;animateFishModel(model,elapsed);viewRenderer.render(viewScene,camera);
  catchViewState.frame=requestAnimationFrame(frame);
 }
 catchViewState.dispose=()=>{disposeFishModel(model);viewRenderer.dispose();viewRenderer.forceContextLoss();stage.replaceChildren();Object.assign(catchViewState,{model:null,renderer:null,species:null});};
 catchViewState.frame=requestAnimationFrame(frame);
}
function closeCatchViewer(){
 if(!catchViewerOpen||catchViewState.closing)return;catchViewState.closing=true;catchDialog.classList.add('closing');
 setTimeout(()=>{catchViewerOpen=false;cancelAnimationFrame(catchViewState.frame);catchViewState.dispose?.();catchDialog.close();catchViewState.closing=false;if(catchFocus?.isConnected)catchFocus.focus({preventScroll:true});else $('fishing-open').focus({preventScroll:true});},240);
}
catchDialog.onclick=e=>{e.stopPropagation();closeCatchViewer();};catchDialog.oncancel=e=>{e.preventDefault();closeCatchViewer();};

function aquariumFeature(data){
 const group=new THREE.Group();group.name='Raised glass aquarium';group.position.fromArray(data.position);
 const [w,h,d]=data.size||[6,2.1,4];group.userData.dimensions=[w,h,d];
 const frameMat=new THREE.MeshStandardMaterial({color:'#b9b8c9',metalness:.7,roughness:.3});
 const baseMat=new THREE.MeshStandardMaterial({color:'#354655',roughness:.65,metalness:.3});
 const glassMat=new THREE.MeshPhongMaterial({color:'#bde9e5',transparent:true,opacity:.14,shininess:100,side:THREE.DoubleSide,depthWrite:false});
 const box=(width,height,depth,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),mat);m.position.set(x,y,z);group.add(m);return m;};
 box(w+.12,.2,d+.12,0,.1,0,baseMat);
 for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])box(.065,h,.065,x,h/2,z,frameMat);
 for(const y of [.22,h]){for(const z of [-d/2,d/2])box(w,.045,.045,0,y,z,frameMat);for(const x of [-w/2,w/2])box(.045,.045,d,x,y,0,frameMat);}
 for(const z of [-d/2,d/2])box(w,h-.2,.012,0,(h+.2)/2,z,glassMat).renderOrder=3;
 for(const x of [-w/2,w/2])box(.012,h-.2,d,x,(h+.2)/2,0,glassMat).renderOrder=3;
 box(w-.1,.04,d-.1,0,.23,0,new THREE.MeshStandardMaterial({color:'#b2bab2',roughness:1}));
 const water=new THREE.Mesh(new THREE.PlaneGeometry(w-.08,d-.08),new THREE.ShaderMaterial({
  uniforms:{time:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
  vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec2 v;uniform float time;void main(){float lines=pow(.5+.5*sin(v.x*38.+sin(v.y*24.+time)*2.),12.);gl_FragColor=vec4(vec3(.28,.65,.67)+lines*.2,.15+lines*.13);}'
 }));water.rotation.x=-Math.PI/2;water.position.y=h*.88;water.renderOrder=2;group.add(water);group.userData.water=water;
 // Sparse substrate plants keep the glass clear and draw calls bounded on phones.
 const greenery=new THREE.MeshStandardMaterial({color:'#427a69',roughness:.8,side:THREE.DoubleSide});
 for(let i=0;i<6;i++){const stem=new THREE.Mesh(new THREE.ConeGeometry(.06,h*.32,5),greenery);stem.position.set((i%3-1)*w*.3,.25+h*.16,(i<3?-1:1)*d*.32);stem.rotation.z=Math.sin(i*2)*.15;group.add(stem);}
 scene.add(group);return group;
}
