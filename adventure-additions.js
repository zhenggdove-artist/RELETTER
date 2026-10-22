// Garden adventures: hand-held equipment, water features and a server-authoritative fishing loop.
import {FISH,fishById,fishPrice,fishingById,selectedChisel,AQUARIUM_SIZES,fishDimensions,aquariumFit,chooseFishingHole} from './fishing-catalog.js';
import {fishSVG,fishDataURL} from './fish-art.js';
import {createFishModel,createWorldFishModel,animateFishModel,disposeFishModel} from './fish-model.js';
const notice=document.createElement('div');notice.id='command-notice';notice.setAttribute('role','status');document.body.append(notice);let noticeTimer;
function centerNotice(text){notice.textContent=text;notice.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove('show'),2200);}
const boneCache=new WeakMap(),handPosition=new THREE.Vector3(),handRotation=new THREE.Quaternion(),auraRotation=new THREE.Quaternion();
function rightHand(model){if(!boneCache.has(model)){let hand;model.traverse(b=>{if(b.isBone&&b.name.replace(/[^a-z]/gi,'').endsWith('RightHand'))hand=b;});boneCache.set(model,hand);}return boneCache.get(model);}
function makeHeldWeapon(item){
 if(['swatter','pan','planter','palm'].includes(item.family))return makeNovelWeapon(item);
 const tier=item.tier||1,length=1.6+(tier-1)*1.05,width=1+(tier-1)*.8;const group=new THREE.Group();group.userData.tier=tier;group.name='Hand-held '+item.family;group.userData.family=item.family;group.userData.reach=length+.35;
 const metal=new THREE.MeshStandardMaterial({color:'#bcb6c9',metalness:.88,roughness:.22}),gold=new THREE.MeshStandardMaterial({color:'#dabd7e',metalness:.85,roughness:.27}),grip=new THREE.MeshStandardMaterial({color:'#33253f',roughness:.7});
 const cylinder=(r,h,y,mat)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,16),mat);m.position.y=y;group.add(m);return m;};
 cylinder(.055,.28,0,grip);for(let i=0;i<7;i++)cylinder(.06,.012,-.12+i*.04,metal);cylinder(.075,.055,-.17,gold);cylinder(.09,.07,.18,gold);
 const jewel=new THREE.Mesh(new THREE.OctahedronGeometry(.085),new THREE.MeshStandardMaterial({color:item.color,emissive:item.color,emissiveIntensity:.7,metalness:.5,roughness:.15}));jewel.position.y=-.23;group.add(jewel);
 if(item.family==='saber'){
  const guard=new THREE.Mesh(new THREE.TorusGeometry(.16,.024,8,32,Math.PI*1.55),gold);guard.position.y=.21;guard.rotation.z=.7;group.add(guard);
  // Faceted blade and engraved rails remain visible even against the bright sky.
  const bladeGeo=new THREE.CylinderGeometry(.012*width,.055*width,length,4);const blade=new THREE.Mesh(bladeGeo,new THREE.MeshStandardMaterial({color:'#f6eeff',emissive:item.color,emissiveIntensity:.85,metalness:.3,roughness:.12}));blade.position.y=.26+length/2;group.add(blade);
  for(const [r,opacity] of [[.065,.2],[.105,.07]]){const halo=new THREE.Mesh(new THREE.CylinderGeometry(.012*width,r*width,length+.05,12),glowMaterial(item.color,opacity));halo.position.y=.26+length/2;group.add(halo);}
  for(const sign of [-1,1]){const rail=new THREE.Mesh(new THREE.CylinderGeometry(.012,.024,.52,8),gold);rail.position.set(sign*.055,.49,0);rail.rotation.z=sign*.12;group.add(rail);}
  const runes=new THREE.Group();for(let i=0;i<6+tier*2;i++){const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.023),glowMaterial(i%2?'#fff7dd':item.color,.8));gem.position.set(0,.48+i*(length-.3)/(6+tier*2),.055*width);gem.rotation.z=Math.PI/4;runes.add(gem);}group.add(runes);
 }else{
  const geo=new THREE.BufferGeometry(),positions=new Float32Array(49*8*3),indices=[];for(let n=0;n<48;n++)for(let j=0;j<8;j++){const a=n*8+j,b=n*8+(j+1)%8;indices.push(a,b,a+8,b,b+8,a+8);}geo.setAttribute('position',new THREE.BufferAttribute(positions,3));const normals=new Float32Array(positions.length);for(let n=0;n<49;n++)for(let j=0;j<8;j++){normals[(n*8+j)*3]=Math.cos(j*Math.PI/4);normals[(n*8+j)*3+1]=Math.sin(j*Math.PI/4);}geo.setAttribute('normal',new THREE.BufferAttribute(normals,3));geo.setIndex(indices);
  const lash=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:item.color,emissive:item.color,emissiveIntensity:.65,metalness:.45,roughness:.28}));lash.frustumCulled=false;group.add(lash);group.userData.lash=lash;const braid=new THREE.BufferGeometry();braid.setAttribute('position',new THREE.BufferAttribute(new Float32Array(49*3),3));const braidLine=new THREE.Line(braid,new THREE.LineBasicMaterial({color:'#ffe3b4',transparent:true,opacity:.85}));braidLine.frustumCulled=false;group.add(braidLine);group.userData.braid=braidLine;
  const tip=new THREE.Mesh(new THREE.IcosahedronGeometry(.075,1),glowMaterial('#fff4d9',.9));group.add(tip);group.userData.tip=tip;
 }return group;
}
function attachHeldWeapon(player,aura,blade,fx){
 const activeCast=fstate().sessions?.[player.character];if(activeCast&&fishingPoseFor(player.character)){blade.visible=false;return;}const hand=rightHand(player.model);if(!hand){blade.visible=false;return;}blade.visible=true;
 player.model.updateMatrixWorld(true);aura.updateMatrixWorld(true);hand.getWorldPosition(handPosition);blade.position.copy(aura.worldToLocal(handPosition));hand.getWorldQuaternion(handRotation);aura.getWorldQuaternion(auraRotation);blade.quaternion.copy(auraRotation.invert().multiply(handRotation)).normalize();if(['swatter','pan'].includes(blade.userData.family))blade.rotateY(.55);
 // Stop large rigid weapons at the ground rather than burying their visible head.
 if(!blade.userData.lash){const worldQ=blade.getWorldQuaternion(new THREE.Quaternion()),up=new THREE.Vector3(0,1,0).applyQuaternion(worldQ),gripY=hand.getWorldPosition(new THREE.Vector3()).y,minY=THREE.MathUtils.clamp((.2-gripY)/(blade.userData.reach||2),-.95,.95);if(up.y<minY){const desired=up.clone();desired.y=0;if(desired.lengthSq()<.001)desired.set(0,0,1);desired.normalize().multiplyScalar(Math.sqrt(1-minY*minY));desired.y=minY;const correction=new THREE.Quaternion().setFromUnitVectors(up,desired),parent=aura.getWorldQuaternion(new THREE.Quaternion()).invert();blade.quaternion.copy(parent.multiply(correction).multiply(worldQ));}}
 // Grip origin remains at the hand in idle, running and all attack poses.
 if(blade.userData.lash){const attr=blade.userData.lash.geometry.attributes.position,age=fx?.age||0,energy=fx?Math.sin(Math.min(1,age/fx.duration)*Math.PI):0,combo=fx?.combo||0;let tip;
  for(let n=0;n<=48;n++){const t=n/48,length=1.3+energy*(3.4+(blade.userData.tier-1)*1.5),a=t*Math.PI*(2+(combo%3))+globalTime*3,x=Math.sin(a-age*10)*t*(.2+energy*.8),y=.23+t*(.7+energy*2.4)-(1-energy)*t*t*1.8,z=t*length*energy+Math.cos(a)*t*.18;for(let j=0;j<8;j++){const q=j*Math.PI/4,r=.03*(1-t)+.006;attr.setXYZ(n*8+j,x+Math.cos(q)*r,y+Math.sin(q)*r,z);}const braid=blade.userData.braid.geometry.attributes.position,twist=t*55;braid.setXYZ(n,x+Math.cos(twist)*.035,y+Math.sin(twist)*.035,z);tip=[x,y,z];}blade.userData.braid.geometry.attributes.position.needsUpdate=true;attr.needsUpdate=true;blade.userData.tip.position.fromArray(tip);
 }
}

let fishingHUDActive=false;
let reelHeld=false,fishBusy=false,fishPollBusy=false,fishTab='cast',fishSignature='',selectedHole=null,manualHole=null,holeRefreshAt=0;
const fishingButton=document.createElement('button');fishingButton.id='fishing-open';fishingButton.textContent='FISH';dock.append(fishingButton);
const fishingPanel=document.createElement('section');fishingPanel.id='fishing-panel';fishingPanel.hidden=true;fishingPanel.innerHTML=`<header><div><small>THE WATER GARDEN</small><h2>Stillwater</h2></div><button id="fishing-close" aria-label="Close fishing">×</button></header><nav><button data-fish-tab="cast">Fish</button><button data-fish-tab="collection">Collection</button><button data-fish-tab="pond">Aquariums</button><button data-fish-tab="atlas">${FISH.length} species</button></nav><p id="fishing-feedback" role="status">Equip a rod in SHOP. Use a chisel to open a fishing hole.</p><div id="fishing-content"></div>`;document.body.append(fishingPanel);
const fstate=()=>gameView.fishing||{holes:[],ponds:[],bags:{},sessions:{}};
const distanceTo=p=>Math.hypot(charRoot.position.x-p[0],charRoot.position.z-p[2]);
const fishHUD=document.createElement('div');fishHUD.id='fishing-hud';fishHUD.hidden=true;
fishHUD.innerHTML=`<div id="fishing-meters"><span id="bite-status" role="status"></span><label>TENSION <meter id="line-tension" min="0" max="1" low=".13" high=".88" optimum=".5"></meter></label><label>LANDING <progress id="catch-progress" max="100" value="0"></progress></label></div><div id="world-fishing-action"><button id="hook-fish">HOOK</button><button id="reel-fish">HOLD</button><small>Hold to reel · release to ease</small></div><nav id="fishing-tools" aria-label="Fishing tools"></nav>`;
document.body.append(fishHUD);
function syncFishingHUD(){
 const show=fishingHUDActive&&admitted;fishHUD.hidden=!show;document.body.classList.toggle('fishing-hud-active',show);
}
function openFishing(tab='cast'){
 if(!admitted)return;claimPanel('fishing');reelHeld=false;fishTab=tab;fishingHUDActive=tab==='cast';fishingPanelOpen=!fishingHUDActive;fishingPanel.hidden=fishingHUDActive;fishSignature='';syncFishingHUD();renderFishing(true);reflectPanels();
}
fishingButton.onclick=()=>openFishing();$('fishing-close').onclick=()=>{claimPanel('none');reflectPanels();};
for(const button of fishingPanel.querySelectorAll('[data-fish-tab]'))button.onclick=()=>openFishing(button.dataset.fishTab);
let hookPointerId=null;
const hookButton=$('hook-fish'),reelButton=$('reel-fish');
hookButton.onpointerdown=e=>{e.preventDefault();hookPointerId=e.pointerId;hookButton.setPointerCapture(e.pointerId);reelHeld=true;adventureAction({action:'hook',id:fstate().sessions?.[selectedCharacter]?.id});};
hookButton.onclick=e=>{if(e.detail===0)adventureAction({action:'hook',id:fstate().sessions?.[selectedCharacter]?.id});};
reelButton.onpointerdown=e=>{e.preventDefault();reelButton.setPointerCapture(e.pointerId);reelHeld=true;};
for(const button of [hookButton,reelButton]){
 button.onpointerup=button.onpointercancel=button.onlostpointercapture=()=>{reelHeld=false;hookPointerId=null;};
 button.onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();if(button===hookButton&&!e.repeat)adventureAction({action:'hook',id:fstate().sessions?.[selectedCharacter]?.id});reelHeld=true;}};
 button.onkeyup=()=>reelHeld=false;
}
window.addEventListener('blur',()=>reelHeld=false);window.addEventListener('pointerup',()=>reelHeld=false);window.addEventListener('pointercancel',()=>reelHeld=false);
async function adventureAction(body){if(fishBusy)return;fishBusy=true;try{const r=await api('/api/game',body);if(r.game)receiveGame(r.game);if(r.notice)centerNotice(r.notice);$('fishing-feedback').textContent=r.notice||'Saved for both players.';return r;}catch(e){$('fishing-feedback').textContent=e.message;centerNotice(e.message);}finally{fishBusy=false;}}
const fishIllustrations=new Map();function cachedFishArt(species){if(!fishIllustrations.has(species.id))fishIllustrations.set(species.id,fishDataURL(species));return fishIllustrations.get(species.id);}
shopPanel.addEventListener('click',e=>{const b=e.target.closest('[data-sell-fish]');if(b)adventureAction({action:'sell-fish',id:b.dataset.sellFish});});
const fishCard=(fish,buttons='')=>{const species=fishById(fish.species)||fish;return `<article class="fish-card"><img loading="lazy" src="${cachedFishArt(species)}" alt="${species.name}"><div><small>${['','COMMON','UNCOMMON','RARE','EPIC','MYTHIC','RELIC','ELDRITCH'][species.rarity]}</small><h3>${species.name}</h3><p>${fish.kg?fish.kg+' kg · '+fishPrice(fish)+' coins':species.minKg+'–'+species.maxKg+' kg'}${species.eldritch?' · '+fishDimensions(species).join(' × ')+' m':''}</p>${fish.caughtAt?'<time>'+new Date(fish.caughtAt).toLocaleDateString()+'</time>':''}<div class="fish-actions">${buttons}</div></div></article>`;};
function renderFishing(force=false){
 if(!fishingPanelOpen&&!fishingHUDActive)return;const f=fstate(),session=f.sessions?.[selectedCharacter],bag=f.bags?.[selectedCharacter]||[],rod=fishingById(gameView.equipment?.[selectedCharacter]?.rod);
 const signature=JSON.stringify([fishTab,fishTab==='cast'?[session?.id,session?.stage,rod?.id,f.holes.map(h=>h.id).join(',')]:[f.revision,gameView.wallets?.[selectedCharacter]]]);if(!force&&signature===fishSignature)return;fishSignature=signature;
 for(const b of fishingPanel.querySelectorAll('[data-fish-tab]'))b.setAttribute('aria-pressed',String(b.dataset.fishTab===fishTab));
 const content=fishTab==='cast'?$('fishing-tools'):$('fishing-content');
 if(fishTab==='cast'){
  const near=[...f.holes];selectedHole=chooseFishingHole(near,charRoot.position.toArray(),manualHole)?.id||null;
  content.innerHTML=`<button id="dig-hole">DIG</button><select id="hole-select" aria-label="Fishing hole">${near.map((h,i)=>'<option value="'+h.id+'" '+(selectedHole===h.id?'selected':'')+'>HOLE '+(i+1)+' · '+Math.round(distanceTo(h.position))+'m · depth '+(h.depth||1)+'m</option>').join('')}</select><button id="cast-line">CAST</button><button id="cancel-fish">CANCEL</button><button id="fish-bag">BAG</button><button id="fish-back">BACK</button>`;
  $('dig-hole').onclick=()=>{const d=new THREE.Vector3(0,0,4).applyAxisAngle(new THREE.Vector3(0,1,0),gameplayHeading(charModel));adventureAction({action:'dig',position:[Math.round(charRoot.position.x+d.x),0,Math.round(charRoot.position.z+d.z)]});};
  $('hole-select').onchange=e=>{manualHole=e.target.value;selectedHole=manualHole;};$('cast-line').onclick=()=>{selectedHole=chooseFishingHole(fstate().holes,charRoot.position.toArray(),manualHole)?.id||null;if(!selectedHole){centerNotice('Stand within 6 m of a hole');return;}adventureAction({action:'cast',hole:selectedHole});};$('cancel-fish').onclick=()=>adventureAction({action:'cancel-fishing'});
  $('fish-bag').onclick=()=>openFishing('collection');$('fish-back').onclick=()=>{claimPanel('none');reflectPanels();};
 }else if(fishTab==='atlas')content.innerHTML=FISH.map(s=>s.redOnly&&!(f.discoveries?.[selectedCharacter]||[]).includes(s.id)?'<article class="fish-card undiscovered"><div aria-hidden="true" style="width:120px;min-height:100px;display:grid;place-items:center;font-size:38px;color:#afa4c2">??</div><div><small>UNDISCOVERED</small><h3>??</h3><p>Discover in crimson waters</p></div></article>':fishCard(s)).join('');
 else if(fishTab==='collection')content.innerHTML=bag.length?bag.map(fish=>fishCard(fish,`<button data-sell-fish="${fish.id}">Sell · ${fishPrice(fish)}</button><span>Kept in collection</span>`)).join(''):'<p>Your catches are kept here automatically. Sell them or release them into a pond.</p>';
 else {const ponds=f.ponds.filter(p=>distanceTo(p.position)<Math.max(7,(p.radius||3)+4)&&charRoot.position.y<3);content.innerHTML=ponds.length?ponds.map(p=>`<section class="pond-collection"><h3>Glass aquarium · ${p.fish.length}/${p.capacity||30}</h3><button data-pond-destroy="${p.id}" ${p.fish.length?'disabled':''}>Remove empty pond</button><h4>Your collection · release into this pond</h4>${bag.map(f=>fishCard(f,`<button data-release="${f.id}" data-pond="${p.id}" ${aquariumFit(p,f)?'disabled':''}>${aquariumFit(p,f)||'Release into pond'}</button>`)).join('')}<h4>Swimming here</h4>${p.fish.map(f=>fishCard(f,f.owner===selectedCharacter?`<button data-retrieve="${f.id}" data-pond="${p.id}">Return to collection</button>`:'')).join('')}</section>`).join(''):'<p>Stand beside a pond to release or retrieve your fish. Purchase a pond in SHOP, then place it in BUILD.</p>';}
}
fishingPanel.addEventListener('click',e=>{const b=e.target.closest('[data-sell-fish],[data-release],[data-retrieve],[data-pond-destroy]');if(!b)return;adventureAction(b.dataset.sellFish?{action:'sell-fish',id:b.dataset.sellFish}:b.dataset.pondDestroy?{action:'pond-destroy',pond:b.dataset.pondDestroy}:{action:b.dataset.release?'pond-release':'pond-retrieve',id:b.dataset.release||b.dataset.retrieve,pond:b.dataset.pond});});
setInterval(async()=>{const s=fstate().sessions?.[selectedCharacter];if(!connected||!s||!['waiting','fight'].includes(s.stage)||fishPollBusy||fishBusy)return;fishPollBusy=true;try{const r=await api('/api/game',{action:'reel',id:s.id,reeling:reelHeld&&fishingHUDActive});if(r.game)receiveGame(r.game);if(r.notice)centerNotice(r.notice);}catch{}finally{fishPollBusy=false;}},250);

const oldBuildPlace=$('build-place').onclick;
const aquariumOptions=document.createElement('label');aquariumOptions.id='aquarium-options';aquariumOptions.hidden=true;aquariumOptions.textContent='Aquarium size ';const aquariumSelect=document.createElement('select');aquariumSelect.id='aquarium-size';for(const [id,tank] of Object.entries(AQUARIUM_SIZES)){const option=document.createElement('option');option.value=id;option.textContent=tank.label+' · '+tank.size.join(' × ')+' m · '+tank.price+' coins';aquariumSelect.append(option);}aquariumOptions.append(aquariumSelect);$('build-status').before(aquariumOptions);
function previewAquarium(){const tank=AQUARIUM_SIZES[aquariumSelect.value];const d=Math.hypot(tank.size[0],tank.size[2])/2+2,a=gameplayHeading(charModel);buildPosition=[Math.round(charRoot.position.x+Math.sin(a)*d),0,Math.round(charRoot.position.z+Math.cos(a)*d)];buildGhost.geometry.dispose();buildGhost.geometry=new THREE.BoxGeometry(...tank.size);buildGhost.geometry.translate(0,tank.size[1]/2,0);buildGhost.material.color.set('#7acbc7');buildGhost.position.set(buildPosition[0],0,buildPosition[2]);$('build-status').textContent=tank.label+' glass aquarium · '+tank.price+' coins · '+tank.capacity+' fish';}
$('build-pond').onclick=()=>{pondBuildMode=true;aquariumOptions.hidden=false;previewAquarium();};aquariumSelect.onchange=previewAquarium;
for(const b of buildPanel.querySelectorAll('[data-shape]'))b.addEventListener('click',()=>{pondBuildMode=false;aquariumOptions.hidden=true;});
$('build-place').onclick=()=>pondBuildMode?adventureAction({action:'pond-build',surface:pendingBuildSurface,size:aquariumSelect.value,position:[buildPosition[0],0,buildPosition[2]]}):oldBuildPlace();

const waterFeatures=new Map(),pondFish=new Map(),weaponDropMeshes=new Map(),fishTextures=new Map(),fishingRods=new Map();let adventureRevision=-1;
function disposeAdventure(group){scene.remove(group);group.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});}
function waterFeature(data,pond){
 if(pond)return aquariumFeature(data);
 const group=new THREE.Group();group.position.fromArray(data.position);group.name=pond?'Moonstone pond':'Excavated fishing hole';
 const radius=data.radius,depth=pond?.5:(data.depth||1),darkness=Math.min(1,Math.log2(depth+1)/Math.log2(29)),crimson=data.water==='crimson';group.userData.depth=depth;group.userData.crimson=crimson;
 if(pond){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.16,8,64),new THREE.MeshStandardMaterial({color:'#d0cdc9',roughness:.8}));ring.rotation.x=-Math.PI/2;ring.position.y=.22;group.add(ring);}
 const basin=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius*.72,depth,48,1,true),new THREE.MeshStandardMaterial({color:crimson?'#251522':'#172c31',roughness:.92,side:THREE.DoubleSide}));basin.position.y=pond?0:-depth/2;group.add(basin);
 const water=new THREE.Mesh(new THREE.CircleGeometry(radius-.025,64),new THREE.ShaderMaterial({uniforms:{time:{value:0},depthShade:{value:pond?.15:darkness},crimson:{value:crimson?1:0}},vertexShader:'varying vec2 uvp;void main(){uvp=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec2 uvp;uniform float time;uniform float depthShade;uniform float crimson;void main(){vec2 p=uvp*2.-1.;float r=length(p);float waves=sin(r*36.-time*2.)*.5+.5;float caustic=pow(.5+.5*sin(p.x*27.+sin(p.y*19.+time)),10.);vec3 shallow=mix(vec3(.055,.29,.3),vec3(.22,.65,.57),1.-r*.6);vec3 deep=mix(vec3(.006,.012,.028),vec3(.022,.052,.1),1.-r*.6);vec3 red=mix(vec3(.065,.003,.026),vec3(.43,.018,.09),1.-r*.7);vec3 c=mix(mix(shallow,deep,depthShade),red,crimson);c+=mix(vec3(.12,.2,.18),vec3(.5,.06,.13),crimson)*(waves*.06+caustic*.13)*(1.-depthShade*.65);gl_FragColor=vec4(c,1.);}`,side:THREE.DoubleSide}));water.rotation.x=-Math.PI/2;water.position.y=pond?.2:-.24;group.add(water);group.userData.water=water;
 if(pond)for(let i=0;i<12;i++){const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.19,0),new THREE.MeshStandardMaterial({color:i%2?'#b8b9ae':'#839a8e',roughness:.9}));const a=i*Math.PI*2/12;rock.position.set(Math.cos(a)*radius,.28,Math.sin(a)*radius);rock.scale.set(1.5,.7,1);group.add(rock);}scene.add(group);return group;
}
function fishTexture(species){if(!fishTextures.has(species.id)){const texture=new THREE.TextureLoader().load(fishDataURL(species));texture.colorSpace=THREE.SRGBColorSpace;fishTextures.set(species.id,texture);}return fishTextures.get(species.id);}
function swimmingFish(fish){const spec=fishById(fish.species);if(spec.eldritch){const group=createWorldFishModel(THREE,spec);group.userData.seed=spec.index*.61;group.userData.giant=true;scene.add(group);return group;}const group=new THREE.Group(),geo=new THREE.PlaneGeometry(1.3,1,16,4);const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:fishTexture(spec),transparent:true,alphaTest:.03,side:THREE.DoubleSide,depthWrite:false}));group.add(mesh);group.userData.mesh=mesh;group.userData.seed=spec.index*.61;group.userData.base=geo.attributes.position.array.slice();scene.add(group);return group;}
function syncAdventure(){
 const f=fstate();syncFishingPoses(f);if(f.revision!==adventureRevision){adventureRevision=f.revision;const ids=new Set([...f.holes,...f.ponds].map(x=>x.id));for(const [id,m] of waterFeatures)if(!ids.has(id)){disposeAdventure(m);waterFeatures.delete(id);}for(const x of [...f.holes,...f.ponds])if(!waterFeatures.has(x.id))waterFeatures.set(x.id,waterFeature(x,!!x.fish));
  const fishIds=new Set();for(const p of f.ponds)for(const fish of p.fish){fishIds.add(fish.id);let m=pondFish.get(fish.id);if(!m){m=swimmingFish(fish);const owner=fish.owner===selectedCharacter?charRoot:[...remotePlayers.values()].find(r=>r.character===fish.owner)?.root;if(owner&&owner.position.distanceTo(new THREE.Vector3(...p.position))<9){m.userData.throwStart=owner.position.clone().add(new THREE.Vector3(0,1.1,0));m.userData.throwAge=0;}pondFish.set(fish.id,m);}m.userData.pond=p;}for(const [id,m] of pondFish)if(!fishIds.has(id)){m.userData.giant?(scene.remove(m),disposeFishModel(m)):disposeAdventure(m);pondFish.delete(id);}updateGroundHoles(f.holes);
 }
 const drops=gameView.weaponDrops||[],ids=new Set(drops.map(d=>d.id));for(const [id,m] of weaponDropMeshes)if(!ids.has(id)){disposeAdventure(m);weaponDropMeshes.delete(id);}for(const d of drops)if(!weaponDropMeshes.has(d.id)){const g=new THREE.Group(),gem=new THREE.Mesh(new THREE.OctahedronGeometry(.28),new THREE.MeshStandardMaterial({color:'#d1b2ff',emissive:'#946bd9',emissiveIntensity:.65,metalness:.6,roughness:.2}));g.add(gem);const ring=new THREE.Mesh(new THREE.TorusGeometry(.5,.025,8,48),glowMaterial('#efccff',.7));ring.rotation.x=-Math.PI/2;g.add(ring);g.position.fromArray(d.position);g.position.y+=1;scene.add(g);weaponDropMeshes.set(d.id,g);}renderFishing();
}
const pickupButton=document.createElement('button');pickupButton.id='weapon-pickup';pickupButton.hidden=true;pickupButton.textContent='PICK UP WEAPON';document.body.append(pickupButton);pickupButton.onclick=()=>{const d=(gameView.weaponDrops||[]).find(d=>distanceTo(d.position)<4);if(d)adventureAction({action:'weapon-pickup',id:d.id});};
const holeUniform={value:Array.from({length:40},()=>new THREE.Vector3(10000,10000,0))},holeCount={value:0};let groundPatched=false;
function updateGroundHoles(holes){if(!groundPatched){const ground=scene.children.find(o=>o.isMesh&&o.geometry?.type==='CircleGeometry'&&o.geometry.parameters.radius===500);if(ground){groundPatched=true;ground.material.onBeforeCompile=shader=>{shader.uniforms.gardenHoles=holeUniform;shader.uniforms.gardenHoleCount=holeCount;shader.vertexShader='varying vec3 gardenWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngardenWorld=(modelMatrix*vec4(position,1.0)).xyz;');shader.fragmentShader='varying vec3 gardenWorld;uniform vec3 gardenHoles[40];uniform int gardenHoleCount;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nfor(int h=0;h<40;h++){if(h>=gardenHoleCount)break;vec2 delta=gardenWorld.xz-gardenHoles[h].xy;if(dot(delta,delta)<gardenHoles[h].z*gardenHoles[h].z)discard;}');};ground.material.needsUpdate=true;}}holeCount.value=Math.min(40,holes.length);holes.slice(0,40).forEach((h,i)=>holeUniform.value[i].set(h.position[0],h.position[2],h.radius-.03));}
function updateAdventure(dt){
 if(!admitted)return;updateFishingPresentation(dt);const f=fstate(),s=f.sessions?.[selectedCharacter];document.body.dataset.fishingActive=String(!!fishingPoseFor(selectedCharacter));
 if(fishingHUDActive){
  if(!['waiting','fight'].includes(s?.stage)&&performance.now()-holeRefreshAt>250){holeRefreshAt=performance.now();const target=chooseFishingHole(f.holes,charRoot.position.toArray(),manualHole);if(target?.id!==manualHole)manualHole=null;selectedHole=target?.id||null;if($('hole-select')){$('hole-select').value=selectedHole||'';for(const o of $('hole-select').options){const h=f.holes.find(h=>h.id===o.value);if(h)o.textContent='HOLE '+(f.holes.indexOf(h)+1)+' · '+Math.round(distanceTo(h.position))+'m · '+h.depth+'m deep';}}}
  const waiting=s?.stage==='waiting',fight=s?.stage==='fight',biting=waiting&&Date.now()>=s.biteAt&&Date.now()<=s.biteAt+s.hookWindow;
  $('bite-status').textContent=biting?'BITE! HOLD HOOK':waiting?'Waiting for a bite…':fight?(s.tension>.7?'RELEASE · ease the line':'HOLD · bring it closer'):s?.stage==='escaped'?s.result:s?.stage==='caught'?'Catch landed!':(selectedHole?'HOLE '+(f.holes.findIndex(h=>h.id===selectedHole)+1)+' · ready to CAST':'Move closer to a hole · within 6 m');
  $('line-tension').value=s?.tension||0;$('catch-progress').value=s?.progress||0;
  $('cast-line').disabled=waiting||fight||!selectedHole;$('dig-hole').disabled=waiting||fight;$('hole-select').disabled=waiting||fight;
  const holdingHook=hookPointerId!==null&&hookButton.hasPointerCapture(hookPointerId);hookButton.hidden=!biting&&!(fight&&holdingHook);hookButton.textContent=fight?'RELEASE':'HOOK';reelButton.hidden=!fight||holdingHook;reelButton.textContent=reelHeld?'RELEASE':'HOLD';
  // Keep the hook beside the avatar, away from the bottom movement controls.
  const point=charRoot.position.clone().add(new THREE.Vector3(.9,1.7,0)).project(camera),w=innerWidth,h=innerHeight;
  const action=$('world-fishing-action');action.hidden=!(biting||fight)||catchViewerOpen;
  action.style.left=Math.max(h<500?100:12,Math.min(w-(h<500?210:132),(point.x*.5+.5)*w+22))+'px';
  action.style.top=Math.max(170,Math.min(h-240,(-point.y*.5+.5)*h))+'px';
 }

 for(const m of waterFeatures.values())m.userData.water.material.uniforms.time.value=globalTime;
 for(const m of pondFish.values()){
  const p=m.userData.pond,seed=m.userData.seed,d=p.size||[6,2.1,4];m.visible=distanceTo(p.position)<Math.max(40,Math.hypot(d[0],d[2])+15);if(!m.visible)continue;
  const a=globalTime*(m.userData.giant?.055:.16)+seed,r=.45+(seed%1)*.4,body=m.userData.dimensions||[1.3,1,.5],margin=m.userData.giant?Math.hypot(body[0],body[2])/2+.3:.65;
  m.position.set(p.position[0]+Math.cos(a)*Math.max(0,d[0]/2-margin)*r,body[1]/2+.25+Math.max(0,d[1]*.78-body[1]-.25)*(.35+(seed%1)*.3),p.position[2]+Math.sin(a)*Math.max(0,d[2]/2-margin)*r);
  if(m.userData.throwStart&&!m.userData.giant){m.userData.throwAge+=dt;const t=Math.min(1,m.userData.throwAge/.9);m.position.lerpVectors(m.userData.throwStart,m.position,t);m.position.y+=Math.sin(t*Math.PI)*1.4;if(t===1)delete m.userData.throwStart;}
  m.rotation.y=-a+Math.PI/2;
  if(m.userData.giant){animateFishModel(m,globalTime*.6);continue;}
  const attr=m.userData.mesh.geometry.attributes.position,base=m.userData.base;for(let i=0;i<attr.count;i++){const x=base[i*3];attr.setY(i,base[i*3+1]+Math.sin(globalTime*5+x*7+seed)*Math.max(0,-x+.1)*.12);}attr.needsUpdate=true;
 }

 for(const m of weaponDropMeshes.values()){m.children[0].rotation.y+=dt;m.children[0].position.y=Math.sin(globalTime*2)*.12;}
 const nearDrop=(gameView.weaponDrops||[]).find(d=>distanceTo(d.position)<4);if(nearDrop)pickupButton.textContent='PICK UP · '+(equipmentById(nearDrop.choices?.[selectedCharacter])?.name||'50 coins');
 pickupButton.hidden=phase!==PHASE.EXPLORE||document.body.dataset.panel!=='none'||!(gameView.weaponDrops||[]).some(d=>distanceTo(d.position)<4&&Math.abs(charRoot.position.y-d.position[1])<3);
}
function updateFishingRods(f){
 const players=[{character:selectedCharacter,model:charModel},...[...remotePlayers.values()]],active=new Set();
 for(const p of players){const pose=fishingPoseFor(p.character),session=pose?.session,hole=f.holes.find(h=>h.id===session?.hole);if(!p.model||!hole||!pose)continue;const hand=rightHand(p.model);if(!hand)continue;active.add(p.character);let g=fishingRods.get(p.character);
  if(!g){g=new THREE.Group();const rod=new THREE.Mesh(new THREE.CylinderGeometry(.008,.025,2.4,10,24),new THREE.MeshStandardMaterial({color:'#6d7697',metalness:.6,roughness:.3}));rod.position.y=1.1;g.add(rod);g.userData.rod=rod;g.userData.base=rod.geometry.attributes.position.array.slice();
   const grip=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.35,12),new THREE.MeshStandardMaterial({color:'#342b3d',roughness:.8}));g.add(grip);
   const reel=new THREE.Mesh(new THREE.TorusGeometry(.09,.025,8,20),new THREE.MeshStandardMaterial({color:'#d4c4a0',metalness:.7,roughness:.3}));reel.position.y=.12;g.add(reel);g.userData.reel=reel;
   const lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(25*3),3));const line=new THREE.Line(lineGeo,new THREE.LineBasicMaterial({color:'#e6f5ee',transparent:true,opacity:.7}));line.frustumCulled=false;scene.add(g,line);const bobber=new THREE.Mesh(new THREE.SphereGeometry(.06,12,8),new THREE.MeshStandardMaterial({color:'#ffad9a',emissive:'#8d3930',emissiveIntensity:.2}));scene.add(bobber);g.userData.bobber=bobber;g.userData.line=line;fishingRods.set(p.character,g);}
  const fight=session.stage==='fight',landing=session.stage==='caught',bite=session.stage==='waiting'&&Date.now()>=session.biteAt,shake=bite||fight,osc=Math.sin(globalTime*(bite?24:13)),lift=landing?Math.sin(Math.min(1,pose.age/1.6)*Math.PI):0,bend=fight?.16+(session.tension||0)*.5:bite?.2:.04;
  p.model.updateMatrixWorld(true);hand.getWorldPosition(g.position);const end=new THREE.Vector3(...hole.position);end.y=-.15+(bite?osc*.13:Math.sin(globalTime*3)*.02);if(fight){end.x+=Math.sin(globalTime*5)*.28;end.z+=Math.cos(globalTime*4)*.22;}
  if(landing){const from=end.clone(),t=Math.min(1,pose.age/1.3);end.lerpVectors(from,g.position.clone().add(new THREE.Vector3(0,.5,0)),t);end.y+=Math.sin(t*Math.PI)*1.5;}
  g.userData.bobber.position.copy(end);g.userData.bobber.visible=!landing;
  const toward=new THREE.Vector3(hole.position[0]-g.position.x,1.6+(shake?osc*.32:0)+lift*5,hole.position[2]-g.position.z).normalize();g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),toward);
  const rodAttr=g.userData.rod.geometry.attributes.position,base=g.userData.base;for(let i=0;i<rodAttr.count;i++){const t=(base[i*3+1]+1.2)/2.4;rodAttr.setZ(i,base[i*3+2]+t*t*bend);}rodAttr.needsUpdate=true;g.userData.reel.rotation.y=fight&&session.reeling?globalTime*14:0;
  g.updateMatrixWorld(true);const tip=g.localToWorld(new THREE.Vector3(0,2.3,bend)),attr=g.userData.line.geometry.attributes.position;for(let i=0;i<25;i++){const t=i/24;attr.setXYZ(i,THREE.MathUtils.lerp(tip.x,end.x,t),THREE.MathUtils.lerp(tip.y,end.y,t)-Math.sin(t*Math.PI)*(fight?.035:.18),THREE.MathUtils.lerp(tip.z,end.z,t));}attr.needsUpdate=true;
 }
 for(const [id,g] of fishingRods)if(!active.has(id)){disposeAdventure(g.userData.line);disposeAdventure(g.userData.bobber);disposeAdventure(g);fishingRods.delete(id);}
}

// Shared structural damage: shader cracks preserve user-painted skins and atlas UVs.
const seenDestructions=new Set(),constructionBursts=[];
function damageMaterial(mesh){
 const mat=mesh.material;if(!mat?.isMeshStandardMaterial&&!mat?.isMeshPhongMaterial)return null;
 if(mat.userData.structuralDamage)return mat.userData.structuralDamage;
 const uniforms={amount:{value:0},flash:{value:0}};mat.userData.structuralDamage=uniforms;
 const previous=mat.onBeforeCompile;mat.onBeforeCompile=shader=>{previous.call(mat,shader);shader.uniforms.buildCracks=uniforms.amount;shader.uniforms.buildFlash=uniforms.flash;
 shader.vertexShader='varying vec3 fracturePosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfracturePosition=position;');
 shader.fragmentShader='varying vec3 fracturePosition;uniform float buildCracks,buildFlash;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float crack=0.,edge=0.;vec3 p=fracturePosition;
 for(int i=0;i<10;i++){float k=float(i);if(k>=buildCracks)break;
  vec3 axis=normalize(vec3(sin(k*2.7+.5),cos(k*1.7+.4),sin(k*4.1+1.)));
  float q=dot(p,axis)+sin(dot(p,axis.zxy)*9.+k)*.035+sin(dot(p,axis.yzx)*23.+k)*.018-(k-2.)*.17;
  float width=.009+.002*buildCracks,aa=max(.001,fwidth(q));crack=max(crack,1.-smoothstep(width,width+aa,abs(q)));edge=max(edge,1.-smoothstep(width*2.,width*2.+aa,abs(q)));
 }
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.88,.96,1.),edge*.6);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.045,.028,.06),crack*.9);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.79,.87),buildFlash*.85);
 diffuseColor.a=max(diffuseColor.a,crack*.85);
 `).replace('#include <opaque_fragment>', 'outgoingLight=mix(outgoingLight,vec3(.006,.009,.015),crack*.98);outgoingLight=mix(outgoingLight,vec3(1.,.45,.6),buildFlash*.65);\n#include <opaque_fragment>');};mat.customProgramCacheKey=()=> 'structural-fractures-v1';mat.needsUpdate=true;return uniforms;
}
function syncDestructionEvents(){
 for(const event of gameView.destructions||[]){if(seenDestructions.has(event.id))continue;seenDestructions.add(event.id);if(Date.now()-event.time>5000)continue;
  if(constructionBursts.length>=6)disposeConstructionBurst(constructionBursts.shift());
  const group=new THREE.Group(),count=event.kind==='pond'?420:90,positions=[],velocities=[];
  let seed=event.id.split('').reduce((a,c)=>a+c.charCodeAt(0),1);const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const [w,h,d]=event.size;for(let i=0;i<count;i++){const a=random()*Math.PI*2,r=random(),height=random()*h;positions.push(Math.cos(a)*w*.45*r,height,Math.sin(a)*d*.45*r);velocities.push(Math.cos(a)*(1.5+random()*4),1+random()*4,Math.sin(a)*(1.5+random()*4));}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('velocity',new THREE.Float32BufferAttribute(velocities,3));
  const mat=new THREE.ShaderMaterial({uniforms:{age:{value:0},tint:{value:new THREE.Color(event.kind==='pond'?'#9be9ff':event.color)}},transparent:true,depthWrite:false,vertexShader:`attribute vec3 velocity;uniform float age;varying float opacity;void main(){vec3 p=position+velocity*age;p.y=max(.025,p.y-3.8*age*age);vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp(160./max(1.,-v.z),2.,12.);opacity=max(0.,1.-age/2.6);}`,fragmentShader:`uniform vec3 tint;varying float opacity;void main(){vec2 p=gl_PointCoord-.5;float a=1.-smoothstep(.18,.5,length(p*vec2(1.6,1.)));gl_FragColor=vec4(tint,a*opacity*.85);}`});const points=new THREE.Points(geo,mat);points.frustumCulled=false;group.add(points);group.position.fromArray(event.position);scene.add(group);
  const escaping=[];if(event.kind==='pond')for(const [id,fish] of pondFish)if(fish.userData.pond?.id===event.id){pondFish.delete(id);escaping.push({fish,start:fish.position.clone(),scale:fish.scale.clone(),direction:new THREE.Vector3(Math.sin(fish.userData.seed)*3,0,Math.cos(fish.userData.seed)*3)});}
  constructionBursts.push({group,mat,age:0,escaping});
 }while(seenDestructions.size>128)seenDestructions.delete(seenDestructions.values().next().value);
}
function disposeConstructionBurst(b){disposeAdventure(b.group);for(const {fish} of b.escaping){scene.remove(fish);fish.userData.giant?disposeFishModel(fish):disposeAdventure(fish);}}
function updateConstructionDamage(dt){
 for(const [rows,map,pond] of [[gameView.blocks||[],buildMeshes,false],[fstate().ponds,waterFeatures,true]])for(const row of rows){const object=map.get(row.id);if(!object)continue;
  const elapsed=(Date.now()-(row.lastHit||0))/1000,flash=Math.max(0,1-elapsed/.32),shake=flash*Math.sin(elapsed*70)*.035;
  if(!object.userData.damageUniforms){const uniforms=[];object.traverse(o=>{const u=damageMaterial(o);if(u)uniforms.push(u);});object.userData.damageUniforms=uniforms;}
  for(const u of object.userData.damageUniforms){u.amount.value=row.hits||0;u.flash.value=flash;}
  object.position.x=row.position[0]+shake;object.position.z=row.position[2]-shake*.6;object.rotation.z=shake*.3;
 }
 for(let i=constructionBursts.length-1;i>=0;i--){const b=constructionBursts[i];b.age+=dt;b.mat.uniforms.age.value=b.age;
  for(const item of b.escaping){const {fish,start,scale,direction}=item;fish.position.copy(start).addScaledVector(direction,b.age);fish.position.y=Math.max(.1,start.y-b.age*b.age*2);fish.scale.copy(scale).multiplyScalar(Math.max(.01,1-Math.max(0,b.age-1)/1.6));fish.rotation.z=Math.sin(b.age*5)*.2;if(fish.userData.giant)animateFishModel(fish,globalTime);}
  if(b.age>=2.6){disposeConstructionBurst(b);constructionBursts.splice(i,1);}
 }
}
