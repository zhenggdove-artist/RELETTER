// Runs inside the original game's module, sharing its scene and plant lifecycle.
import {createFusionEcho,updateFusionEcho,disposeFusionEcho} from './fusion-effects.js';
import {AFFIXES,affixById,activeWeapon,activeHead,resolveItem,FAMILY_TRAITS} from './combat-traits.js';
import {playerStats} from './progression.js';
import {createUltimate,updateUltimate,disposeUltimate,prepareUltimates} from './ultimate-effects.js';
import {blockSize as footprint} from './build-shapes.js';
import {sampleMeleePose,meleeDuration,meleeFamilies,meleeTrailPattern,meleeMoveNames} from './melee-motion.js';
import {createWeaponSignature,updateWeaponSignature,disposeWeaponSignature} from './weapon-effects.js';
import {EQUIPMENT,DEFAULT_WEAPON,equipmentById,attackStats} from './equipment-catalog.js';
let pondBuildMode=false,fishingPanelOpen=false, imageViewerOpen=false,catchViewerOpen=false;
let selectedCharacter='Ely', admitted=false, selfId=null, connected=false, onlineSocket=null;
let draftMedia={drawing:null,image:null,audio:null,video:null}, plantingMedia=null,replyParentId=null;
const connectionId=crypto.randomUUID();
const remotePlayers=new Map();
let resolveEntryGate;
const entryGate=new Promise(r=>resolveEntryGate=r);
const $=id=>document.getElementById(id);
async function api(path,body,method='POST'){
  let res;
  try{res=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}catch{throw new Error('Unable to connect to RELETTER. Please try again.');}
  if(!res.headers.get('content-type')?.includes('application/json')){
    if(location.hostname.endsWith('.github.io'))throw new Error('The RELETTER backend is unavailable. Please open the game server URL.');
    throw new Error('The RELETTER server is unavailable. Please try again later.');
  }
  let data;try{data=await res.json();}catch{throw new Error('Unexpected server response. Please try again.');}
  if(!res.ok)throw new Error(data?.error||'Connection failed');return data;
}
function message(text){$('connection').textContent=text;}
$('login-form').onsubmit=async e=>{
  e.preventDefault();$('gate-error').textContent='';
  try{await api('/api/login',{password:$('password').value});$('password').value='';$('login-form').hidden=true;$('characters').hidden=false;}
  catch(err){$('gate-error').textContent=err.message;}
};
function tintModel(model,character,cloneMaterials=true){
  model.traverse(o=>{
    if(!o.isMesh||!o.material)return;
    const materials=(Array.isArray(o.material)?o.material:[o.material]).map(source=>{
      const material=cloneMaterials?source.clone():source;
      if(character==='Rae'&&!material.userData.reletterPurple){
        // The GLB uses one atlas for turquoise body, peach skin and facial details.
        // Recolour only cool turquoise texels, preserving the other atlas regions.
        material.color?.set('#ffffff');
        material.onBeforeCompile=shader=>{
          shader.uniforms.reletterPurple={value:new THREE.Color('#8b65c5')};
          shader.fragmentShader='uniform vec3 reletterPurple;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
            vec3 reletterSource = diffuseColor.rgb;
            float reletterCool = smoothstep(0.02, 0.12, min(reletterSource.g, reletterSource.b) - reletterSource.r);
            reletterCool *= smoothstep(0.2, 0.5, reletterSource.b / max(reletterSource.g, 0.0001));
            float reletterTextureShade = clamp(dot(reletterSource, vec3(0.2126, 0.7152, 0.0722)) / 0.65, 0.65, 1.25);
            diffuseColor.rgb = mix(reletterSource, reletterPurple * reletterTextureShade, reletterCool);
          `);
        };
        material.customProgramCacheKey=()=>'reletter-rae-palette-v1';
        material.userData.reletterPurple=true;material.needsUpdate=true;
      }
      return material;
    });
    o.material=materials.length===1?materials[0]:materials;
  });
}
function makeName(name){const c=document.createElement('canvas');c.width=256;c.height=80;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.shadowColor='#493554';ctx.shadowBlur=8;ctx.fillText(name,128,56);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false}));s.scale.set(1.4,.45,1);s.position.y=-.35;return s;}
const localName=makeName('Ely');charRoot.add(localName);
let tinted=false, originalCharacterTemplate=null;
function updateOnline(dt){
  if(admitted&&charModel&&!tinted){
    originalCharacterTemplate=SkeletonUtils.clone(charModel);
    tintModel(originalCharacterTemplate,'Ely');
    if(selectedCharacter==='Rae')tintModel(charModel,'Rae',false);
    localName.material.map.dispose();localName.material.dispose();charRoot.remove(localName);charRoot.add(makeName(selectedCharacter));tinted=true;
  }
  updateWater(dt);updateGardenWorld(dt);
  for(const p of remotePlayers.values()){
    if(!p.model&&originalCharacterTemplate){p.model=SkeletonUtils.clone(originalCharacterTemplate);tintModel(p.model,p.character);p.root.add(p.model);p.mixer=new THREE.AnimationMixer(p.model);p.action=null;}
    if(!p.state)continue;
    const target=new THREE.Vector3(...p.state.position);p.root.position.lerp(target,Math.min(1,dt*12));if(p.model)p.model.rotation.set(0,p.state.rotation,0);p.root.visible=p.state.visible;
    if(p.previous&&target.distanceTo(p.previous)>.02)p.movingUntil=performance.now()+180;const moving=performance.now()<(p.movingUntil||0);p.previous=target;
    const clip=p.state.phase===PHASE.DRINK?clipDrink:p.state.phase===PHASE.FALL?clipFall:moving?clipWalk:clipIdle;
    if(clip&&p.mixer&&p.clip!==clip){p.action?.fadeOut(.2);p.action=p.mixer.clipAction(clip);p.action.reset().fadeIn(.2).play();p.clip=clip;}p.mixer?.update(dt);
  }
  updatePlayerHitFeedback(dt);
}
function updateRoster(players){
  const ids=new Set(players.filter(p=>p.id!==selfId).map(p=>p.id));
  for(const [id,p] of remotePlayers)if(!ids.has(id)){scene.remove(p.root);p.root.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});remotePlayers.delete(id);}
  for(const p of players)if(p.id!==selfId){if(!remotePlayers.has(p.id)){const root=new THREE.Group();root.visible=false;root.add(makeName(p.character));scene.add(root);remotePlayers.set(p.id,{root,character:p.character});}remotePlayers.get(p.id).state=p.state;}
  message(players.length===2?'2 / 2 online · Enter to chat':'1 / 2 online · Waiting for a friend');
}
function receive(type,data){
  if(type==='welcome'){selfId=data.id;connected=true;refreshWorld();updateRoster(data.players);api('/api/chat',undefined,'GET').then(history=>{history.forEach(appendChat);latestChat();}).catch(e=>message(e.message));if(admitted)loadEntries().then(es=>es.forEach(e=>addStoredPlant(e))).catch(e=>message(e.message));}
  if(type==='players')updateRoster(data);
  if(type==='state'&&data.id!==selfId&&remotePlayers.has(data.id))remotePlayers.get(data.id).state=data.state;
  if(type==='plant'&&data.sender!==selfId)addStoredPlant(data,true);
  if(type==='deleted'){const i=plantEntries.findIndex(p=>p.entryId===data.id);if(i>=0){plantRoot.remove(plantEntries[i].mesh);plantEntries.splice(i,1);hidePlantLabel();}}
  if(type==='summons')gameView.tokenSummons=data;if(type==='milk')gameView.milkEncounter=acceptMilk(gameView.milkEncounter,data);if(type==='boss'){const old=gameView.boss;gameView.boss=acceptBossSnapshot(old,data);receiveBoss(old,gameView.boss);}if(type==='chat')appendChat(data);if(type==='game')receiveGame(data);if(type==='water')showWater(data);
}
let connectionPromise=null,reconnectTimer=null,pageSuspended=false;
function queueReconnect(){clearTimeout(reconnectTimer);if(admitted&&!pageSuspended)reconnectTimer=setTimeout(()=>openCloudConnection(selectedCharacter).catch(e=>{message(e.message);queueReconnect();}),2000);}
window.addEventListener('online',queueReconnect);
async function openConnection(character){
  if(window.RELETTER_TRANSPORT==='websocket')return openCloudConnection(character);
  const res=await fetch('/api/events?character='+character+'&connectionId='+encodeURIComponent(connectionId));
  if(!res.ok){const e=await res.json();throw new Error(e.error);}
  const reader=res.body.getReader(),decoder=new TextDecoder();
  (async()=>{let buffer='';try{while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n\n'))>=0){const chunk=buffer.slice(0,end);buffer=buffer.slice(end+2);const event=chunk.match(/event: (.+)/),data=chunk.match(/data: (.+)/);if(event&&data)receive(event[1],JSON.parse(data[1]));}}}catch{}finally{connected=false;message('Disconnected · Reconnecting');if(admitted)setTimeout(()=>openConnection(selectedCharacter).catch(()=>message('Unable to reconnect. Please refresh.')),2500);}})();
}
function openCloudConnection(character){
  if(connectionPromise)return connectionPromise;
  connectionPromise=(async()=>{
    const players=await api('/api/players',undefined,'GET');
    if(players.some(p=>p.character===character&&!p.self))throw new Error('This character is online. Choose the other character, or wait 35 seconds for an inactive session to clear.');
    return new Promise((resolve,reject)=>{
    const url=new URL('/api/socket',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.searchParams.set('character',character);url.searchParams.set('connectionId',connectionId);
    const socket=new WebSocket(url);let joined=false,heartbeat;
    const timeout=setTimeout(()=>{if(!joined){socket.close();reject(new Error('Connection timed out. Please try again.'));}},12000);
    socket.onmessage=e=>{
      if(e.data==='pong'){socket.lastPong=Date.now();return;}
      const message=JSON.parse(e.data);receive(message.type,message.data);
      if(message.type==='welcome'){joined=true;clearTimeout(timeout);onlineSocket=socket;lastOnlineState='';socket.lastPong=Date.now();heartbeat=setInterval(()=>{if(Date.now()-socket.lastPong>25000){socket.close();return;}if(socket.readyState===1)socket.send('ping');},10000);resolve();}
    };
    socket.onerror=()=>{if(!joined){clearTimeout(timeout);reject(new Error('Unable to connect. Check your connection, or try the other character if it is already online.'));}};
    socket.onclose=event=>{if(event.reason==='Joined from another tab'){pageSuspended=true;message('Opened in another tab');}clearTimeout(timeout);clearInterval(heartbeat);if(onlineSocket===socket){onlineSocket=null;connected=false;message('Disconnected · Reconnecting');queueReconnect();}if(!joined)reject(new Error('Unable to join. Sign in again or choose the other character.'));};
  });})();connectionPromise.finally(()=>{connectionPromise=null;}).catch(()=>{});return connectionPromise;
}
for(const btn of document.querySelectorAll('[data-character]'))btn.onclick=async()=>{
  document.querySelectorAll('[data-character]').forEach(b=>b.disabled=true);$('gate-error').textContent='';
  try{await ultimateWarmup;await openConnection(btn.dataset.character);selectedCharacter=btn.dataset.character;receiveGame(gameView);admitted=true;refreshProgression();dock.hidden=false;$('chat-open').hidden=false;$('water-gun').hidden=false;$('chat-minimize').hidden=false;charRoot.position.x=selectedCharacter==='Ely'?-1.5:1.5;$('entry-gate').remove();$('username').value=selectedCharacter;resolveEntryGate();}
  catch(e){$('gate-error').textContent=e.message;document.querySelectorAll('[data-character]').forEach(b=>b.disabled=false);}
};
function suspendConnection(){if(!admitted)return;pageSuspended=true;clearTimeout(reconnectTimer);const socket=onlineSocket;onlineSocket=null;connected=false;socket?.close(1000,'Page hidden');fetch('/api/disconnect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({connectionId}),keepalive:true}).catch(()=>{});}
window.addEventListener('pagehide',suspendConnection);
document.addEventListener('visibilitychange',()=>{if(window.RELETTER_TRANSPORT!=='websocket')return;if(document.hidden)suspendConnection();else if(admitted){pageSuspended=false;openCloudConnection(selectedCharacter).catch(e=>{message(e.message);queueReconnect();});}});
let lastOnlineState='';
setInterval(()=>{
  if(!connected||!admitted)return;
  const state={position:charRoot.position.toArray(),rotation:gameplayHeading(charModel),visible:charRoot.visible,phase,paused:monstersPausedForGarden()||buildPanelOpen};
  if(onlineSocket?.readyState===1){const serialized=JSON.stringify(state);if(serialized!==lastOnlineState||(gameView.boss?.hp>0)||gameView.milkEncounter?.phase==='active'||(gameView.milkEncounter?.phase==='cooldown'&&Date.now()>=gameView.milkEncounter.respawnAt)){onlineSocket.send(JSON.stringify({type:'state',data:state}));lastOnlineState=serialized;}}
  else api('/api/state',state).catch(()=>{});
},100);
const draw=$('drawing'),ctx=draw.getContext('2d');let drawing=false,hasDrawing=false;const drawingUndo=[];function saveDrawingStep(){drawingUndo.push({pixels:ctx.getImageData(0,0,draw.width,draw.height),hasDrawing});if(drawingUndo.length>30)drawingUndo.shift();$('undo-drawing').disabled=false;}
let drawingEraser=false;
const drawingTools=document.createElement('div');drawingTools.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:8px 0';drawingTools.innerHTML='<button type="button" id="drawing-pen" aria-pressed="true">PEN</button><button type="button" id="drawing-eraser" aria-pressed="false">ERASER</button>';draw.before(drawingTools);
function setDrawingTool(eraser){drawingEraser=eraser;$('drawing-pen').setAttribute('aria-pressed',String(!eraser));$('drawing-eraser').setAttribute('aria-pressed',String(eraser));$('drawing-pen').style.outline=eraser?'':'2px solid #8865bd';$('drawing-eraser').style.outline=eraser?'2px solid #8865bd':'';draw.style.cursor=eraser?'cell':'crosshair';}
$('drawing-pen').onclick=()=>setDrawingTool(false);$('drawing-eraser').onclick=()=>setDrawingTool(true);setDrawingTool(false);
function finishDrawing(){drawing=false;ctx.globalCompositeOperation='source-over';hasDrawing=ctx.getImageData(0,0,draw.width,draw.height).data.some((v,i)=>i%4===3&&v>0);refreshDraft();}
// True hue/saturation wheel; the brightness slider also provides black and white.
const wheel=document.createElement('canvas');wheel.id='color-wheel';wheel.width=144;wheel.height=144;wheel.setAttribute('aria-label','Brush color wheel');wheel.style.cssText='display:block;width:110px;height:110px;touch-action:none;margin:6px auto;cursor:crosshair';
const brightness=document.createElement('input');brightness.type='range';brightness.min='0';brightness.max='100';brightness.value='100';brightness.setAttribute('aria-label','Brightness');brightness.style.width='100%';
const brightnessLabel=document.createElement('label');brightnessLabel.textContent='Brightness';brightnessLabel.append(brightness);draw.before(wheel,brightnessLabel);
let hue=270,saturation=.5;
function hsv(h,s,v){const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;const rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return rgb.map(n=>Math.round((n+m)*255));}
function paintWheel(){const wc=wheel.getContext('2d'),pixels=wc.createImageData(144,144);for(let y=0;y<144;y++)for(let x=0;x<144;x++){const dx=x-72,dy=y-72,r=Math.hypot(dx,dy)/70;if(r>1)continue;const h=(Math.atan2(dy,dx)*180/Math.PI+360)%360,rgb=hsv(h,r,+brightness.value/100),i=(y*144+x)*4;pixels.data.set([...rgb,255],i);}wc.putImageData(pixels,0,0);}
function selectColor(e){const r=wheel.getBoundingClientRect(),dx=(e.clientX-r.left)*144/r.width-72,dy=(e.clientY-r.top)*144/r.height-72;hue=(Math.atan2(dy,dx)*180/Math.PI+360)%360;saturation=Math.min(1,Math.hypot(dx,dy)/70);$('brush-color').value='#'+hsv(hue,saturation,+brightness.value/100).map(n=>n.toString(16).padStart(2,'0')).join('');e.stopPropagation();}
wheel.onpointerdown=e=>{wheel.setPointerCapture(e.pointerId);selectColor(e);};wheel.onpointermove=e=>{if(e.buttons)selectColor(e);};brightness.oninput=()=>{paintWheel();$('brush-color').value='#'+hsv(hue,saturation,+brightness.value/100).map(n=>n.toString(16).padStart(2,'0')).join('');};paintWheel();
function point(e){const r=draw.getBoundingClientRect();return[(e.clientX-r.left)*draw.width/r.width,(e.clientY-r.top)*draw.height/r.height];}
function refreshDraft(){draftMedia.drawing=hasDrawing?draw.toDataURL('image/png'):null;goBtn.disabled=!(ta.value.trim()||draftMedia.drawing||draftMedia.image||draftMedia.audio||draftMedia.video);}
draw.onpointerdown=e=>{saveDrawingStep();drawing=true;ctx.globalCompositeOperation=drawingEraser?'destination-out':'source-over';draw.setPointerCapture(e.pointerId);ctx.beginPath();ctx.moveTo(...point(e));ctx.lineWidth=+$('brush-size').value;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=$('brush-color').value;ctx.lineTo(...point(e).map(v=>v+.01));ctx.stroke();hasDrawing=true;e.stopPropagation();};
draw.onpointermove=e=>{if(drawing){ctx.lineTo(...point(e));ctx.stroke();}e.stopPropagation();};
draw.onpointerup=finishDrawing;draw.onpointercancel=finishDrawing;
$('undo-drawing').onclick=e=>{e.stopPropagation();const step=drawingUndo.pop();if(step){ctx.putImageData(step.pixels,0,0);hasDrawing=step.hasDrawing;refreshDraft();}$('undo-drawing').disabled=!drawingUndo.length;};
$('clear-drawing').onclick=e=>{e.stopPropagation();saveDrawingStep();ctx.clearRect(0,0,draw.width,draw.height);hasDrawing=false;refreshDraft();};
$('brush-size').oninput=()=>$('brush-value').textContent=$('brush-size').value+' px';
document.querySelector('.upload-button').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();$('upload-image').click();}};
$('upload-image').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){$('media-error').textContent='Choose a PNG, JPG or WebP image under 5 MB.';e.target.value='';return;}
  try{const bitmap=await createImageBitmap(file),c=document.createElement('canvas'),ratio=Math.min(1,1024/Math.max(bitmap.width,bitmap.height));c.width=Math.round(bitmap.width*ratio);c.height=Math.round(bitmap.height*ratio);c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();draftMedia.image=c.toDataURL('image/jpeg',.8);$('image-preview').src=draftMedia.image;$('image-preview').hidden=false;$('upload-name').textContent=file.name;$('media-error').textContent='';refreshDraft();}catch{$('media-error').textContent='Unable to read this image';}
};
$('remove-image').onclick=e=>{e.stopPropagation();draftMedia.image=null;$('image-preview').hidden=true;$('upload-image').value='';$('upload-name').textContent='No image selected';refreshDraft();};
ta.addEventListener('input',refreshDraft);
goBtn.addEventListener('click',()=>{
  if(!admitted)return;
  plantingMedia={...draftMedia,parentId:replyParentId};replyParentId=null;$('reply-draft').hidden=true;
  if(!ta.value.trim())ta.value=draftMedia.drawing?'A drawing':draftMedia.image?'An image':draftMedia.video?'A video':'An audio recording';
  $('username').value=selectedCharacter;
  draftMedia={drawing:null,image:null,audio:null,video:null};drawingUndo.length=0;$('undo-drawing').disabled=true;$('av-preview').replaceChildren();$('av-name').textContent='Audio / video · max 5 MB each';$('upload-av').value='';hasDrawing=false;ctx.clearRect(0,0,draw.width,draw.height);$('image-preview').hidden=true;$('upload-image').value='';$('upload-name').textContent='No image selected';
},true);
function addStoredPlant(e,grow=false){
  if(plantEntries.some(p=>p.entryId===e.id))return;
  const mesh=addPlant(e.text,grow,e.created_at,e.part?.username||'');
  if(mesh){const p=plantEntries[plantEntries.length-1];p.entryId=e.id;p.media=e.part;if(e.part?.position)mesh.position.fromArray(e.part.position);if(e.part?.scale)mesh.scale.fromArray(e.part.scale);mesh.rotation.z=e.part?.rotation||0;mesh.userData.replyTilt=mesh.rotation.z;}if(searchPanel.classList.contains('show'))renderSearchList(searchInput.value);
}
function messageTimestamp(value){if(value==null)return null;const date=new Date(value);if(!Number.isFinite(date.getTime()))return null;const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));const time=document.createElement('time');time.className='message-time';time.dateTime=date.toISOString();time.textContent=`${parts.year} ${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;return time;}
const imageViewer=document.createElement('dialog');imageViewer.id='image-viewer';imageViewer.setAttribute('aria-label','Full screen image — click to close');imageViewer.style.cssText='position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:rgba(8,6,18,.97);overflow:hidden;cursor:zoom-out;';
const fullImage=document.createElement('img');fullImage.style.cssText='width:100%;height:100%;object-fit:contain;display:block';imageViewer.append(fullImage);document.body.append(imageViewer);
let imageReturnFocus;
function openImageViewer(img){imageReturnFocus=img;fullImage.src=img.src;fullImage.alt=img.alt;imageViewerOpen=true;clearTimeout(labelHideTimer);keysDown.clear();imageViewer.showModal();}
function closeImageViewer(){imageViewer.close();imageViewerOpen=false;imageReturnFocus?.focus({preventScroll:true});}
imageViewer.onclick=e=>{e.stopPropagation();closeImageViewer();};imageViewer.oncancel=e=>{e.preventDefault();closeImageViewer();};
window.addEventListener('keydown',e=>{if(catchViewerOpen){e.stopImmediatePropagation();if(['Escape','Enter',' '].includes(e.key)){e.preventDefault();closeCatchViewer();}return;}if(!imageViewerOpen&&e.target.matches?.('#plant-label img')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopImmediatePropagation();openImageViewer(e.target);return;}if(imageViewerOpen){e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();closeImageViewer();}}},true);
function showMedia(entry){
  plantLabel.replaceChildren();const text=document.createElement('div');text.textContent=entry.text+(entry.username?' — '+entry.username:'');plantLabel.append(text);
  for(const key of ['drawing','image'])if(entry.media?.[key]){const img=document.createElement('img');img.src=entry.media[key];img.alt=key==='drawing'?'Drawing':'Uploaded image';img.tabIndex=0;img.style.cursor="zoom-in";img.setAttribute("role","button");img.setAttribute("aria-label","View full screen");img.onclick=e=>{e.stopPropagation();openImageViewer(img);};img.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();openImageViewer(img);}};plantLabel.append(img);}
  for(const kind of ['audio','video'])if(entry.media?.[kind]){const el=document.createElement(kind);el.src=entry.media[kind];el.controls=true;el.preload='metadata';if(kind==='video')el.playsInline=true;plantLabel.append(el);}
  if(entry.entryId){const reply=document.createElement('button');reply.textContent='Reply';reply.onclick=e=>{e.stopPropagation();beginPlantReply(entry);};plantLabel.append(reply);}
  const time=messageTimestamp(entry.ts);if(time)plantLabel.append(time);
}

function beginPlantReply(entry){
 if(!entry.entryId)return;
 replyParentId=entry.entryId;$('reply-draft').hidden=false;$('reply-draft').textContent='Reply to: '+entry.text.slice(0,100);
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel reply';cancel.onclick=e=>{e.stopPropagation();replyParentId=null;$('reply-draft').hidden=true;};$('reply-draft').append(cancel);
 claimPanel('write');
 // A completed planting cinematic must not swallow the next reply submission.
 if(phase===PHASE.DONE){phase=PHASE.EXPLORE;phaseT=0;charRoot.visible=true;if(charModel)charModel.visible=true;}
 ui.classList.remove('mini','hidden');reflectPanels();keysDown.clear();ta.focus();
}
let monsterInteractionWasPaused=false,monsterResumeGraceUntil=0;
function monstersPausedForGarden(){
 const paused=admitted&&(document.getElementById('updates-dialog')?.open||fishingHUDActive||catchViewerOpen||imageViewerOpen||(typeof fishingPanelOpen!=='undefined'&&fishingPanelOpen)||bagPanelOpen||shopPanelOpen||buildPanelOpen||document.body.dataset.panel==='search'||document.body.dataset.panel==='write'||!!activeLabelEntry);
 if(paused){monsterInteractionWasPaused=true;return true;}
 if(monsterInteractionWasPaused){monsterInteractionWasPaused=false;monsterResumeGraceUntil=performance.now()+1200;}
 return performance.now()<monsterResumeGraceUntil;
}

let hoverPoint=null, hoverAt=0,labelHideTimer=null;
function delayHideLabel(){clearTimeout(labelHideTimer);labelHideTimer=setTimeout(()=>{if(!imageViewerOpen&&!plantLabel.matches(':hover')&&![...plantLabel.querySelectorAll('audio,video')].some(m=>!m.paused))hidePlantLabel();},400);}
plantLabel.addEventListener('pointerenter',()=>clearTimeout(labelHideTimer));
function positionPlantLabel(){
  if(!activeLabelEntry)return;
  const half=plantLabel.offsetWidth/2+8,height=plantLabel.offsetHeight;
  const x=hoverPoint?.x??W()/2,y=hoverPoint?hoverPoint.y+20:H()*.78;
  plantLabel.style.left=Math.max(half,Math.min(W()-half,x))+'px';
  const bottom=matchMedia('(pointer: coarse)').matches?166:16,top=matchMedia('(pointer: coarse)').matches?64:8;plantLabel.style.top=Math.max(top,Math.min(H()-height-bottom,y))+'px';
}
new ResizeObserver(positionPlantLabel).observe(plantLabel);
canvas.addEventListener('pointermove',e=>{
  if(!admitted||fishingHUDActive||ptrs.size||['chat','write','search','shop','build','fishing'].includes(document.body.dataset.panel)||Date.now()-hoverAt<50)return;hoverAt=Date.now();
  hoverPoint={x:e.clientX,y:e.clientY};const rect=canvas.getBoundingClientRect();
  raycaster.setFromCamera({x:(e.clientX-rect.left)/rect.width*2-1,y:-(e.clientY-rect.top)/rect.height*2+1},camera);
  const hits=raycaster.intersectObjects(plantEntries.filter(plantWithinReach).map(p=>p.mesh),true);let entry=null;
  for(const hit of hits){let o=hit.object;while(o&&o.parent!==plantRoot)o=o.parent;entry=plantEntries.find(p=>p.mesh===o);if(entry)break;}
  if(entry){clearTimeout(labelHideTimer);if(activeLabelEntry!==entry)showPlantLabel(entry);positionPlantLabel();}
  else delayHideLabel();
});
canvas.addEventListener('pointerleave',e=>{if(e.pointerType==='touch'||plantLabel.contains(e.relatedTarget))return;hoverPoint=null;delayHideLabel();});
const chatMessages=new Map(),chatLog=$('chat-log'),chatScroll=$('chat-scroll');
function latestChat(){requestAnimationFrame(()=>{chatLog.scrollTop=chatLog.scrollHeight;syncChatScroll();});}
function syncChatScroll(){chatScroll.max=Math.max(0,chatLog.scrollHeight-chatLog.clientHeight);chatScroll.value=chatLog.scrollTop;}
chatLog.onscroll=syncChatScroll;chatScroll.oninput=()=>chatLog.scrollTop=+chatScroll.value;
new ResizeObserver(syncChatScroll).observe(chatLog);
function appendChat(data){if(chatMessages.has(data.id))return;const atBottom=chatLog.scrollHeight-chatLog.clientHeight-chatLog.scrollTop<30;chatMessages.set(data.id,data);const line=document.createElement('div'),name=document.createElement('b');line.dataset.chatId=data.id;name.textContent=data.name+'：';line.append(name,document.createTextNode(data.text));const time=messageTimestamp(data.time);if(time)line.append(time);const next=[...chatLog.children].find(n=>{const m=chatMessages.get(n.dataset.chatId);return m.time>data.time||(m.time===data.time&&m.id>data.id);});chatLog.insertBefore(line,next||null);if(atBottom||data.name===selectedCharacter)latestChat();syncChatScroll();}
let buildPanelOpen=false,shopPanelOpen=false,bagPanelOpen=false;
const chatInput=$('chat-input'),chatForm=$('chat-form');
const dock=document.createElement('nav');dock.id='action-dock';dock.setAttribute('aria-label','Game tools');dock.hidden=true;
const writeOpen=document.createElement('button');writeOpen.id='write-open';writeOpen.type='button';writeOpen.textContent='WRITE';
$('search-btn').textContent='HISTORY';$('search-btn').setAttribute('aria-label','Plant history');searchInput.placeholder='Search messages…';
dock.append($('search-btn'),$('chat-open'),writeOpen);document.body.append(dock);$('game-controls').append($('water-gun'));
const searchHeader=document.createElement('div');searchHeader.id='search-header';const searchClose=document.createElement('button');searchClose.id='search-close';searchClose.type='button';searchClose.textContent='×';searchClose.setAttribute('aria-label','Close search');searchInput.before(searchHeader);searchHeader.append(searchInput,searchClose);searchClose.onclick=()=>{searchInput.blur();claimPanel('none');};
function reflectPanels(){const open=bagPanelOpen?'bag':typeof fishingPanelOpen!=='undefined'&&fishingPanelOpen?'fishing':shopPanelOpen?'shop':buildPanelOpen?'build':!ui.classList.contains('mini')&&!ui.classList.contains('hidden')?'write':searchPanel.classList.contains('show')?'search':$('online-panel').classList.contains('chatting')?'chat':'none';document.body.dataset.panel=open;$('bag-open')?.setAttribute('aria-expanded',String(bagPanelOpen));$('build-open')?.setAttribute('aria-expanded',String(buildPanelOpen));writeOpen.textContent=ui.classList.contains('done-state')?'RETURN':'WRITE';for(const [id,name] of [['search-btn','search'],['chat-open','chat'],['write-open','write']])$(id).setAttribute('aria-expanded',String(open===name));}
function setHistorySmall(small){$('online-panel').classList.toggle('minimized',small);$('chat-minimize').setAttribute('aria-expanded',String(!small));}
function closeChat(){chatForm.hidden=true;chatInput.hidden=true;chatInput.blur();$('online-panel').classList.remove('chatting');setHistorySmall(true);fitKeyboard();reflectPanels();}
function claimPanel(name){
 if(name!=='fishing'&&typeof fishingHUDActive!=='undefined'){fishingHUDActive=false;reelHeld=false;syncFishingHUD();}
 if(name!=='fishing'&&typeof fishingPanelOpen!=='undefined'&&fishingPanelOpen){fishingPanelOpen=false;fishingPanel.hidden=true;reelHeld=false;}
 if(name!=='bag'&&bagPanelOpen){bagPanelOpen=false;bagPanel.hidden=true;bagInspectName=null;bagPanel.dataset.inspect='';bagPanel.querySelector('header b').textContent='BAG';}
 if(name!=='shop'&&shopPanelOpen){shopPanelOpen=false;shopPanel.hidden=true;}
 if(name!=='build'&&buildPanelOpen){stopPaint();buildPanelOpen=false;buildPanel.hidden=true;buildGhost.visible=false;}
 if(name!=='chat')closeChat();
 if(name!=='write')ui.classList.add('mini');
 if(name!=='search'){searchPanel.classList.remove('show');if(phase===PHASE.EXPLORE)showControls(true);}
 if(name!=='plant')hidePlantLabel();pop.classList.remove('show');keysDown.clear();reflectPanels();
}
function openChat(){if(!admitted)return;claimPanel('chat');setHistorySmall(false);$('online-panel').style.removeProperty('height');$('online-panel').classList.add('chatting');chatForm.hidden=false;chatInput.hidden=false;reflectPanels();fitKeyboard();latestChat();requestAnimationFrame(()=>{fitKeyboard();latestChat();});}
async function sendChat(){const text=chatInput.value.trim();if(!text)return;try{const reply=await api('/api/chat',{text});if(reply.command)centerNotice('指令輸入成功');chatInput.value='';latestChat();chatInput.focus();}catch(e){message(e.message);}}
$('chat-open').onclick=()=>{if($('online-panel').classList.contains('chatting'))closeChat();else openChat();};$('chat-close').onclick=closeChat;$('chat-minimize').onclick=closeChat;
$('writer-close').onclick=e=>{e.stopPropagation();ui.classList.add('mini');reflectPanels();};
writeOpen.onclick=()=>{if(!admitted)return;if(!ui.classList.contains('mini')&&!ui.classList.contains('hidden')){ui.classList.add('mini');reflectPanels();return;}claimPanel('write');if(phase===PHASE.DONE){restartToIdleWithFade();}else{ui.classList.remove('mini','hidden');}reflectPanels();};
searchBtn.addEventListener('click',()=>{if(searchPanel.classList.contains('show'))claimPanel('search');reflectPanels();});
// Original cinematics and Reply can also change panel classes: enforce exclusivity before paint.
const panelObserver=new MutationObserver(records=>{for(const r of records){const old=r.oldValue||'',el=r.target;if(el===ui&&!ui.classList.contains('mini')&&!ui.classList.contains('hidden')&&(old.includes('mini')||old.includes('hidden')))claimPanel('write');if(el===searchPanel&&searchPanel.classList.contains('show')&&!old.includes('show'))claimPanel('search');}reflectPanels();});for(const panel of [ui,searchPanel])panelObserver.observe(panel,{attributes:true,attributeFilter:['class'],attributeOldValue:true});
ui.classList.add('mini');setHistorySmall(true);reflectPanels();
chatForm.onsubmit=e=>{e.preventDefault();sendChat();};
// Size chat from the visible controls rather than the generic tool-panel reservation.
function layoutExpandedChat(){
 const panel=$('online-panel');if(!panel.classList.contains('chatting'))return;
 const v=window.visualViewport,top=(v?.offsetTop||0)+8,rect=panel.getBoundingClientRect();
 let bottom=(v?.offsetTop||0)+(v?.height||innerHeight)-8;
 for(const id of ['action-dock','joystick-zone','jump-btn','water-gun']){
  const el=$(id),r=el.getBoundingClientRect(),style=getComputedStyle(el);
  if(!r.width||!r.height||style.visibility==='hidden'||style.display==='none'||el.hidden)continue;
  if(r.right>rect.left&&r.left<rect.right)bottom=Math.min(bottom,r.top-8);
 }
 panel.style.setProperty('--chat-height',Math.max(80,bottom-top)+'px');
}
function fitKeyboard(){const v=window.visualViewport;const active=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');const keyboard=!!v&&active&&innerHeight-v.height>100;document.body.classList.toggle('keyboard-open',keyboard);document.documentElement.style.setProperty('--view-height',(v?.height||innerHeight)+'px');document.documentElement.style.setProperty('--view-top',(v?.offsetTop||0)+'px');layoutExpandedChat();if(keyboard)latestChat();}
window.visualViewport?.addEventListener('resize',fitKeyboard);window.visualViewport?.addEventListener('scroll',fitKeyboard);window.addEventListener('resize',fitKeyboard);document.addEventListener('focusin',fitKeyboard);document.addEventListener('focusout',()=>requestAnimationFrame(fitKeyboard));fitKeyboard();

window.addEventListener('keydown',e=>{
  const typing=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
  if(!admitted){e.stopImmediatePropagation();return;}
  if(e.key==='Enter'&&!e.isComposing){
    if(typing&&e.target!==chatInput){e.stopImmediatePropagation();return;}
    e.preventDefault();e.stopImmediatePropagation();keysDown.clear();
    if(document.activeElement===chatInput)sendChat();else openChat();return;
  }
  if(e.key==='Escape'&&e.target===chatInput)closeChat();
  if(typing){keysDown.clear();e.stopImmediatePropagation();}
},true);
window.addEventListener('blur',()=>keysDown.clear());
window.render_game_to_text=()=>JSON.stringify({mode:admitted?phase:'password-or-character',character:selectedCharacter,progression:currentStats(),health:Math.max(0,currentStats().maxHp-(gameView.hits?.[selectedCharacter]||0)),connected,monstersPaused:monstersPausedForGarden(),playerHitFeedback:Object.fromEntries(playerHitTimers),boss:gameView.boss,milkEncounter:gameView.milkEncounter,redMode:!!gameView.redMode,pkMode:!!gameView.pkMode,ultimates:ultimateEffects.map(f=>({name:f.root.name,age:f.age,range:f.range,radius:f.radius})),fishing:gameView.fishing,catchPresentation:{open:catchViewerOpen,species:catchViewState.species,rotation:catchViewState.model?.rotation.y||0},deaths:gameView.deaths,garden:gameView.garden,wingDrops:gameView.wingDrops,flight:{wings:currentWings()?.id||null,velocity:charVelY},weaponDrops:gameView.weaponDrops,aim:{visible:!aimReticle.hidden,direction:rangedAim().direction.toArray(),point:rangedAim().point.toArray()},melee:meleeEffects.map(f=>({combo:f.combo,age:f.age,strokes:f.strokes.length})),equipment:{effects:equipmentFX.map(f=>({family:f.data.family,age:f.age,range:f.data.range})),open:shopPanelOpen,owned:gameView.inventories?.[selectedCharacter]||[],slots:gameView.equipment?.[selectedCharacter]||{},shields:gameView.shields||{}},build:{revision:gameView.buildRevision,open:buildPanelOpen,preview:buildPosition,selected:selectedBlock,blocks:gameView.blocks||[]},water:{charging:waterChargeStart!==null,charge:waterCharge(),shots:waterEffects.map(f=>({direction:f.direction,range:f.range,radius:f.radius,charge:f.charge,age:f.age,droplets:f.particles.length,red:f.red}))},replyParentId,coins:coinCount,hits:gameView.hits?.[selectedCharacter]||0,loot:gameView.loot||[],players:1+remotePlayers.size,remotePlayers:[...remotePlayers.values()].map(p=>({character:p.character,state:p.state})),coordinateSystem:'Y up, world X/Z horizontal',position:charRoot.position.toArray(),plants:plantEntries.map(p=>({id:p.entryId,text:p.text,username:p.username,drawing:!!p.media?.drawing,image:!!p.media?.image,audio:!!p.media?.audio,video:!!p.media?.video,parentId:p.media?.parentId,position:p.mesh.position.toArray()})),chat:[...$('chat-log').children].map(x=>x.textContent)});
window.advanceTime=ms=>{for(let t=0;t<ms;t+=50)gameStep(Math.min(50,ms-t)/1000,false);composer.render();};
if(['localhost','127.0.0.1'].includes(location.hostname))window.reletter_test={THREE,renderer,performanceState:()=>({skyVersion:skyTex.version,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),showCatch:fish=>openCatchViewer(fish),receiveSnapshot:receive,suspend:suspendConnection,resume:()=>{pageSuspended=false;return openCloudConnection(selectedCharacter);},step:ms=>{for(let t=0;t<ms;t+=16)gameStep(Math.min(16,ms-t)/1000,false);},model:()=>charModel,original:()=>originalCharacterTemplate,remotes:()=>[...remotePlayers.values()],plantWithinReach,showEntry:id=>{const e=plantEntries.find(p=>p.entryId===id);if(e)showPlantLabel(e,true);},explore:(position=[0,0,0])=>{phase=PHASE.EXPLORE;charRoot.visible=true;if(charModel)charModel.visible=true;isJumping=false;charVelY=0;autoWalkPhase=false;charRoot.position.fromArray(position);$('game-controls').classList.remove('hide');ui.classList.add('mini');},framePlant:id=>{for(const o of scene.children)if(o!==plantRoot&&!o.isLight)o.visible=false;clearGlow();const e=plantEntries.find(p=>p.entryId===id);if(!e)return;scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(e.mesh),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());charRoot.visible=false;const distance=Math.max(5,size.length()*1.6);camera.position.copy(center).add(new THREE.Vector3(distance*.3,distance*.2,distance));camera.lookAt(center);composer.render();},render:()=>{updateOnline(1);composer.render();},threat:()=>({loaded:monstersLoaded,death:monsterDeathActive,monsters:monsters.map(m=>({position:m.root.position.toArray(),animationTime:m.mixer.time}))}),placeThreat:()=>{monsters.forEach((m,i)=>{m.root.position.set(charRoot.position.x+(i===0?.1:30+i),MONSTER_Y,charRoot.position.z);m.hitCooldown=0;});},world:()=>({milkJar,milkTag,foreman:foremanVisual,weaponDropMeshes,wingLootModels,cultivation:cropModels,charRoot,camera,plantRoot,plantEntries,monsters,buildMeshes,buildGhost,burst,coinTemplate,coins,lootMeshes,equipmentAuras,waterFeatures,pondFish,fishingRods,fishPoseStates,catchView:catchViewState}),plant:(text)=>addPlant(text,false),setBuild:(position,shape='cube')=>{buildPosition=[...position];buildShape=shape;updateBuildGhost();},buildBlocked:blockedByBuild,hitStrength:model=>Math.max(0,...playerFlashUniforms(model).map(u=>u.value))};
window.reletterPlantScreenPoint=()=>{
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  for(const entry of [...plantEntries].reverse()){
    const candidates=[];entry.mesh.traverse(o=>{const pos=o.geometry?.attributes.position,index=o.geometry?.index;if(!pos)return;const count=index?.count||pos.count,step=Math.max(3,Math.floor(count/240)*3);for(let i=0;i+2<count;i+=step){const v=new THREE.Vector3();for(let j=0;j<3;j++)v.add(new THREE.Vector3().fromBufferAttribute(pos,index?index.getX(i+j):i+j));v.multiplyScalar(1/3).applyMatrix4(o.matrixWorld).project(camera);if(v.z>-1&&v.z<1&&Math.abs(v.x)<.9&&Math.abs(v.y)<.9)candidates.push(v);}});
    for(const v of candidates){raycaster.setFromCamera({x:v.x,y:v.y},camera);const hits=raycaster.intersectObject(entry.mesh,true);if(hits.length)return{x:(v.x+1)*W()/2,y:(1-v.y)*H()/2};}
  }return null;
};

// Audio and video attachments remain private and are persisted with each entry.
$('upload-av').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 const types=['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/webm','audio/mp4','audio/aac','audio/flac','video/mp4','video/webm','video/ogg','video/quicktime'];
 if(!types.includes(file.type)||file.size>5*1024*1024){$('media-error').textContent='Choose audio or video under 5 MB (MP3, WAV, M4A, MP4, WebM).';e.target.value='';return;}
 try{const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});const kind=file.type.startsWith('audio/')?'audio':'video';draftMedia[kind]=data;$('av-name').textContent=file.name;renderAVPreview();$('media-error').textContent='';refreshDraft();}catch{$('media-error').textContent='Unable to read this file.';}
};
function renderAVPreview(){$('av-preview').replaceChildren();for(const kind of ['audio','video'])if(draftMedia[kind]){const el=document.createElement(kind);el.controls=true;el.preload='metadata';el.src=draftMedia[kind];if(kind==='video')el.playsInline=true;$('av-preview').append(el);}}
$('remove-av').onclick=e=>{e.stopPropagation();draftMedia.audio=null;draftMedia.video=null;$('av-preview').replaceChildren();$('upload-av').value='';$('av-name').textContent='Audio / video · max 5 MB each';refreshDraft();};
function attachReply(entry,parentId){
 const parent=plantEntries.find(p=>p.entryId===parentId);if(!parent)return;
 // Anchor the new stem on an actual vertex of the parent's stem geometry.
 const geometry=parent.mesh.children[0]?.geometry,positions=geometry?.attributes.position;
 let point=new THREE.Vector3(0,1,0),best=Infinity;
 if(positions){geometry.computeBoundingBox();const box=geometry.boundingBox,target=box.min.y+(box.max.y-box.min.y)*.4;for(let i=0;i<positions.count;i++){const v=new THREE.Vector3().fromBufferAttribute(positions,i),score=Math.abs(v.y-target)+Math.hypot(v.x,v.z)*.35;if(score<best){best=score;point.copy(v);}}}
 parent.mesh.updateMatrixWorld(true);point.applyMatrix4(parent.mesh.children[0].matrixWorld);plantRoot.worldToLocal(point);entry.mesh.position.copy(point);entry.mesh.scale.copy(parent.mesh.scale).multiplyScalar(.6);entry.mesh.rotation.z=.65;entry.mesh.userData.replyTilt=.65;
}
let gameView={wallets:{},hits:{},loot:[]},lootMeshes=new Map(),waterEffects=[],collecting=new Set(),lastPickup=0,shooting=false;

let lootSnapshot=null,lootAsset=null;
function syncLootMeshes(){
 if(lootSnapshot===gameView.loot&&lootAsset===coinTemplate)return;lootSnapshot=gameView.loot;lootAsset=coinTemplate;
 const ids=new Set((gameView.loot||[]).map(c=>c.id));
 // Coin clones share the platform asset's geometry/materials; removing a drop must not dispose them.
 for(const [id,group] of lootMeshes)if(!ids.has(id)){scene.remove(group);if(group.children[0]?.userData.bag)disposeCoinBag(group);lootMeshes.delete(id);}
 if(!coinTemplate)return;
 for(const coin of gameView.loot||[])if(!lootMeshes.has(coin.id)){
  const model=coin.kind==='coin-bag'?createCoinBag():createCollectibleCoin(),group=new THREE.Group();group.name='Dropped coin';group.userData.coinId=coin.id;group.userData.baseY=coin.position[1]||0;group.userData.floatPhase=(hash(coin.id)%628)/100;group.add(model);group.position.fromArray(coin.position);group.position.y+=COIN_FLOAT_HEIGHT;scene.add(group);lootMeshes.set(coin.id,group);
 }
}
function receiveGame(data){if(Number.isFinite(data.worldRevision)&&data.worldRevision<(gameView.worldRevision??-1))return;const previousLevel=currentStats().level,old=gameView.boss,boss=acceptBossSnapshot(old,data.boss),redMode=!(data.pkMode??gameView.pkMode??false);const blocks=Array.isArray(data.blocks)&&(data.buildRevision??0)>=(gameView.buildRevision??-1)?data.blocks:gameView.blocks||[],buildRevision=Math.max(data.buildRevision??-1,gameView.buildRevision??-1);const equipmentState=(data.equipmentRevision??0)>=(gameView.equipmentRevision??0)?data:gameView;gameView={...gameView,...data,milkEncounter:acceptMilk(gameView.milkEncounter,data.milkEncounter),boss,redMode,blocks,buildRevision,inventories:equipmentState.inventories,equipment:equipmentState.equipment,shields:equipmentState.shields,weaponInstances:equipmentState.weaponInstances||gameView.weaponInstances,equipmentRevision:equipmentState.equipmentRevision};receiveBoss(old,boss);syncDestructionEvents();syncBlocks(blocks);refreshEquipmentUI();coinCount=data.wallets?.[selectedCharacter]||0;$('coin-num').textContent='x '+coinCount;$('water-status').textContent=data.pkMode?'PK · '+(data.hits?.[selectedCharacter]||0)+' / '+currentStats().maxHp+' hits':'CO-OP';syncLootMeshes();syncAdventure();refreshBag();refreshProgression();receiveEnemyDamage();receiveDeathPenalty();if(admitted&&currentStats().level>previousLevel)centerNotice('LEVEL UP · '+currentStats().level);}
let worldRefreshBusy=false;
async function refreshWorld(){if(!connected||worldRefreshBusy)return;worldRefreshBusy=true;try{receiveGame(await api('/api/world',undefined,'GET'));}catch{}finally{worldRefreshBusy=false;}}
setInterval(()=>{if(!document.hidden)refreshWorld();},4000);
window.addEventListener('focus',refreshWorld);
// A short moving jet breaks into droplets, then scatters into a splash.
// Instancing keeps each spray to one droplet draw call on phones.
function showWater(data){showFusionEcho(data);if(data.defeated&&data.hit===selectedCharacter)triggerPlayerHit();
 if(data.ultimate){showUltimateAttack(data);if(meleeFamilies.includes(data.family))showMeleeAttack(data);if(!data.red&&['Ely','Rae'].includes(data.hit)&&!data.blocked)flashPlayerHit(data.hit);return;}
 if((data.charge||0)>=.65&&!meleeFamilies.includes(data.family))showSignatureBurst(data);
 if(data.family&&(data.family!=='water'||data.weapon!=='water')){showEquipmentAttack(data);if(!data.red&&data.hit&&(!data.blocked||data.blocked<Math.min(2,data.damage)))flashPlayerHit(data.hit);return;}
 if(!data.red&&!data.blocked&&['Ely','Rae'].includes(data.hit))flashPlayerHit(data.hit);
 const origin=new THREE.Vector3(...data.origin),direction=new THREE.Vector3(...data.direction).normalize(),charge=data.charge||0,range=data.range||18,radius=data.radius||.12;
 const red=!!data.red;
 let travel=range,impactHeight=origin.y+direction.y*range;
 if(data.impact){const point=new THREE.Vector3(...data.impact);travel=Math.min(range,Math.max(.2,point.clone().sub(origin).dot(direction)));impactHeight=point.y;}
 if(data.hit&&!data.impact){const target=data.hit===selectedCharacter?charRoot.position:[...remotePlayers.values()].find(p=>p.character===data.hit)?.state?.position;
  if(target){const point=target.isVector3?target:new THREE.Vector3(...target);travel=Math.min(range,Math.max(1,point.clone().sub(origin).dot(direction)));impactHeight=point.y+.9;}}
 const mesh=new THREE.Group(),count=180+Math.round(charge*140),geometry=new THREE.SphereGeometry(1,7,5),material=new THREE.MeshBasicMaterial({color:red?'#e52b48':'#8ccfe8',transparent:true,opacity:.56,depthWrite:false});
 const drops=new THREE.InstancedMesh(geometry,material,count);drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);drops.frustumCulled=false;mesh.add(drops);
 mesh.name='Water spray';
 const particles=Array.from({length:count},(_,i)=>{const seed=Math.sin(i*127.1+19.7)*43758.5453,random=seed-Math.floor(seed),angle=i*2.39996;
  drops.setColorAt(i,new THREE.Color().setHSL(red?.98+random*.025:.52+random*.025,red?.8:.35+random*.25,red?.42+random*.18:.65+random*.25));
  return {delay:i/count*(.22+charge*.2),side:Math.cos(angle)*random,up:Math.sin(angle)*random,size:(.018+random*.024)*(1+charge*.75),core:i%4===0};});
 const rings=[];for(let i=0;i<2;i++){const ring=new THREE.Mesh(new THREE.RingGeometry(.78,1,40),new THREE.MeshBasicMaterial({color:red?'#ef4a62':'#b9eff8',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.copy(origin).addScaledVector(direction,travel);ring.position.y=impactHeight+.025+i*.008;ring.visible=!data.hit;mesh.add(ring);rings.push(ring);}
 const flight=data.contactDelay?data.contactDelay/1000:.65+charge*.3,emission=.22+charge*.2;
 const fx={mesh,drops,particles,rings,origin,heading:direction,side:new THREE.Vector3(-direction.z,0,direction.x),travel,impactHeight,age:0,flight,emission,duration:flight+emission+.5,direction:data.direction,range,radius,charge,red};
 scene.add(mesh);waterEffects.push(fx);animateWaterSpray(fx,0);if(data.hit)$('water-status').textContent=(gameView.hits?.[selectedCharacter]||0)+' / '+currentStats().maxHp+' hits · Splash!';
}
const waterDropTransform=new THREE.Object3D(),waterDropTangent=new THREE.Vector3(),waterUp=new THREE.Vector3(0,1,0);
function animateWaterSpray(fx,dt){
 fx.age+=dt;const {origin,heading,side,flight,travel,impactHeight,charge}=fx;
 for(let i=0;i<fx.particles.length;i++){
  const p=fx.particles[i],t=fx.age-p.delay,u=t/flight;let size=0;
  if(t>=0&&u<=1){
   const spread=(.05+u*u*(.6+charge*.7)),distance=travel*u;
   waterDropTransform.position.copy(origin).addScaledVector(heading,distance).addScaledVector(side,p.side*spread);
   waterDropTransform.position.y=THREE.MathUtils.lerp(origin.y,impactHeight,u)+Math.sin(Math.PI*u)*(1.3+charge*1.5)+p.up*spread;
   waterDropTangent.copy(heading).multiplyScalar(travel);waterDropTangent.y=impactHeight-origin.y+Math.PI*Math.cos(Math.PI*u)*(1.3+charge*1.5);waterDropTangent.normalize();
   waterDropTransform.quaternion.setFromUnitVectors(waterUp,waterDropTangent);size=p.size*(1-.35*u);waterDropTransform.scale.set(size,size*(p.core?2.2*(1-u)+1:1.3),size);
  }else if(u>1&&t-flight<.42){
   const splash=t-flight,fade=1-splash/.42;
   waterDropTransform.position.copy(origin).addScaledVector(heading,travel+p.up*splash*3).addScaledVector(side,p.side*splash*(4+charge*3));
   waterDropTransform.position.y=impactHeight+Math.max(0,(1.1+Math.abs(p.up)*2)*splash-7*splash*splash);
   waterDropTransform.quaternion.identity();size=p.size*fade;waterDropTransform.scale.set(size,size*1.5,size);
  }
  if(!size)waterDropTransform.scale.setScalar(0);waterDropTransform.updateMatrix();fx.drops.setMatrixAt(i,waterDropTransform.matrix);
 }
 fx.drops.instanceMatrix.needsUpdate=true;
 for(let i=0;i<fx.rings.length;i++){const t=fx.age-flight-i*.12;fx.rings[i].scale.setScalar(Math.max(.001,.15+t*(2.5+charge)));fx.rings[i].material.opacity=t>0&&t<.5?.24*(1-t/.5):0;}
 return fx.age<fx.duration;
}
let waterChargeStart=null,waterChargeSource=null;
const waterButton=$('water-gun');waterButton.style.touchAction='none';waterButton.textContent='ATTACK';waterButton.setAttribute('aria-label','Attack: hold to charge, release to fire');
function waterCharge(){return waterChargeStart===null?0:Math.min(1,(performance.now()-waterChargeStart)/1500);}
function cancelWaterCharge(){waterChargeStart=null;waterChargeSource=null;waterButton.textContent='ATTACK';waterButton.style.setProperty('--attack-charge','0%');}
function beginWaterCharge(source){if(waterChargeStart!==null||!admitted||!connected||phase!==PHASE.EXPLORE)return;waterChargeStart=performance.now();waterChargeSource=source;}
function releaseWaterCharge(source){if(waterChargeSource!==source)return;const charge=waterCharge();cancelWaterCharge();shootWater(charge);}
// Read the unposed orientation: cosmetic spins must never become gameplay aim.
function gameplayHeading(model){
 if(!model)return 0;
 const saved=meleePoseRestore.find(([object])=>object===model)?.[1]||fishingPoseRestore.find(v=>v.object===model)?.quaternion||model.quaternion;
 const forward=new THREE.Vector3(0,0,1).applyQuaternion(saved);
 return Math.atan2(forward.x,forward.z);
}
let queuedMelee=null,attackReadyAt=0,attackQueueTimer;
function flushAttackQueue(){
 clearTimeout(attackQueueTimer);
 if(!queuedMelee)return;
 if(performance.now()>queuedMelee.expires||queuedMelee.weapon!==currentWeapon().id||!connected||phase!==PHASE.EXPLORE||document.hidden||fishingHUDActive||document.body.dataset.panel!=='none'){queuedMelee=null;return;}
 if(shooting||performance.now()<attackReadyAt){attackQueueTimer=setTimeout(flushAttackQueue,Math.max(16,attackReadyAt-performance.now()));return;}
 const next=queuedMelee;queuedMelee=null;shootWater(next.charge);
}
async function shootWater(charge=0){
 if(!admitted||!connected||phase!==PHASE.EXPLORE)return;
 const weapon=currentWeapon(),melee=meleeFamilies.includes(weapon.family);
 if(shooting||performance.now()<attackReadyAt){
  if(melee){queuedMelee={charge,weapon:weapon.id,expires:performance.now()+800};flushAttackQueue();}return;
 }
 shooting=true;const started=performance.now();attackReadyAt=started+weapon.cooldown+30;
 const heading=gameplayHeading(charModel),direction=melee?new THREE.Vector3(Math.sin(heading),0,Math.cos(heading)):rangedAim(charge).direction;
 try{await api('/api/game',{action:'shoot',direction:direction.toArray(),charge});}
 catch(e){if(!/refilling/i.test(e.message))message(e.message);}
 finally{shooting=false;flushAttackQueue();}
}
waterButton.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();waterButton.setPointerCapture(e.pointerId);beginWaterCharge('pointer');});
waterButton.addEventListener('pointerup',e=>{e.preventDefault();e.stopPropagation();releaseWaterCharge('pointer');});
waterButton.addEventListener('pointercancel',cancelWaterCharge);waterButton.addEventListener('lostpointercapture',()=>{if(waterChargeSource==='pointer')cancelWaterCharge();});
waterButton.addEventListener('contextmenu',e=>e.preventDefault());
waterButton.onclick=e=>{e.preventDefault();e.stopPropagation();if(e.detail===0)shootWater();};
window.addEventListener('keydown',e=>{if(e.code==='KeyQ'&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();if(!e.repeat)beginWaterCharge('keyboard');}});
window.addEventListener('keyup',e=>{if(e.code==='KeyQ'){e.preventDefault();releaseWaterCharge('keyboard');}});
window.addEventListener('blur',cancelWaterCharge);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelWaterCharge();});
function updateWater(dt){if(waterChargeStart!==null){if(!connected||phase!==PHASE.EXPLORE)cancelWaterCharge();else{const percent=Math.floor(waterCharge()*100);waterButton.textContent=percent===100?'100% READY':percent+'%';waterButton.style.setProperty('--attack-charge',percent+'%');}}syncLootMeshes();for(const [id,mesh] of lootMeshes){mesh.children[0].rotation.y=globalTime*2;mesh.position.y=mesh.userData.baseY+COIN_FLOAT_HEIGHT+Math.sin(globalTime*1.8+mesh.userData.floatPhase)*.4;}waterEffects=waterEffects.filter(fx=>{if(animateWaterSpray(fx,dt))return true;scene.remove(fx.mesh);fx.mesh.traverse(o=>{if(o.isInstancedMesh)o.dispose();o.geometry?.dispose();o.material?.dispose();});return false;});if(!connected||phase!==PHASE.EXPLORE||performance.now()-lastPickup<500)return;lastPickup=performance.now();for(const coin of gameView.loot||[])if(!collecting.has(coin.id)&&Math.hypot(charRoot.position.x-coin.position[0],charRoot.position.z-coin.position[2])<2&&Math.abs(charRoot.position.y-coin.position[1])<3){collecting.add(coin.id);api('/api/game',{action:'collect',id:coin.id}).catch(()=>{}).finally(()=>collecting.delete(coin.id));}}

// ===== Cooperative encounter =====
const bossHud=document.createElement('div');bossHud.id='boss-health';bossHud.hidden=true;bossHud.setAttribute('role','progressbar');bossHud.setAttribute('aria-label','Auntie health');bossHud.setAttribute('aria-valuemax','100');bossHud.innerHTML='<div id="boss-fill"></div><span id="boss-text">AUNTIE · 100 / 100</span>';document.body.append(bossHud);
let bossFlash=0,bossDefeatGeneration=null;
// Health/death is monotonic within a room generation, including late snapshots.
function acceptBossSnapshot(old,next){
 if(!next)return old;if(!old)return next;
 if(next.generation<old.generation)return old;
 if(next.generation===old.generation){if(old.hp===0||next.hp>old.hp||(next.revision||0)<(old.revision||0))return old;if((next.revision||0)===(old.revision||0)&&(next.tick||0)<(old.tick||0))return old;}
 return next;
}
function receiveBoss(old,boss){
 if(!boss)return;if(old&&boss.generation!==old.generation){bossFlash=0;bossDefeatGeneration=null;for(const m of monsters){m.root.position.fromArray(boss.position);m.hitCooldown=1.5;m.walkAction?.reset().play();}if(old.hp===0&&burst){scene.remove(burst.mesh);burst.geo.dispose();burst.mesh.material.dispose();burst=null;}}if(old&&boss.generation===old.generation&&boss.hp<old.hp)bossFlash=.7;
 if(boss.hp===0&&old?.hp>0&&bossDefeatGeneration!==boss.generation){bossDefeatGeneration=boss.generation;const m=monsters[0];if(m){m.root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(m.model),center=box.getCenter(new THREE.Vector3());center.y=Math.max(m.root.position.y+1,(box.max.y+m.root.position.y)/2);createBurst(center);}}
 if(boss.hp===0)for(const m of monsters){m.root.visible=false;m.isChasing=false;m.mixer.stopAllAction();}
 bossHud.setAttribute('aria-valuenow',String(boss.hp));bossHud.setAttribute('aria-valuemax',String(boss.maxHp||100));$('boss-fill').style.width=(100*boss.hp/(boss.maxHp||100))+'%';$('boss-text').textContent=(boss.kind==='foreman'?'NIGHT FOREMAN':'AUNTIE')+' · LV '+(boss.level||1)+' · '+boss.hp+' / '+(boss.maxHp||100)+(boss.hp===0?' · DEFEATED':'')+Object.keys(boss.effects||{}).filter(k=>boss.effects[k].until>Date.now()).slice(0,2).map(k=>' · '+k.toUpperCase()).join('');
 $('water-gun').classList.toggle('red-water',!!gameView.redMode);
}
function prepareBossBlood(m){
 if(m.bloodUniform)return;m.bloodUniform={amount:{value:0},flash:{value:0},ice:{value:0}};
 m.model.traverse(o=>{if(!o.isMesh)return;for(const mat of Array.isArray(o.material)?o.material:[o.material]){mat.onBeforeCompile=shader=>{
  shader.uniforms.reletterIce=m.bloodUniform.ice;shader.uniforms.reletterBlood=m.bloodUniform.amount;shader.uniforms.reletterFlash=m.bloodUniform.flash;
  shader.vertexShader='varying vec3 reletterWound;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nreletterWound=position*4000.0;');
  shader.fragmentShader='varying vec3 reletterWound; uniform float reletterBlood; uniform float reletterFlash; uniform float reletterIce;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float streak=(sin(reletterWound.x*4.0+sin(reletterWound.z*3.0))*0.5+0.5)*0.75+(sin(reletterWound.y*0.8+reletterWound.x*2.0)*0.5+0.5)*0.25;
   float wound=smoothstep(1.0-reletterBlood*0.95,1.12-reletterBlood*0.95,streak)*step(0.001,reletterBlood);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.32,0.006,0.018)*(0.65+diffuseColor.g),wound*0.9);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.5,1.)*(.55+dot(diffuseColor.rgb,vec3(.333))),reletterIce*.85);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0,0.015,0.025),reletterFlash);
  `);
 };mat.customProgramCacheKey=()=>'reletter-boss-blood-v2';mat.needsUpdate=true;}});
 m.root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(m.model);m.bloodBounds={min:box.min.clone().sub(m.root.position),size:box.getSize(new THREE.Vector3())};m.bloodBounds.min.y=Math.max(0,m.bloodBounds.min.y);m.bloodBounds.size.y=Math.max(1,box.max.y-m.root.position.y-m.bloodBounds.min.y);
 const positions=new Float32Array(60*3),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setDrawRange(0,0);
 m.drips=new THREE.Points(geo,new THREE.PointsMaterial({color:'#9e1030',size:.13,transparent:true,opacity:.8,depthWrite:false}));m.drips.frustumCulled=false;m.root.add(m.drips);
}
function syncBossMonster(dt){
 const boss=gameView.boss;if(boss?.hp===0&&boss.respawnAt){const text='AUNTIE · RESPAWN '+Math.max(0,Math.ceil((boss.respawnAt-Date.now())/1000))+'s';if($('boss-text').textContent!==text)$('boss-text').textContent=text;}
 for(const m of monsters){
  if(!connected||!boss||boss.hp<=0){m.root.visible=false;continue;}
  // Only the server can move the shared monster. Local frame rates never choose a target.
  m.root.position.fromArray(boss.position);m.root.rotation.y=boss.rotation||0;m.root.visible=true;
  if(boss.paused||monstersPausedForGarden())continue;
  if(!!boss.chasing!==m.isChasing){m.isChasing=!!boss.chasing;if(m.isChasing&&m.chaseAction){m.walkAction?.fadeOut(.2);m.chaseAction.reset().fadeIn(.2).play();}else if(m.walkAction){m.chaseAction?.fadeOut(.2);m.walkAction.reset().fadeIn(.2).play();}}
  m.mixer.update(dt);m.hitCooldown=Math.max(0,m.hitCooldown-dt);
  const distance=Math.hypot(boss.position[0]-charRoot.position.x,boss.position[2]-charRoot.position.z);if(phase===PHASE.EXPLORE&&charRoot.position.y<5&&distance<MONSTER_HIT_DIST&&m.hitCooldown<=0){m.hitCooldown=MONSTER_HIT_COOLDOWN;api('/api/game',{action:'monster-hit'}).then(r=>{if(r.game)receiveGame(r.game);if(!r.blocked){flashPlayerHit(selectedCharacter);if(r.defeated)triggerPlayerHit();}}).catch(()=>{});}
 }
 return true;
}
function updateGardenWorld(dt){
 resolveBuildOverlap();updateEquipmentEffects(dt);
 const canGoDown=phase===PHASE.IDLE||phase===PHASE.DONE||(phase===PHASE.EXPLORE&&charRoot.position.y>3);goDownButton.hidden=!canGoDown;buildButton.hidden=canGoDown;buildButton.disabled=phase!==PHASE.EXPLORE;
 bossHud.hidden=!admitted;bossFlash=Math.max(0,bossFlash-dt);
 const boss=gameView.boss;if(boss?.hp===0&&boss.respawnAt){const text='AUNTIE · RESPAWN '+Math.max(0,Math.ceil((boss.respawnAt-Date.now())/1000))+'s';if($('boss-text').textContent!==text)$('boss-text').textContent=text;}
 for(const m of monsters){if(!boss)continue;if(boss.hp===0){m.root.visible=false;continue;}
  prepareBossBlood(m);const damage=Math.max(0,Math.min(1,1-boss.hp/(boss.maxHp||100)));m.bloodUniform.amount.value=damage;m.bloodUniform.flash.value=bossFlash>0&&Math.floor(bossFlash*35)%2?1:0;
  const count=damage>0?Math.max(1,Math.floor(damage*60)):0;m.drips.geometry.setDrawRange(0,count);const attr=m.drips.geometry.attributes.position,{min,size}=m.bloodBounds;
  for(let i=0;i<count;i++){const a=i*2.39996,t=(performance.now()/1100+i*.137)%1;attr.setXYZ(i,min.x+size.x*(.5+Math.cos(a)*.3),min.y+size.y*(.85-t*.8),min.z+size.z*(.5+Math.sin(a)*.3));}attr.needsUpdate=true;
 }
 if(buildPanelOpen)buildGhost.visible=phase===PHASE.EXPLORE&&!paintTarget&&!paintSelecting;
}

// ===== Persistent snap-to-grid building =====
const buildMeshes=new Map(),buildGhost=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshStandardMaterial({color:'#f8e29b',transparent:true,opacity:.45,depthWrite:false}));scene.add(buildGhost);buildGhost.visible=false;buildGhost.name='Build preview';
let buildSize=[2,1,2],buildColor='#c6a5dc';
let buildShape='cube',buildRotation=0,buildPosition=[0,0,4],selectedBlock=null,buildBusy=false;
const buildButton=document.createElement('button');buildButton.id='build-open';buildButton.textContent='BUILD';buildButton.type='button';dock.append(buildButton);
const goDownButton=document.createElement('button');goDownButton.id='go-down';goDownButton.type='button';goDownButton.textContent='GO DOWN';goDownButton.setAttribute('aria-label','Go down to the ground without planting');dock.append(goDownButton);buildButton.hidden=true;
goDownButton.onclick=()=>{
 if(!admitted||monsterDeathActive||![PHASE.IDLE,PHASE.DONE,PHASE.EXPLORE].includes(phase))return;
 const sign=selectedCharacter==='Ely'?-1:1;let landing=null;
 for(let i=0;i<256;i++){const x=sign*(8+Math.floor(i/16)*2),z=STAIR_Z_FAR+4+(i%16)*2;if(!blockedByBuild(x,z,0)&&!monsters.some(m=>m.root.visible&&Math.hypot(m.root.position.x-x,m.root.position.z-z)<6)){landing=new THREE.Vector3(x,0,z);break;}}
 if(!landing){message('No clear landing spot. Please try again.');return;}
 claimPanel('none');document.activeElement?.blur();pendingStartText=null;keysDown.clear();cancelWaterCharge();resetToStart();
 charRoot.position.copy(landing);jumpVelX=0;jumpVelZ=0;camTarget.copy(landing).add(new THREE.Vector3(0,1.5,0));camera.position.copy(landing).add(new THREE.Vector3(0,4,6));camera.lookAt(camTarget);
 $('title').classList.remove('fade-out');monsterResumeGraceUntil=performance.now()+2000;reflectPanels();updateGardenWorld(0);
};
const buildPanel=document.createElement('section');buildPanel.id='build-panel';buildPanel.hidden=true;buildPanel.innerHTML='<header><b>BUILD</b><button id="build-close" type="button" aria-label="Close build">×</button></header><div class="build-shapes"><button data-shape="cube">Cube</button><button data-shape="bar">Bar</button><button data-shape="cylinder">Cylinder</button><button id="build-pond">Aquarium</button></div><div class="build-options"><label>Color <input id="build-color" type="color" value="#c6a5dc"></label><label>Width <select id="build-width"><option>1</option><option selected>2</option><option>4</option><option>6</option></select></label><label>Height <select id="build-height"><option>0.5</option><option selected>1</option><option>1.5</option><option>2</option></select></label><label>Depth <select id="build-depth"><option>1</option><option selected>2</option><option>4</option><option>6</option></select></label></div><p>Tap ground or blocks to aim. PLACE saves for both players.</p><div class="build-actions"><button id="build-front">In front</button><button id="build-rotate">Rotate ↻</button><button id="build-place">PLACE</button><button id="build-destroy" disabled>DESTROY</button></div><div id="build-status" role="status"></div>';document.body.append(buildPanel);

function blockGeometry(b){return b.shape==='cylinder'?new THREE.CylinderGeometry(footprint(b)[0]/2,footprint(b)[0]/2,footprint(b)[1],32):new THREE.BoxGeometry(...footprint(b));}
function updateBuildGhost(){if(pondBuildMode){previewAquarium();buildGhost.position.set(buildPosition[0],0,buildPosition[2]);return;}const block={shape:buildShape,rotation:buildRotation,size:buildSize};buildGhost.material.color.set(buildColor);buildGhost.geometry.dispose();buildGhost.geometry=blockGeometry(block);buildGhost.position.set(buildPosition[0],buildPosition[1]+buildSize[1]/2,buildPosition[2]);for(const btn of buildPanel.querySelectorAll('[data-shape]'))btn.setAttribute('aria-pressed',String(btn.dataset.shape===buildShape));$('build-status').textContent=buildShape+' · '+buildPosition.join(', ');}
function buildInFront(){const d=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),gameplayHeading(charModel));buildPosition=[Math.round((charRoot.position.x+d.x*5)/2)*2,Math.max(0,Math.floor(charRoot.position.y/2)*2),Math.round((charRoot.position.z+d.z*5)/2)*2];updateBuildGhost();}
function openBuild(){if(!admitted)return;if(phase!==PHASE.EXPLORE){message('Return to the garden to build');return;}claimPanel('build');buildPanelOpen=true;buildPanel.hidden=false;buildGhost.visible=true;buildInFront();reflectPanels();}
buildButton.onclick=()=>{if(buildPanelOpen){claimPanel('none');reflectPanels();}else openBuild();};$('build-close').onclick=()=>{claimPanel('none');reflectPanels();};$('build-front').onclick=buildInFront;
$('build-rotate').onclick=()=>{buildRotation=1-buildRotation;updateBuildGhost();};for(const b of buildPanel.querySelectorAll('[data-shape]'))b.onclick=()=>{buildShape=b.dataset.shape;buildSize[0]=buildShape==='bar'?6:2;buildSize[2]=2;$('build-width').value=buildSize[0];$('build-depth').value=2;updateBuildGhost();};
for(const id of ['build-width','build-height','build-depth','build-color'])$(id).oninput=()=>{buildSize=[+$('build-width').value,+$('build-height').value,+$('build-depth').value];if(buildShape==='cylinder'){buildSize[2]=buildSize[0];$('build-depth').value=buildSize[0];}buildColor=$('build-color').value;updateBuildGhost();};
async function submitBuild(action){if(buildBusy)return;buildBusy=true;try{const result=await api('/api/game',action==='build'?{action,shape:buildShape,rotation:buildRotation,position:buildPosition,size:buildSize,color:buildColor,surface:pendingBuildSurface}:{action,id:selectedBlock});if(result.game)receiveGame(result.game);else await refreshWorld();$('build-status').textContent=action==='build'?'Saved for both players':'Removed';if(action==='destroy'){selectedBlock=null;$('build-destroy').disabled=true;}}catch(e){$('build-status').textContent=e.message;}finally{buildBusy=false;}}
$('build-place').onclick=()=>submitBuild('build');$('build-destroy').onclick=()=>submitBuild('destroy');
let renderedBuildRevision=-1;
function syncBlocks(blocks){if(renderedBuildRevision===gameView.buildRevision)return;renderedBuildRevision=gameView.buildRevision;const ids=new Set(blocks.map(b=>b.id));for(const [id,mesh] of buildMeshes)if(!ids.has(id)){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();buildMeshes.delete(id);if(selectedBlock===id){selectedBlock=null;$('build-destroy').disabled=true;}}
 for(const b of blocks){if(buildMeshes.has(b.id)){const old=buildMeshes.get(b.id);if(JSON.stringify(old.userData.block)===JSON.stringify(b))continue;scene.remove(old);old.geometry.dispose();old.material.dispose();buildMeshes.delete(b.id);}const mesh=new THREE.Mesh(blockGeometry(b),new THREE.MeshStandardMaterial({color:b.color||'#c6a5dc',roughness:.72,metalness:.03}));mesh.position.set(b.position[0],b.position[1]+footprint(b)[1]/2,b.position[2]);mesh.userData.block=b;mesh.name='Built '+b.shape;scene.add(mesh);buildMeshes.set(b.id,mesh);}}
function insideBuild(b,x,z,pad=0){const [w,,d]=footprint(b);return b.shape==='cylinder'?Math.hypot(x-b.position[0],z-b.position[2])<w/2+pad:Math.abs(x-b.position[0])<w/2+pad&&Math.abs(z-b.position[2])<d/2+pad;}
function monsterBuildBlocked(x,z){return (gameView.blocks||[]).some(b=>b.position[1]<12&&insideBuild(b,x,z,1.1));}
function blockedByBuild(x,z,y){const milk=gameView.milkEncounter;if(milk?.phase==='sealed'&&y<9&&Math.hypot(x-milk.position[0],z-milk.position[2])<2.85)return true;if((gameView.fishing?.ponds||[]).some(p=>{const [w,h,d]=p.size||[6,2.1,4];return y<h-.12&&Math.abs(x-p.position[0])<w/2+.35&&Math.abs(z-p.position[2])<d/2+.35;}))return true;return (gameView.blocks||[]).some(b=>y<b.position[1]+footprint(b)[1]-.12&&y+1.5>b.position[1]&&insideBuild(b,x,z,.35));}
function buildCeiling(x,z,oldY,nextY){let ceiling=Infinity;for(const b of gameView.blocks||[])if(b.position[1]>=oldY+1.45&&nextY+1.5>=b.position[1]&&insideBuild(b,x,z))ceiling=Math.min(ceiling,b.position[1]);return ceiling;}
function buildTerrainHeight(x,z,y){let best=null;for(const b of gameView.blocks||[]){const top=b.position[1]+footprint(b)[1];if(y>=top-.8&&insideBuild(b,x,z)&&top>(best??-Infinity))best=top;}return best;}
let buildTap=null;canvas.addEventListener('pointerdown',e=>{buildTap={x:e.clientX,y:e.clientY};},true);
canvas.addEventListener('pointerup',e=>{
 if(paintTarget||paintSelecting)return;
 if(!admitted||phase!==PHASE.EXPLORE||!buildTap||Math.hypot(e.clientX-buildTap.x,e.clientY-buildTap.y)>8)return;
 const rect=canvas.getBoundingClientRect(),pointer=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);
 const hit=ray.intersectObjects([...buildMeshes.values()],false)[0];if(!buildPanelOpen&&!hit)return;
 e.stopImmediatePropagation();ptrs.delete(e.pointerId);
 if(!buildPanelOpen)openBuild();if(!buildPanelOpen)return;
 if(hit){selectedBlock=hit.object.userData.block.id;$('build-destroy').disabled=false;const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld),dims=footprint({shape:buildShape,rotation:buildRotation,size:buildSize}),point=hit.point.clone().add(new THREE.Vector3(normal.x*dims[0]/2,normal.y*dims[1]/2,normal.z*dims[2]/2));buildPosition=[Math.round(point.x*2)/2,Math.max(0,Math.round((point.y-dims[1]/2)*2)/2),Math.round(point.z*2)/2];}
 else{const point=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());if(!point)return;buildPosition=[Math.round(point.x*2)/2,0,Math.round(point.z*2)/2];selectedBlock=null;$('build-destroy').disabled=true;}
 for(const [id,mesh] of buildMeshes)mesh.material.emissive.set(id===selectedBlock?'#49394d':'#000000');updateBuildGhost();
},true);
updateBuildGhost();


// Shared hit events drive the victim's screen and both clients' character rendering.
const playerHitTimers=new Map(),playerHitModelUniforms=new WeakMap(),playerHitMaterialUniforms=new WeakMap();
const playerHitScreen=document.createElement('div');playerHitScreen.id='player-hit-screen';playerHitScreen.setAttribute('aria-hidden','true');playerHitScreen.style.cssText='position:fixed;inset:0;z-index:350;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(255,245,248,.45) 15%,rgba(255,40,70,.7) 100%)';document.body.append(playerHitScreen);
function playerFlashUniforms(model){
 if(!model)return [];if(playerHitModelUniforms.has(model))return playerHitModelUniforms.get(model);
 const uniforms=new Set();model.traverse(o=>{if(!o.isMesh)return;for(const mat of Array.isArray(o.material)?o.material:[o.material]){
  if(!mat)continue;let uniform=playerHitMaterialUniforms.get(mat);
  if(!uniform){uniform={value:0};playerHitMaterialUniforms.set(mat,uniform);const previous=mat.onBeforeCompile,baseKey=mat.customProgramCacheKey.call(mat);
   mat.onBeforeCompile=function(shader,renderer){previous.call(this,shader,renderer);shader.uniforms.reletterPlayerHit=uniform;shader.fragmentShader='uniform float reletterPlayerHit;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>','gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(1.0,0.015,0.04),reletterPlayerHit);\n#include <dithering_fragment>');};
   mat.customProgramCacheKey=()=>baseKey+'-water-hit-v1';mat.needsUpdate=true;
  }uniforms.add(uniform);
 }});const list=[...uniforms];playerHitModelUniforms.set(model,list);return list;
}
function flashPlayerHit(character){playerHitTimers.set(character,.36);updatePlayerHitFeedback(0);}
function updatePlayerHitFeedback(dt){
 for(const [name,left] of playerHitTimers){const next=Math.max(0,left-dt);if(next)playerHitTimers.set(name,next);else playerHitTimers.delete(name);}
 const strength=name=>Math.min(1,(playerHitTimers.get(name)||0)/.14)*.9;
 if(admitted&&charModel)for(const u of playerFlashUniforms(charModel))u.value=strength(selectedCharacter);
 for(const p of remotePlayers.values())if(p.model)for(const u of playerFlashUniforms(p.model))u.value=strength(p.character);
 playerHitScreen.style.opacity=String(Math.min(1,(playerHitTimers.get(selectedCharacter)||0)/.24)*.65);
}

// A late building snapshot or a landing must never trap a player inside a solid.
function resolveBuildOverlap(){
 if(!admitted||phase!==PHASE.EXPLORE||!blockedByBuild(charRoot.position.x,charRoot.position.z,charRoot.position.y))return;
 const p=charRoot.position,candidates=[];
 for(const b of gameView.blocks||[]){if(!insideBuild(b,p.x,p.z,.35))continue;const [w,h,d]=footprint(b),[x,y,z]=b.position;
  if(p.y>=y+h-.25){candidates.push([p.x,y+h,p.z]);continue;}
  candidates.push([x-w/2-.4,p.y,p.z],[x+w/2+.4,p.y,p.z],[p.x,p.y,z-d/2-.4],[p.x,p.y,z+d/2+.4]);
 }
 candidates.sort((a,b)=>p.distanceToSquared(new THREE.Vector3(...a))-p.distanceToSquared(new THREE.Vector3(...b)));
 let free=candidates.find(v=>!blockedByBuild(v[0],v[2],v[1]));
 if(!free)for(let r=.5;r<=16&&!free;r+=.5)for(let i=0;i<32;i++){const v=[p.x+Math.cos(i*Math.PI/16)*r,p.y,p.z+Math.sin(i*Math.PI/16)*r];if(!blockedByBuild(v[0],v[2],v[1])){free=v;break;}}
 if(free){p.fromArray(free);jumpVelX=jumpVelZ=0;}
}

// ===== Garden armory: durable ownership and two independent equipment slots =====
function currentWeapon(){return activeWeapon(gameView,selectedCharacter);}
const shopButton=document.createElement('button');shopButton.id='shop-open';shopButton.textContent='SHOP';shopButton.type='button';dock.append(shopButton);
const shopPanel=document.createElement('section');shopPanel.id='shop-panel';shopPanel.hidden=true;shopPanel.setAttribute('aria-label','Garden armory');
shopPanel.innerHTML=`<header><div><small>RELETTER COLLECTION</small><h2>Garden Armory</h2></div><button id="shop-close" aria-label="Close shop">×</button></header><div class="armory-balance"><span>Equipment · fishing · collections</span><b id="shop-coins"></b></div><div id="equipment-slots"></div><div class="shop-tabs" role="group" aria-label="Shop categories"><button data-tab="all" aria-pressed="true">All</button><button data-tab="weapon">Weapons</button><button data-tab="shield">Shields</button><button data-tab="head">Headwear</button><button data-tab="outfit">Outfits</button><button data-tab="seed">Seeds</button><button data-tab="owned">Owned</button><button data-tab="fishing">Fishing</button><button data-tab="fish-market">Fish market</button></div><p id="shop-feedback" role="status">Hold ATTACK to charge. PvP: up to 2 hits per attack; Lose all HP to drop coins. Leveling increases HP and attack. Shields recharge after no damage.</p><div id="shop-items"></div>`;
document.body.append(shopPanel);let shopTab='all',shopBusy=false,shopSignature='';
function openShop(){if(!admitted)return;claimPanel('shop');shopPanelOpen=true;shopPanel.hidden=false;refreshEquipmentUI(true);reflectPanels();}
shopButton.onclick=()=>shopPanelOpen?(claimPanel('none'),reflectPanels()):openShop();$('shop-close').onclick=()=>{claimPanel('none');reflectPanels();};
for(const btn of shopPanel.querySelectorAll('[data-tab]'))btn.onclick=()=>{shopTab=btn.dataset.tab;refreshEquipmentUI(true);};
window.addEventListener('keydown',e=>{if(e.code==='KeyI'&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();shopButton.click();}if(e.key==='Escape'&&shopPanelOpen){claimPanel('none');reflectPanels();}});
const armoryPaths={swatter:'M30 59V31M15 4h34v28H15ZM22 4v28M30 4v28M38 4v28M15 13h34M15 22h34',pan:'M32 60V40M32 4a18 18 0 1 0 0 36 18 18 0 0 0 0-36Z',planter:'M14 34h36l-6 24H20ZM32 34V8M32 23Q7 1 12 22l20 9M32 17Q55 0 53 18l-21 8',palm:'M30 60 35 18M35 18Q6 1 5 32M35 18Q53 0 61 29M35 18Q30 1 14 6M35 18Q46 9 50 4',water:'M32 7C24 20 16 28 16 39a16 16 0 0 0 32 0C48 28 40 20 32 7Z',ice:'M32 6 48 23 43 48 32 58 21 48 16 23Z M16 23h32M32 6v52M21 48l11-25 11 25',fire:'M33 5C44 24 20 24 34 36 45 30 44 18 44 18c24 32 4 43-12 41C9 57 7 34 21 24c-2 14 5 14 8 11C19 22 32 15 33 5Z',lightning:'M37 5 12 37h17l-3 23 26-35H35Z',beam:'M10 54 53 11M25 13l7-9 7 9-7 10ZM49 35l8 7-8 7-7-7Z',petal:'M32 31C4-5 3 39 31 33 1 52 42 66 33 34 60 63 65 22 34 31 59 5 17-3 32 31Z',wave:'M7 33a25 25 0 0 1 50 0M14 39a18 18 0 0 1 36 0M23 45a9 9 0 0 1 18 0',saber:'M18 47 48 7l8 7-31 39ZM10 47l16 12M10 55l6 5',shield:'M32 5 53 14v19c0 13-13 23-21 27-8-4-21-14-21-27V14ZM32 16v31M21 29h22'};
function itemArt(item){if(['head','outfit','seed'].includes(item.slot))return `<img width=58 height=58 src="${itemIcon(item)}" alt="">`;return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="${(armoryPaths[item.family]||'M12 52 48 12M22 18l22 22M12 50q26-5 38-35')}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;}
function refreshEquipmentUI(force=false){
 const owned=gameView.inventories?.[selectedCharacter]||[],slots=gameView.equipment?.[selectedCharacter]||{},balance=gameView.wallets?.[selectedCharacter]||0;
 if(waterChargeStart===null)waterButton.textContent='ATTACK';
 const signature=JSON.stringify([owned,slots,balance,shopTab,shopBusy,shopTab==='fish-market'?gameView.fishing?.revision:0]);if(!force&&signature===shopSignature)return;shopSignature=signature;
 if(!shopPanelOpen)return;
 $('shop-coins').textContent=balance+' coins';
 $('equipment-slots').innerHTML=['head','outfit','weapon','shield','rod','tool'].map(slot=>{const item=slot==='weapon'?currentWeapon():slot==='head'?activeHead(gameView,selectedCharacter):equipmentById(slots[slot]);return `<div class="equipment-slot"><small>${slot.toUpperCase()}</small><strong>${item?.name||'Empty'}</strong>${slot==='shield'&&item?'<span id="shield-charge"></span>':''}<button data-remove="${slot}" ${!item||item.id==='water'?'disabled':''}>Unequip</button></div>`;}).join('');
 for(const btn of shopPanel.querySelectorAll('[data-tab]'))btn.setAttribute('aria-pressed',String(btn.dataset.tab===shopTab));
 if(shopTab==='fish-market'){const fish=gameView.fishing?.bags?.[selectedCharacter]||[];$('shop-items').innerHTML=fish.length?fish.map(f=>fishCard(f,`<button data-sell-fish="${f.id}">Sell · ${fishPrice(f)}</button>`)).join(''):'<p class="shop-empty">Your catches appear here. Keep favourites in FISH → Collection, or sell them for coins.</p>';return;}
 const items=EQUIPMENT.filter(i=>!i.notForSale).filter(i=>shopTab==='all'||shopTab==='owned'&&owned.includes(i.id)||i.slot===shopTab||shopTab==='fishing'&&['rod','tool','pond'].includes(i.slot));
 $('shop-items').innerHTML=items.length?items.map(item=>{
  const has=item.slot!=='seed'&&owned.includes(item.id),equipped=slots[item.slot]===item.id;
  const stats=['head','outfit','seed'].includes(item.slot)?`<span>${item.description}</span>`:item.family==='rod'?`<span><b>${item.power.toFixed(1)} kg</b> power</span><span><b>${Math.round(item.control*100)}%</b> control</span><span><b>${Math.round(item.luck*100)}%</b> rare affinity</span><span><b>${(item.hookWindow/1000).toFixed(2)}s</b> hook window</span>`:item.family==='chisel'?`<span><b>${item.depth} m</b> water depth</span><span><b>${Math.round(item.redChance*100)}%</b> crimson spring chance</span>`:item.family==='pond'?'<span>Unlocks glass aquariums · choose size in BUILD · 15 / 45 / 100 coins.</span>':item.slot==='shield'?`<span><b>${item.capacity}</b> capacity</span><span><b>${item.recharge}s</b> recharge</span>`:`<span><b>${+(item.damage*currentStats().attackMultiplier).toFixed(2)} → ${+(attackStats(item,1).damage*currentStats().attackMultiplier).toFixed(2)}</b> damage</span><span><b>${item.range} → ${attackStats(item,1).range}m</b> range</span><span><b>${(item.radius*2).toFixed(1)}m</b> width</span><span><b>${(item.cooldown/1000).toFixed(2)}s</b> cooldown</span>`;
  return `<article class="item-card" style="--item-color:${item.color}" data-item="${item.id}"><div class="item-art ${item.family}">${itemArt(item)}<i></i></div><div class="item-info"><small>${item.family.toUpperCase()} · TIER ${item.tier}</small><h3>${item.name}</h3><div class="item-stats">${stats}</div><div class="item-bottom"><span>${has?'OWNED':item.price+' coins'}</span><button data-${has?'equip':'buy'}="${item.id}" ${equipped||shopBusy||!has&&balance<item.price?'disabled':''}>${equipped?'Equipped':has?'Equip':'Buy'}</button></div></div></article>`;
 }).join(''):'<p class="shop-empty">Your collection starts here. Earn coins in the garden, then choose your first piece.</p>';
}
shopPanel.addEventListener('click',async e=>{
 const btn=e.target.closest('[data-buy],[data-equip],[data-remove]');if(!btn||btn.disabled||shopBusy)return;
 const action=btn.dataset.buy?(equipmentById(btn.dataset.buy)?.slot==='seed'?'seed-buy':'buy'):btn.dataset.equip?'equip':'unequip',item=btn.dataset.buy||btn.dataset.equip;
 shopBusy=true;refreshEquipmentUI(true);try{const result=await api('/api/game',{action,item,slot:btn.dataset.remove});if(result.game)receiveGame(result.game);$('shop-feedback').textContent=action==='buy'?'Added to your collection. Choose Equip to use it.':action==='equip'?'Equipped. Ready for the garden.':'Unequipped.';}catch(e){$('shop-feedback').textContent=e.message;}finally{shopBusy=false;refreshEquipmentUI(true);}
});
// Layered glow sprites, tapered ribbons and spark trails; no weapon-gun model.
const equipmentFX=[],equipmentAuras=new Map();
const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;const glowCtx=glowCanvas.getContext('2d'),glowGradient=glowCtx.createRadialGradient(32,32,0,32,32,32);glowGradient.addColorStop(0,'#fff');glowGradient.addColorStop(.2,'#fffc');glowGradient.addColorStop(.55,'#fff4');glowGradient.addColorStop(1,'#fff0');glowCtx.fillStyle=glowGradient;glowCtx.fillRect(0,0,64,64);const equipmentGlow=new THREE.CanvasTexture(glowCanvas);
function glowMaterial(color,opacity=1){return new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});}
function showEquipmentAttack(data){
 if(['saber','whip','swatter','pan','planter','palm'].includes(data.family)){showMeleeAttack(data);return;}
 const origin=new THREE.Vector3(...data.origin),direction=new THREE.Vector3(...data.direction).normalize(),group=new THREE.Group(),color=data.red?'#ff3355':data.color||'#cbbaff';group.position.copy(origin);group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);group.name='Equipment '+data.family;
 let travel=data.range;if(data.impact)travel=Math.min(travel,new THREE.Vector3(...data.impact).distanceTo(origin));else if(data.hit){const target=data.hit==='Auntie'?gameView.boss?.position:data.hit===selectedCharacter?charRoot.position.toArray():[...remotePlayers.values()].find(p=>p.character===data.hit)?.state?.position;if(target)travel=Math.min(travel,Math.max(.5,new THREE.Vector3(...target).distanceTo(origin)-1));}
 const tier=equipmentById(data.weapon)?.tier||1;const count=100+tier*60,positions=new Float32Array(count*3),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));const points=new THREE.Points(geo,new THREE.PointsMaterial({color,map:equipmentGlow,size:(data.family==='fire'?.28:.1)*(1+(tier-1)*.65),transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));points.frustumCulled=false;group.add(points);
 const accents=[];
 for(let k=0;k<(data.family==='fire'?0:tier-1);k++){const path=[];for(let n=0;n<=40;n++){const z=travel*n/40,a=n*.55+k*Math.PI*2/Math.max(1,tier-1),r=data.radius*(.5+k*.15);path.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,z));}const helix=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path),64,.025+tier*.012,5,false),glowMaterial(k%2?'#fff4cf':color,.5));helix.userData.stationary=true;group.add(helix);accents.push(helix);}

 if(data.family==='fire')for(let layer=0;layer<2+tier;layer++){
  const geometry=new THREE.ConeGeometry(data.radius*(.4+layer*.09),travel*(.65+layer*.05),48,24,true);geometry.rotateX(Math.PI/2);geometry.translate(0,0,travel*(.65+layer*.05)/2);
  const material=new THREE.ShaderMaterial({uniforms:{time:{value:0},fade:{value:1},seed:{value:layer*2.7},tint:{value:new THREE.Color(data.red?'#ff1838':layer%2?'#ff4814':'#ffb326')}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  vertexShader:`uniform float time;uniform float seed;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;float a=uv.y;float wobble=sin(a*18.-time*16.+seed)*.15+sin(a*31.-time*23.+seed)*.07;p.x+=wobble*a;p.y+=sin(a*22.-time*18.+seed)*a*.24;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
  fragmentShader:`uniform float time;uniform float seed;uniform float fade;uniform vec3 tint;varying vec2 vUv;void main(){float flow=sin(vUv.y*32.-time*24.+sin(vUv.x*38.+seed)*3.);float tongues=pow(max(0.,sin(vUv.x*31.+sin(vUv.y*12.-time*8.)+seed)),2.);float tail=smoothstep(0.,.18,vUv.y)*(1.-smoothstep(.7,1.,vUv.y));float a=tail*(.12+.18*tongues)*(.65+.35*flow)*fade;vec3 c=mix(tint,vec3(1.,.86,.35),max(0.,flow)*.4);gl_FragColor=vec4(c,a);}`});
  const flame=new THREE.Mesh(geometry,material);flame.userData.stationary=true;flame.userData.flame=true;group.add(flame);accents.push(flame);
 }
 if(data.family==='beam'||data.family==='lightning'){
  const path=[];for(let i=0;i<20;i++){const z=travel*i/19,offset=data.family==='lightning'&&i>0&&i<19?Math.sin(i*14.2)*.12:0;path.push(new THREE.Vector3(offset,Math.sin(i*9.4)*Math.abs(offset),z));}
  const curve=new THREE.CatmullRomCurve3(path);for(const [width,opacity] of [[.012,.85],[.04,.26],[.09,.09]]){const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,40,width*(1+data.charge)*(1+(tier-1)*2.5),6,false),glowMaterial(width===.012?'#e8eeff':color,opacity));group.add(mesh);accents.push(mesh);}
 }else{
  const mesh=data.family==='fire'?new THREE.Sprite(new THREE.SpriteMaterial({map:equipmentGlow,color,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending})):data.family==='ice'?new THREE.Mesh(new THREE.OctahedronGeometry(.28+data.charge*.15),new THREE.MeshPhongMaterial({color,emissive:color,emissiveIntensity:.5,shininess:100,transparent:true,opacity:.9})):new THREE.Mesh(new THREE.TorusGeometry(.5,.035,8,48),glowMaterial(color,.8));group.add(mesh);accents.push(mesh);
 }
 if(data.family==='petal')for(let i=0;i<12;i++){const petal=new THREE.Mesh(new THREE.SphereGeometry(.13,8,5),new THREE.MeshBasicMaterial({color:i%2?'#ffc7e7':color,transparent:true,opacity:.75,depthWrite:false}));petal.scale.set(.5,1,1.6);petal.userData.petal=i+1;group.add(petal);accents.push(petal);}
 const impact=new THREE.Sprite(new THREE.SpriteMaterial({map:equipmentGlow,color,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));impact.position.z=travel;group.add(impact);
 for(const m of accents)m.userData.baseOpacity=m.material.opacity;
 scene.add(group);equipmentFX.push({group,points,accents,impact,data,travel,age:0,duration:data.contactDelay?data.contactDelay/1000*1.7:data.family==='saber'?.55:1.05});
}
function updateEquipmentEffects(dt){
 updateUltimateEffects(dt);updateSignatureEffects(dt);updateMeleeEffects(dt);updateCrosshair();updateAdventure(dt);updateConstructionDamage(dt);updateCombatAura(dt);
 const chargeLabel=$('shield-charge'),guard=resolveItem(gameView,selectedCharacter,gameView.equipment?.[selectedCharacter]?.shieldInstance||gameView.equipment?.[selectedCharacter]?.shield),guardState=gameView.shields?.[selectedCharacter];
 if(chargeLabel&&guard){const left=guardState?Math.max(0,Math.ceil(guard.recharge-(Date.now()-guardState.lastHit)/1000)):0;chargeLabel.textContent=left?Math.max(0,guard.capacity-guardState.used).toFixed(1)+' / '+guard.capacity+' · '+left+'s':guard.capacity+' / '+guard.capacity+' · Ready';}

 for(let j=equipmentFX.length-1;j>=0;j--){const fx=equipmentFX[j];fx.age+=dt;const u=fx.age/fx.duration,attr=fx.points.geometry.attributes.position,f=fx.data.family,charge=fx.data.charge||0,head=Math.min(1,u*1.7)*fx.travel;
  for(let i=0;i<attr.count;i++){const t=i/attr.count,a=i*2.39996+u*5,r=(f==='wave'?fx.data.radius: .12+fx.data.radius*.45)*Math.sqrt(t),trail=Math.max(0,head-t*(f==='fire'?5:3));let x=Math.cos(a)*r,y=Math.sin(a)*r,z=trail;
   if(f==='petal'){x=Math.sin(t*22-u*9)*(r+.5);y=Math.cos(t*16+u*6)*r;}
   if(f==='saber'){const theta=-.9+t*1.8+u*.5;x=Math.sin(theta)*fx.travel;y=Math.sin(t*22)*.08;z=Math.cos(theta)*fx.travel;}
   if(f==='wave'){x=Math.cos(a)*r*(.5+u*2);y=Math.sin(a)*r*(.5+u*2);z=head+Math.sin(a*3)*.12;}
   if(f==='fire')y+=t*t*.6;
   attr.setXYZ(i,x,y,z);
  }attr.needsUpdate=true;fx.points.material.opacity=Math.max(0,(1-u)*(f==='fire'?.28:.6));
  for(const m of fx.accents){if(m.userData.flame){m.material.uniforms.time.value=fx.age;m.material.uniforms.fade.value=Math.max(0,1-u);continue;}if(!m.userData.stationary&&!['beam','lightning','saber'].includes(f)){m.position.z=head;if(m.userData.petal){const a=m.userData.petal*2.39996+u*7;m.position.set(Math.cos(a)*(.3+u),Math.sin(a)*(.3+u),Math.max(0,head-m.userData.petal*.2));}m.rotation.z+=dt*3;if(!m.userData.petal)m.scale.setScalar(f==='wave'?1+u*fx.data.radius*2:(1+charge)*(1+(equipmentById(fx.data.weapon)?.tier||1)*.45));}if(f==='saber')m.rotation.z+=dt*2.8;m.material.opacity=Math.max(0,(1-u)*(m.userData.baseOpacity??.5));}
  const hitT=Math.max(0,(u-.55)/.45);fx.impact.material.opacity=hitT>0?(1-hitT)*.8:0;fx.impact.scale.setScalar((.4+hitT*3)*(1+charge));
  if(u>=1){scene.remove(fx.group);fx.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});equipmentFX.splice(j,1);}
 }
 const players=[{character:selectedCharacter,root:charRoot,model:charModel},...[...remotePlayers.values()]],active=new Set();
 for(const p of players){if(!admitted||!p.root?.visible)continue;const slots=gameView.equipment?.[p.character]||{},shield=equipmentById(slots.shield),weapon=equipmentById(slots.weapon);const key=p.character;active.add(key);let aura=equipmentAuras.get(key),signature=(shield?.id||'')+':'+(['saber','whip','swatter','pan','planter','palm'].includes(weapon?.family)?weapon.id:'');
  if(aura&&aura.userData.signature!==signature){scene.remove(aura);aura.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});equipmentAuras.delete(key);aura=null;}
  if(!aura&&signature!==':'){
   aura=new THREE.Group();aura.userData.signature=signature;aura.name='Equipment aura '+key;
   if(shield){const bubble=new THREE.Mesh(new THREE.SphereGeometry(1.35,32,20),new THREE.ShaderMaterial({uniforms:{tint:{value:new THREE.Color(shield.color)},pulse:{value:0}},vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'uniform vec3 tint;uniform float pulse;varying vec3 n;varying vec3 v;void main(){float rim=pow(1.0-abs(dot(normalize(n),normalize(v))),2.5);gl_FragColor=vec4(tint,(.04+rim*.55)*pulse);}',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));bubble.position.y=1;aura.add(bubble);aura.userData.bubble=bubble;const ring=new THREE.Mesh(new THREE.TorusGeometry(1.1,.015,6,64),glowMaterial(shield.color,.5));ring.rotation.x=Math.PI/2;ring.position.y=.08;aura.add(ring);aura.userData.ring=ring;}
   if(['saber','whip','swatter','pan','planter','palm'].includes(weapon?.family)){const blade=makeHeldWeapon(weapon);aura.add(blade);aura.userData.blade=blade;}
   scene.add(aura);equipmentAuras.set(key,aura);
  }
  if(aura){aura.position.copy(p.root.position);aura.rotation.y=gameplayHeading(p.model);if(shield){const state=gameView.shields?.[key],ready=!state||Date.now()-state.lastHit>=shield.recharge*1000,remaining=ready?1:Math.max(0,1-state.used/shield.capacity);aura.userData.bubble.material.uniforms.pulse.value=remaining*(.8+Math.sin(globalTime*2)*.2);aura.userData.ring.material.opacity=remaining*.5;}}
 }
 for(const [key,aura] of equipmentAuras)if(!active.has(key)){scene.remove(aura);aura.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});equipmentAuras.delete(key);}
}

// ===== Character-facing shooting; camera aiming supplies elevation only =====
const aimReticle=document.createElement('div');aimReticle.id='aim-reticle';aimReticle.hidden=true;aimReticle.setAttribute('aria-hidden','true');aimReticle.innerHTML='<i></i><b></b>';document.body.append(aimReticle);
// Aim against gameplay volumes, never deform and scan every skinned triangle.
const aimRay=new THREE.Raycaster(),aimCenter=new THREE.Vector2(),aimBox=new THREE.Box3(),aimSphere=new THREE.Sphere(),aimHit=new THREE.Vector3(),aimGround=new THREE.Plane(new THREE.Vector3(0,1,0),0);
function cameraElevationAim(){
 const origin=charRoot.position.clone().add(new THREE.Vector3(0,1,0));camera.updateMatrixWorld();aimRay.setFromCamera(aimCenter,camera);aimRay.far=250;
 const ray=aimRay.ray,minDistance=camera.position.distanceTo(origin)*.3;
 let point=ray.at(150,new THREE.Vector3()),nearest=150;
 const accept=hit=>{if(!hit)return;const distance=hit.distanceTo(ray.origin);if(distance>minDistance&&distance<nearest){nearest=distance;point.copy(hit);}};
 // Built meshes are simple primitives; only their transforms need updating.
 for(const mesh of buildMeshes.values()){mesh.updateMatrixWorld();const hits=aimRay.intersectObject(mesh,false);for(const hit of hits)accept(hit.point);}
 for(const monster of monsters){if(!monster.root.visible)continue;const p=monster.root.position;aimBox.min.set(p.x-2.8,p.y,p.z-2.8);aimBox.max.set(p.x+2.8,p.y+12,p.z+2.8);accept(ray.intersectBox(aimBox,aimHit));}
 for(const player of remotePlayers.values()){if(!player.root.visible)continue;aimSphere.center.copy(player.root.position);aimSphere.center.y+=1;aimSphere.radius=1.25;accept(ray.intersectSphere(aimSphere,aimHit));}
 const ground=ray.intersectPlane(aimGround,aimHit);if(ground&&ground.distanceTo(ray.origin)<nearest)point.copy(ground);
 let direction=point.clone().sub(origin).normalize();if(direction.dot(ray.direction)<.1)direction=ray.direction.clone();
 return {direction,point,inRange:origin.distanceTo(point)<=currentWeapon().range+currentWeapon().chargeRange*waterCharge()};
}
function rangedAim(charge=waterCharge()){
 // Preserve the established vertical aiming/parallax, but never borrow camera yaw.
 const cameraDirection=cameraElevationAim().direction,heading=gameplayHeading(charModel),vertical=THREE.MathUtils.clamp(cameraDirection.y,charge>=1&&charRoot.position.y<5?0:-.98,.98),horizontal=Math.sqrt(1-vertical*vertical);
 const direction=new THREE.Vector3(Math.sin(heading)*horizontal,vertical,Math.cos(heading)*horizontal),origin=charRoot.position.clone().add(new THREE.Vector3(0,1,0));
 const weapon=currentWeapon(),range=attackStats(weapon,charge).range;aimRay.set(origin,direction);aimRay.far=range;
 const ray=aimRay.ray,point=ray.at(range,new THREE.Vector3());let nearest=range,hitTarget=false;
 const accept=hit=>{if(!hit)return;const d=origin.distanceTo(hit);if(d>.01&&d<=nearest){nearest=d;point.copy(hit);hitTarget=true;}};
 for(const mesh of buildMeshes.values()){mesh.updateMatrixWorld();for(const hit of aimRay.intersectObject(mesh,false))accept(hit.point);}
 for(const monster of monsters){if(!monster.root.visible)continue;const p=monster.root.position;aimBox.min.set(p.x-2.8,p.y,p.z-2.8);aimBox.max.set(p.x+2.8,p.y+12,p.z+2.8);accept(ray.intersectBox(aimBox,aimHit));}
 for(const player of remotePlayers.values()){if(!player.root.visible)continue;aimSphere.center.copy(player.root.position);aimSphere.center.y+=1;aimSphere.radius=1.25;accept(ray.intersectSphere(aimSphere,aimHit));}
 accept(ray.intersectPlane(aimGround,aimHit));
 return {direction,point,inRange:hitTarget};
}
let cachedReticleAim=null,reticleSampleAt=0;
function updateCrosshair(){
 aimReticle.hidden=!admitted||!connected||phase!==PHASE.EXPLORE||meleeFamilies.includes(currentWeapon().family)||document.body.dataset.panel!=='none'||monsterDeathActive;
 if(!aimReticle.hidden){
  const now=performance.now();if(!cachedReticleAim||now-reticleSampleAt>=100){cachedReticleAim=rangedAim();reticleSampleAt=now;}
  const aim=cachedReticleAim,screen=aim.point.clone().project(camera);
  // A fixed screen-centre crosshair would advertise a direction the weapon does not fire.
  aimReticle.hidden=screen.z< -1||screen.z>1||Math.abs(screen.x)>.98||Math.abs(screen.y)>.98;
  aimReticle.style.left=((screen.x+1)*50)+'%';aimReticle.style.top=((1-screen.y)*50)+'%';
  aimReticle.classList.toggle('in-range',aim.inRange);aimReticle.style.setProperty('--charge',String(waterCharge()));
 }
}
// Suppress browser gestures, while keeping one-finger panel scrolling and editable inputs usable.
for(const event of ['gesturestart','gesturechange','gestureend'])document.addEventListener(event,e=>e.preventDefault(),{passive:false});
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
document.addEventListener('selectstart',e=>{if(!(e.target.closest?.('input,textarea')||e.target.parentElement?.closest('input,textarea')))e.preventDefault();});
document.addEventListener('contextmenu',e=>{if(!(e.target.closest?.('input,textarea')||e.target.parentElement?.closest('input,textarea')))e.preventDefault();});

// ===== Layered saber choreography: shared combo index, tapered ribbons and skeletal poses =====
const meleeEffects=[],meleePoseRestore=[];
const slashNames=['Dawn cleave','Reverse crescent','Horizon cut','Rising star','Twin cross','Spiral finale','Astral bloom'];
const slashOuter=new THREE.Vector3(),slashInner=new THREE.Vector3(),slashSpark=new THREE.Vector3();
function slashPoint(stroke,t,radius,out){const angle=stroke.start+(stroke.end-stroke.start)*t,x=Math.sin(angle)*radius;return out.set(x*Math.cos(stroke.tilt),x*Math.sin(stroke.tilt)+(stroke.lift||0),Math.cos(angle)*radius);}
function slashRibbon(color,opacity){
 const geo=new THREE.BufferGeometry(),n=64,position=new Float32Array((n+1)*6),uv=new Float32Array((n+1)*4),indices=[];
 for(let i=0;i<=n;i++){uv.set([i/n,0,i/n,1],i*4);if(i<n){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}geo.setAttribute('position',new THREE.BufferAttribute(position,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(indices);
 const material=new THREE.ShaderMaterial({uniforms:{tint:{value:new THREE.Color(color)},fade:{value:opacity},time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec2 vUv;uniform vec3 tint;uniform float fade;uniform float time;
 void main(){float edge=pow(max(0.0,sin(vUv.y*3.14159)),1.3);float tail=pow(vUv.x,.65);float filament=pow(max(0.0,1.0-abs(vUv.y-.8)*13.0),3.0);float shimmer=.85+.15*sin(vUv.x*50.0-time*12.0);vec3 c=mix(tint,vec3(.92,.96,1.0),filament*.5);gl_FragColor=vec4(c,fade*edge*tail*shimmer);}`,transparent:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
 const mesh=new THREE.Mesh(geo,material);mesh.frustumCulled=false;return mesh;
}
function showMeleeAttack(data){
 const combo=Math.max(0,Math.min(6,data.combo||0)),charged=combo===6,group=new THREE.Group(),color=data.color||'#a77bff';group.position.fromArray(data.origin);group.rotation.y=Math.atan2(data.direction[0],data.direction[2]);group.name=data.family+' '+(meleeMoveNames[data.family]||slashNames)[combo];
 const patterns=[[[.7,-1.25,1.25,0]], [[-.7,1.25,-1.25,0]], [[.08,-1.45,1.45,0]], [[1.45,-1.3,1.3,0]], [[.8,-1.3,1.3,0],[-.8,1.3,-1.3,.22]], [[.18,-1.5,1.5,0],[-.25,1.5,-1.5,.2]], [[.75,-1.5,1.5,0],[-.75,1.5,-1.5,.18],[.02,-1.6,1.6,.36]]];
 const strokes=meleeTrailPattern(data.family,combo).map(([tilt,start,end,delay],i)=>{const ribbon=slashRibbon(color,.52),filament=slashRibbon(i%2?'#ffd4ec':'#c9deff',.36);group.add(ribbon,filament);return {tilt: data.family==='whip'?tilt*1.3:tilt,start,end,delay:delay+meleeDuration(data.family,combo)*(['pan','planter','palm'].includes(data.family)?.33:.24),lift:0,ribbon,filament};});
 const tier=equipmentById(data.weapon)?.tier||1;const count=(charged?150:80)+tier*45,geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));const sparks=new THREE.Points(geometry,new THREE.PointsMaterial({map:equipmentGlow,color,size:charged?.11:.07,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending}));sparks.frustumCulled=false;group.add(sparks);
 const sigil=new THREE.Group();sigil.position.y=-.92;const radius=data.range*.8;for(let j=0;j<3;j++){const ring=new THREE.Mesh(new THREE.RingGeometry(radius*(.45+j*.16),radius*(.45+j*.16)+.018+tier*.009,96),glowMaterial(color,.28));ring.rotation.x=-Math.PI/2;sigil.add(ring);}
 const vertices=[];for(let i=0;i<12;i++){const a=i*Math.PI/6,r=radius*.8;vertices.push(Math.cos(a)*r,0,Math.sin(a)*r,Math.cos(a+.13)*(r-.18),0,Math.sin(a+.13)*(r-.18),Math.cos(a+.13)*(r-.18),0,Math.sin(a+.13)*(r-.18),Math.cos(a+.21)*r,0,Math.sin(a+.21)*r);}
 const runeGeo=new THREE.BufferGeometry();runeGeo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));sigil.add(new THREE.LineSegments(runeGeo,new THREE.LineBasicMaterial({color,transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending})));group.add(sigil);
 const flash=new THREE.Sprite(new THREE.SpriteMaterial({map:equipmentGlow,color,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));flash.position.set(0,0,Math.min(radius,2.5));group.add(flash);scene.add(group);
 sigil.visible=data.family==='saber';const waves=[];for(let i=0;i<(data.family==='saber'?Math.ceil(tier/2):0);i++){const wave=new THREE.Mesh(new THREE.RingGeometry(.84,1,48,1,.15,Math.PI*1.65),glowMaterial(i%2?'#fff0d2':color,.5));wave.rotation.z=combo*.65+i*.9;group.add(wave);waves.push(wave);}
 if(!data.ultimate)showSignatureBurst(data);
 meleeEffects.push({group,strokes,sparks,sigil,flash,waves,combo,data,age:0,radius:data.range,duration:meleeDuration(data.family,combo)+.35});
}
function updateMeleeEffects(dt){
 for(let j=meleeEffects.length-1;j>=0;j--){const fx=meleeEffects[j];fx.age+=dt;const life=fx.age/fx.duration;
  for(const stroke of fx.strokes){const swing=THREE.MathUtils.clamp((fx.age-stroke.delay)/(meleeDuration(fx.data.family,fx.combo)*.4),0,1),head=1-Math.pow(1-swing,3),fade=Math.max(0,1-Math.max(0,fx.age-stroke.delay-.14)/.32);
   for(const [mesh,thin] of [[stroke.ribbon,false],[stroke.filament,true]]){const attr=mesh.geometry.attributes.position;for(let i=0;i<=64;i++){const t=i/64,progress=Math.max(0,head-(1-t)*.48),taper=Math.sin(Math.PI*t)*(.5+(equipmentById(fx.data.weapon)?.tier||1)*.12+fx.data.charge*.35),r=fx.radius*(thin?1.025:1);const outer=slashPoint(stroke,progress,r,slashOuter),inner=slashPoint(stroke,progress,r-(thin?.025:taper),slashInner);attr.setXYZ(i*2,inner.x,inner.y,inner.z);attr.setXYZ(i*2+1,outer.x,outer.y,outer.z);}attr.needsUpdate=true;mesh.material.uniforms.fade.value=(thin?.32:.5)*fade*(swing>0?1:0);mesh.material.uniforms.time.value=fx.age;}
  }
  const attr=fx.sparks.geometry.attributes.position;for(let i=0;i<attr.count;i++){const stroke=fx.strokes[i%fx.strokes.length],t=i/attr.count,age=Math.max(0,fx.age-stroke.delay-t*.25),point=slashPoint(stroke,t,fx.radius*(.8+.2*Math.sin(i*7)),slashSpark);point.x+=Math.sin(i*12.1)*age*.8;point.z+=Math.cos(i*4.7)*age*.8;point.y+=(1.4+(i%7)*.23)*age+age*age*.5;attr.setXYZ(i,point.x,point.y,point.z);}attr.needsUpdate=true;fx.sparks.material.opacity=Math.max(0,Math.sin(Math.min(1,life)*Math.PI)*.55);
  for(let i=0;i<fx.waves.length;i++){const t=Math.max(0,Math.min(1,(fx.age-i*.055)/.48)),wave=fx.waves[i];wave.position.set(0,.2,fx.radius*t*.85);wave.scale.setScalar((.35+t*.65)*Math.min(3.8,fx.radius*.35));wave.material.opacity=Math.sin(t*Math.PI)*.52;wave.rotation.z+=dt*(i%2?-1.4:1.4);}
  fx.sigil.rotation.y=fx.age*(fx.combo%2?-.5:.5);fx.sigil.scale.setScalar(.85+Math.sin(Math.min(1,life)*Math.PI)*.18);fx.sigil.traverse(o=>{if(o.material)o.material.opacity=Math.sin(Math.min(1,life)*Math.PI)*(fx.combo===6?.6:.28);});
  const impact=Math.max(0,1-Math.abs(fx.age-meleeDuration(fx.data.family,fx.combo)*.5)*8);fx.flash.material.opacity=impact*(fx.data.hit?.5:.16);fx.flash.scale.setScalar(.3+impact*(fx.combo===6?2:1));
  if(life>=1){scene.remove(fx.group);fx.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});meleeEffects.splice(j,1);}
 }
}
const meleePositionRestore=[];
function restoreMeleePoses(){for(const [object,position] of meleePositionRestore)object.position.copy(position);meleePositionRestore.length=0;for(const [bone,quaternion] of meleePoseRestore)bone.quaternion.copy(quaternion);meleePoseRestore.length=0;}
function applyMeleePoses(){
 const players=[{character:selectedCharacter,model:charModel},...[...remotePlayers.values()]];
 for(const player of players){if(!player.model)continue;const fx=[...meleeEffects].reverse().find(f=>f.data.shooter===player.character&&f.age<meleeDuration(f.data.family,f.combo)),aura=equipmentAuras.get(player.character),blade=aura?.userData.blade;
  if(fishingPoseFor(player.character)){if(blade)blade.visible=false;continue;}
  if(fx){const pose=sampleMeleePose(fx.data.family,fx.combo,fx.age),model=player.model;
   meleePositionRestore.push([model,model.position.clone()]);const offset=new THREE.Vector3(...pose.offset).applyAxisAngle(new THREE.Vector3(0,1,0),model.rotation.y);model.position.add(offset);
   meleePoseRestore.push([model,model.quaternion.clone()]);model.rotateY(pose.turn);model.rotateX(pose.bones.Spine2[0]*.35);model.rotateZ(pose.bones.Spine2[2]*.3);
   model.traverse(bone=>{if(!bone.isBone)return;const name=bone.name.replace(/[^a-z0-9]/gi,'').replace(/^mixamorig\d*/,''),angles=pose.bones[name];if(!angles)return;meleePoseRestore.push([bone,bone.quaternion.clone()]);bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles)));});
  }
  if(blade){attachHeldWeapon(player,aura,blade,fx);if(fx&&(['planter','palm'].includes(fx.data.family)||fx.combo===6&&fx.data.family==='saber')){const target=blade.localToWorld(new THREE.Vector3(0,fx.data.family==='planter'?.25:.18,.02));supportOffhand(player.model,target,Math.sin(Math.min(1,fx.age/meleeDuration(fx.data.family,fx.combo))*Math.PI)*.8);}}
 }
}
function supportOffhand(model,target,strength){
 const bones=fishingBones(model),hand=bones.LeftHand;if(!hand)return;model.updateMatrixWorld(true);
 for(let i=0;i<3;i++)for(const bone of [bones.LeftForeArm,bones.LeftArm]){if(!bone)continue;const origin=bone.getWorldPosition(new THREE.Vector3()),actual=hand.getWorldPosition(new THREE.Vector3()).sub(origin),desired=target.clone().sub(origin);if(actual.lengthSq()<1e-8||desired.lengthSq()<1e-8)continue;const delta=new THREE.Quaternion().setFromUnitVectors(actual.normalize(),desired.normalize());delta.slerp(new THREE.Quaternion(),1-strength);const world=bone.getWorldQuaternion(new THREE.Quaternion()),parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(parent.multiply(delta).multiply(world));bone.updateMatrixWorld(true);}
}

let heldSignature=null;const signatureBursts=[];
function showSignatureBurst(data){
 const item=equipmentById(data.weapon)||{...DEFAULT_WEAPON,family:data.family||'water'},fx=createWeaponSignature(THREE,item,'burst');fx.root.position.fromArray(data.origin);fx.root.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...data.direction).normalize());fx.root.position.addScaledVector(new THREE.Vector3(...data.direction),Math.min(data.range*.3,3));fx.duration=(data.charge||0)>=.65?1.05:.55;fx.power=(data.charge||0)>=.65?1.5:.8;scene.add(fx.root);signatureBursts.push(fx);while(signatureBursts.length>6)disposeWeaponSignature(signatureBursts.shift());
}
const fusionEchoes=[];
function showFusionEcho(data){const fx=createFusionEcho(THREE,data);if(!fx)return;scene.add(fx.root);fusionEchoes.push(fx);while(fusionEchoes.length>8)disposeFusionEcho(fusionEchoes.shift());}
function updateSignatureEffects(dt){
 for(let i=fusionEchoes.length-1;i>=0;i--){const fx=fusionEchoes[i];if(updateFusionEcho(THREE,fx,dt)){disposeFusionEcho(fx);fusionEchoes.splice(i,1);}}
 const item=currentWeapon(),charging=waterChargeStart!==null&&waterCharge()>.06;
 if(heldSignature&&(!charging||heldSignature.weapon!==item.id)){disposeWeaponSignature(heldSignature);heldSignature=null;}
 if(charging){if(!heldSignature){heldSignature=createWeaponSignature(THREE,item);heldSignature.weapon=item.id;scene.add(heldSignature.root);}heldSignature.root.position.copy(charRoot.position).add(new THREE.Vector3(0,1.1,0));heldSignature.root.rotation.y=gameplayHeading(charModel);updateWeaponSignature(THREE,heldSignature,globalTime,waterCharge());}
 for(let i=signatureBursts.length-1;i>=0;i--){const fx=signatureBursts[i];fx.age+=dt;if(fx.age>=fx.duration){disposeWeaponSignature(fx);signatureBursts.splice(i,1);continue;}updateWeaponSignature(THREE,fx,fx.age,fx.age/fx.duration);fx.root.scale.multiplyScalar(fx.power);}
}

const ultimateEffects=[];
function showUltimateAttack(data){
 if(data.weapon==='chiang-token')return;
 const item=equipmentById(data.weapon)||DEFAULT_WEAPON,fx=createUltimate(THREE,item,data);scene.add(fx.root);ultimateEffects.push(fx);
 while(ultimateEffects.length>3)disposeUltimate(ultimateEffects.shift());
}
function updateUltimateEffects(dt){for(let i=ultimateEffects.length-1;i>=0;i--){const fx=ultimateEffects[i];updateUltimate(THREE,fx,dt);if(fx.age>=fx.duration){disposeUltimate(fx);ultimateEffects.splice(i,1);}}}

const ultimateWarmup=prepareUltimates(THREE,renderer,camera).catch(error=>console.warn("Spell preparation",error));

let statsCache=null,statsGame=null,statsFrame=-1,statsCharacter=null;
function currentStats(){if(statsGame!==gameView||statsFrame!==globalTime||statsCharacter!==selectedCharacter){statsGame=gameView;statsFrame=globalTime;statsCharacter=selectedCharacter;statsCache=playerStats(gameView,selectedCharacter);}return statsCache;}
const progressionHud=document.createElement('div');progressionHud.id='player-progression';progressionHud.hidden=true;document.body.append(progressionHud);
function refreshProgression(){const p=currentStats(),hp=Math.max(0,p.maxHp-(gameView.hits?.[selectedCharacter]||0));refreshHeartHud(hp,p.maxHp);progressionHud.hidden=!admitted;progressionHud.textContent=`LV ${p.level} · XP ${p.xp} / ${p.nextXp}`;progressionHud.style.setProperty('--xp',`${p.xp/p.nextXp*100}%`);progressionHud.title=`Attack ×${p.attackMultiplier.toFixed(2)} · Speed ×${p.speedMultiplier.toFixed(3)} · Jump ×${p.jumpMultiplier.toFixed(3)}`;}

// A small CSS 3D HUD shares the main animation clock through compositor transforms.
const heartHud=document.createElement('div');heartHud.id='player-hearts';heartHud.hidden=true;heartHud.setAttribute('role','meter');heartHud.setAttribute('aria-label','Player health');document.body.append(heartHud);
const heartCss=document.createElement('style');heartCss.textContent=`#player-hearts{position:fixed;top:8px;right:12px;z-index:185;display:flex;align-items:center;gap:7px;pointer-events:none;font:12px sans-serif;color:#602540;background:#fff9;border-radius:16px;padding:4px 9px;perspective:170px}#player-hearts[hidden]{display:none}#player-hearts .heart-solid{position:relative;width:28px;height:30px;transform-style:preserve-3d;animation:heart-turn 5s linear infinite}#player-hearts svg{position:absolute;inset:0;width:28px;height:30px;transform:translateZ(var(--depth));filter:drop-shadow(0 1px 1px #78253a66)}#player-hearts b{white-space:nowrap;font-weight:500}#title{left:12px!important;transform:none!important;width:calc(100vw - 170px)!important;max-width:520px!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left!important;font-size:clamp(18px,4vw,30px)!important}body.keyboard-open #player-hearts{visibility:hidden}@keyframes heart-turn{from{transform:rotateY(0deg) rotateZ(-8deg)}to{transform:rotateY(360deg) rotateZ(-8deg)}}@media(prefers-reduced-motion:reduce){#player-hearts .heart-solid{animation:none;transform:rotateY(25deg)}}`;document.head.append(heartCss);
let heartSignature='';
function refreshHeartHud(hp,max){if(typeof heartHud==='undefined')return;heartHud.hidden=!admitted;const value=+hp.toFixed(2),signature=`${value}/${max}`;if(heartSignature===signature)return;heartSignature=signature;heartHud.setAttribute('aria-valuemin','0');heartHud.setAttribute('aria-valuemax',String(max));heartHud.setAttribute('aria-valuenow',String(value));const ratio=Math.max(0,Math.min(1,hp/max));heartHud.innerHTML='<span class="heart-solid" aria-hidden="true">'+Array.from({length:9},(_,i)=>`<svg viewBox="0 0 32 32" style="--depth:${i-4}px"><path fill="${i===8?'#ff759e':i===0?'#c52e65':'#a32453'}" d="M16 29C12 25 1 18 1 10C1 1 12 0 16 7C20 0 31 1 31 10C31 18 20 25 16 29Z"/><path fill="#d9d2de" d="M16 29C12 25 1 18 1 10C1 1 12 0 16 7C20 0 31 1 31 10C31 18 20 25 16 29Z" style="clip-path:inset(0 0 ${ratio*100}% 0)"/>${i===8?'<path d="M6 11C5 6 11 5 13 8" fill="none" stroke="#ffe3ed" stroke-width="2.4" stroke-linecap="round"/>':''}</svg>`).join('')+`</span><b>${value} / ${max}</b>`;}

let lastDeathNotice=0;function receiveDeathPenalty(){const d=gameView.deaths?.[selectedCharacter];if(!d||d.time<=lastDeathNotice)return;lastDeathNotice=d.time;if(admitted&&Date.now()-d.time<5000)centerNotice(`DEFEATED · −${d.xp} XP · −${d.coins} COINS`);}
