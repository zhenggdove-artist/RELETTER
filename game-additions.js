// Runs inside the original game's module, sharing its scene and plant lifecycle.
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
  updateWater(dt);
  for(const p of remotePlayers.values()){
    if(!p.model&&originalCharacterTemplate){p.model=SkeletonUtils.clone(originalCharacterTemplate);tintModel(p.model,p.character);p.root.add(p.model);p.mixer=new THREE.AnimationMixer(p.model);p.action=null;}
    if(!p.state)continue;
    const target=new THREE.Vector3(...p.state.position);p.root.position.lerp(target,Math.min(1,dt*12));if(p.model)p.model.rotation.y=p.state.rotation;p.root.visible=p.state.visible;
    if(p.previous&&target.distanceTo(p.previous)>.02)p.movingUntil=performance.now()+180;const moving=performance.now()<(p.movingUntil||0);p.previous=target;
    const clip=p.state.phase===PHASE.DRINK?clipDrink:p.state.phase===PHASE.FALL?clipFall:moving?clipWalk:clipIdle;
    if(clip&&p.mixer&&p.clip!==clip){p.action?.fadeOut(.2);p.action=p.mixer.clipAction(clip);p.action.reset().fadeIn(.2).play();p.clip=clip;}p.mixer?.update(dt);
  }
}
function updateRoster(players){
  const ids=new Set(players.filter(p=>p.id!==selfId).map(p=>p.id));
  for(const [id,p] of remotePlayers)if(!ids.has(id)){scene.remove(p.root);p.root.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});remotePlayers.delete(id);}
  for(const p of players)if(p.id!==selfId){if(!remotePlayers.has(p.id)){const root=new THREE.Group();root.visible=false;root.add(makeName(p.character));scene.add(root);remotePlayers.set(p.id,{root,character:p.character});}remotePlayers.get(p.id).state=p.state;}
  message(players.length===2?'2 / 2 online · Enter to chat':'1 / 2 online · Waiting for a friend');
}
function receive(type,data){
  if(type==='welcome'){selfId=data.id;connected=true;updateRoster(data.players);api('/api/chat',undefined,'GET').then(history=>{history.forEach(appendChat);latestChat();}).catch(e=>message(e.message));if(admitted)loadEntries().then(es=>es.forEach(e=>addStoredPlant(e))).catch(e=>message(e.message));}
  if(type==='players')updateRoster(data);
  if(type==='state'&&data.id!==selfId&&remotePlayers.has(data.id))remotePlayers.get(data.id).state=data.state;
  if(type==='plant'&&data.sender!==selfId)addStoredPlant(data,true);
  if(type==='deleted'){const i=plantEntries.findIndex(p=>p.entryId===data.id);if(i>=0){plantRoot.remove(plantEntries[i].mesh);plantEntries.splice(i,1);hidePlantLabel();}}
  if(type==='chat')appendChat(data);if(type==='game')receiveGame(data);if(type==='water')showWater(data);
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
  try{await openConnection(btn.dataset.character);selectedCharacter=btn.dataset.character;receiveGame(gameView);admitted=true;dock.hidden=false;$('chat-open').hidden=false;$('water-gun').hidden=false;$('chat-minimize').hidden=false;charRoot.position.x=selectedCharacter==='Ely'?-1.5:1.5;$('entry-gate').remove();$('username').value=selectedCharacter;resolveEntryGate();}
  catch(e){$('gate-error').textContent=e.message;document.querySelectorAll('[data-character]').forEach(b=>b.disabled=false);}
};
function suspendConnection(){if(!admitted)return;pageSuspended=true;clearTimeout(reconnectTimer);const socket=onlineSocket;onlineSocket=null;connected=false;socket?.close(1000,'Page hidden');fetch('/api/disconnect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({connectionId}),keepalive:true}).catch(()=>{});}
window.addEventListener('pagehide',suspendConnection);
document.addEventListener('visibilitychange',()=>{if(window.RELETTER_TRANSPORT!=='websocket')return;if(document.hidden)suspendConnection();else if(admitted){pageSuspended=false;openCloudConnection(selectedCharacter).catch(e=>{message(e.message);queueReconnect();});}});
let lastOnlineState='';
setInterval(()=>{
  if(!connected||!admitted)return;
  const state={position:charRoot.position.toArray(),rotation:charModel?.rotation.y||0,visible:charRoot.visible,phase};
  if(onlineSocket?.readyState===1){const serialized=JSON.stringify(state);if(serialized!==lastOnlineState){onlineSocket.send(JSON.stringify({type:'state',data:state}));lastOnlineState=serialized;}}
  else api('/api/state',state).catch(()=>{});
},100);
const draw=$('drawing'),ctx=draw.getContext('2d');let drawing=false,hasDrawing=false;const drawingUndo=[];function saveDrawingStep(){drawingUndo.push({pixels:ctx.getImageData(0,0,draw.width,draw.height),hasDrawing});if(drawingUndo.length>30)drawingUndo.shift();$('undo-drawing').disabled=false;}
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
draw.onpointerdown=e=>{saveDrawingStep();drawing=true;draw.setPointerCapture(e.pointerId);ctx.beginPath();ctx.moveTo(...point(e));ctx.lineWidth=+$('brush-size').value;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=$('brush-color').value;ctx.lineTo(...point(e).map(v=>v+.01));ctx.stroke();hasDrawing=true;e.stopPropagation();};
draw.onpointermove=e=>{if(drawing){ctx.lineTo(...point(e));ctx.stroke();}e.stopPropagation();};
draw.onpointerup=()=>{drawing=false;refreshDraft();};draw.onpointercancel=()=>{drawing=false;refreshDraft();};
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
  if(mesh){const p=plantEntries[plantEntries.length-1];p.entryId=e.id;p.media=e.part;if(e.part?.position)mesh.position.fromArray(e.part.position);if(e.part?.scale)mesh.scale.fromArray(e.part.scale);mesh.rotation.z=e.part?.rotation||0;mesh.userData.replyTilt=mesh.rotation.z;}
}
function messageTimestamp(value){if(value==null)return null;const date=new Date(value);if(!Number.isFinite(date.getTime()))return null;const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));const time=document.createElement('time');time.className='message-time';time.dateTime=date.toISOString();time.textContent=`${parts.year} ${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;return time;}
function showMedia(entry){
  plantLabel.replaceChildren();const text=document.createElement('div');text.textContent=entry.text+(entry.username?' — '+entry.username:'');plantLabel.append(text);
  for(const key of ['drawing','image'])if(entry.media?.[key]){const img=document.createElement('img');img.src=entry.media[key];img.alt=key==='drawing'?'Drawing':'Uploaded image';plantLabel.append(img);}
  for(const kind of ['audio','video'])if(entry.media?.[kind]){const el=document.createElement(kind);el.src=entry.media[kind];el.controls=true;el.preload='metadata';if(kind==='video')el.playsInline=true;plantLabel.append(el);}
  if(entry.entryId){const reply=document.createElement('button');reply.textContent='Reply';reply.onclick=e=>{e.stopPropagation();replyParentId=entry.entryId;$('reply-draft').hidden=false;$('reply-draft').textContent='Reply to: '+entry.text.slice(0,100);const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel reply';cancel.onclick=e=>{e.stopPropagation();replyParentId=null;$('reply-draft').hidden=true;};$('reply-draft').append(cancel);closeChat();setHistorySmall(true);searchPanel.classList.remove('show');ui.classList.remove('mini','hidden');hidePlantLabel();ta.focus();};plantLabel.append(reply);}
  const time=messageTimestamp(entry.ts);if(time)plantLabel.append(time);
}
let hoverPoint=null, hoverAt=0,labelHideTimer=null;
function delayHideLabel(){clearTimeout(labelHideTimer);labelHideTimer=setTimeout(()=>{if(!plantLabel.matches(':hover')&&![...plantLabel.querySelectorAll('audio,video')].some(m=>!m.paused))hidePlantLabel();},400);}
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
  if(!admitted||ptrs.size||['chat','write','search'].includes(document.body.dataset.panel)||Date.now()-hoverAt<50)return;hoverAt=Date.now();
  hoverPoint={x:e.clientX,y:e.clientY};const rect=canvas.getBoundingClientRect();
  raycaster.setFromCamera({x:(e.clientX-rect.left)/rect.width*2-1,y:-(e.clientY-rect.top)/rect.height*2+1},camera);
  const hits=raycaster.intersectObjects(plantRoot.children,true);let entry=null;
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
const chatInput=$('chat-input'),chatForm=$('chat-form');
const dock=document.createElement('nav');dock.id='action-dock';dock.setAttribute('aria-label','Game tools');dock.hidden=true;
const writeOpen=document.createElement('button');writeOpen.id='write-open';writeOpen.type='button';writeOpen.textContent='WRITE';
$('search-btn').textContent='SEARCH';$('search-btn').setAttribute('aria-label','Search plants');
dock.append($('search-btn'),$('chat-open'),writeOpen,$('water-gun'));document.body.append(dock);
const searchHeader=document.createElement('div');searchHeader.id='search-header';const searchClose=document.createElement('button');searchClose.id='search-close';searchClose.type='button';searchClose.textContent='×';searchClose.setAttribute('aria-label','Close search');searchInput.before(searchHeader);searchHeader.append(searchInput,searchClose);searchClose.onclick=()=>{searchInput.blur();claimPanel('none');};
function reflectPanels(){const open=!ui.classList.contains('mini')&&!ui.classList.contains('hidden')?'write':searchPanel.classList.contains('show')?'search':$('online-panel').classList.contains('chatting')?'chat':'none';document.body.dataset.panel=open;writeOpen.textContent=ui.classList.contains('done-state')?'RETURN':'WRITE';for(const [id,name] of [['search-btn','search'],['chat-open','chat'],['write-open','write']])$(id).setAttribute('aria-expanded',String(open===name));}
function setHistorySmall(small){$('online-panel').classList.toggle('minimized',small);$('chat-minimize').setAttribute('aria-expanded',String(!small));}
function closeChat(){chatForm.hidden=true;chatInput.hidden=true;chatInput.blur();$('online-panel').classList.remove('chatting');setHistorySmall(true);fitKeyboard();reflectPanels();}
function claimPanel(name){
 if(name!=='chat')closeChat();
 if(name!=='write')ui.classList.add('mini');
 if(name!=='search'){searchPanel.classList.remove('show');if(phase===PHASE.EXPLORE)showControls(true);}
 if(name!=='plant')hidePlantLabel();pop.classList.remove('show');keysDown.clear();reflectPanels();
}
function openChat(){if(!admitted)return;claimPanel('chat');setHistorySmall(false);$('online-panel').classList.add('chatting');chatForm.hidden=false;chatInput.hidden=false;reflectPanels();latestChat();chatInput.focus();}
async function sendChat(){const text=chatInput.value.trim();if(!text)return;try{await api('/api/chat',{text});chatInput.value='';latestChat();chatInput.focus();}catch(e){message(e.message);}}
$('chat-open').onclick=()=>{if($('online-panel').classList.contains('chatting'))closeChat();else openChat();};$('chat-close').onclick=closeChat;$('chat-minimize').onclick=closeChat;
$('writer-close').onclick=e=>{e.stopPropagation();ui.classList.add('mini');reflectPanels();};
writeOpen.onclick=()=>{if(!admitted)return;if(!ui.classList.contains('mini')&&!ui.classList.contains('hidden')){ui.classList.add('mini');reflectPanels();return;}claimPanel('write');if(phase===PHASE.DONE){restartToIdleWithFade();}else{ui.classList.remove('mini','hidden');}reflectPanels();};
searchBtn.addEventListener('click',()=>{if(searchPanel.classList.contains('show'))claimPanel('search');reflectPanels();});
// Original cinematics and Reply can also change panel classes: enforce exclusivity before paint.
const panelObserver=new MutationObserver(records=>{for(const r of records){const old=r.oldValue||'',el=r.target;if(el===ui&&!ui.classList.contains('mini')&&!ui.classList.contains('hidden')&&(old.includes('mini')||old.includes('hidden')))claimPanel('write');if(el===searchPanel&&searchPanel.classList.contains('show')&&!old.includes('show'))claimPanel('search');}reflectPanels();});for(const panel of [ui,searchPanel])panelObserver.observe(panel,{attributes:true,attributeFilter:['class'],attributeOldValue:true});
ui.classList.add('mini');setHistorySmall(true);reflectPanels();
chatForm.onsubmit=e=>{e.preventDefault();sendChat();};
function fitKeyboard(){const v=window.visualViewport;const active=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');const keyboard=!!v&&active&&innerHeight-v.height>100;document.body.classList.toggle('keyboard-open',keyboard);document.documentElement.style.setProperty('--view-height',(v?.height||innerHeight)+'px');document.documentElement.style.setProperty('--view-top',(v?.offsetTop||0)+'px');if(keyboard)latestChat();}
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
window.render_game_to_text=()=>JSON.stringify({mode:admitted?phase:'password-or-character',character:selectedCharacter,connected,coins:coinCount,hits:gameView.hits?.[selectedCharacter]||0,loot:gameView.loot||[],players:1+remotePlayers.size,remotePlayers:[...remotePlayers.values()].map(p=>({character:p.character,state:p.state})),coordinateSystem:'Y up, world X/Z horizontal',position:charRoot.position.toArray(),plants:plantEntries.map(p=>({id:p.entryId,text:p.text,username:p.username,drawing:!!p.media?.drawing,image:!!p.media?.image,audio:!!p.media?.audio,video:!!p.media?.video,parentId:p.media?.parentId,position:p.mesh.position.toArray()})),chat:[...$('chat-log').children].map(x=>x.textContent)});
window.advanceTime=ms=>{for(let t=0;t<ms;t+=50)gameStep(Math.min(50,ms-t)/1000,false);composer.render();};
if(['localhost','127.0.0.1'].includes(location.hostname))window.reletter_test={THREE,renderer,model:()=>charModel,original:()=>originalCharacterTemplate,remotes:()=>[...remotePlayers.values()],showEntry:id=>{const e=plantEntries.find(p=>p.entryId===id);if(e)showPlantLabel(e);},explore:(position=[0,0,0])=>{phase=PHASE.EXPLORE;charRoot.visible=true;charRoot.position.fromArray(position);$('game-controls').classList.remove('hide');ui.classList.add('mini');},framePlant:id=>{for(const o of scene.children)if(o!==plantRoot&&!o.isLight)o.visible=false;clearGlow();const e=plantEntries.find(p=>p.entryId===id);if(!e)return;scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(e.mesh),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());charRoot.visible=false;const distance=Math.max(5,size.length()*1.6);camera.position.copy(center).add(new THREE.Vector3(distance*.3,distance*.2,distance));camera.lookAt(center);composer.render();},render:()=>{updateOnline(1);composer.render();},world:()=>({charRoot,camera,plantRoot,plantEntries})};
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
const waterGunModel=new THREE.Group();const gunBody=new THREE.Mesh(new THREE.BoxGeometry(.22,.18,.4),new THREE.MeshStandardMaterial({color:'#8bdcff',roughness:.4}));const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.05,.06,.22,10),new THREE.MeshStandardMaterial({color:'#9b7dcc'}));nozzle.rotation.x=Math.PI/2;nozzle.position.z=.27;const tank=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),new THREE.MeshStandardMaterial({color:'#f7b4d9'}));tank.position.y=.15;waterGunModel.add(gunBody,nozzle,tank);charRoot.add(waterGunModel);waterGunModel.visible=false;

function receiveGame(data){gameView=data;coinCount=data.wallets?.[selectedCharacter]||0;$('coin-num').textContent='x '+coinCount;$('water-status').textContent=(data.hits?.[selectedCharacter]||0)+' / 3 hits';const ids=new Set((data.loot||[]).map(c=>c.id));for(const [id,mesh] of lootMeshes)if(!ids.has(id)){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();lootMeshes.delete(id);}for(const coin of data.loot||[])if(!lootMeshes.has(coin.id)){const mesh=new THREE.Mesh(new THREE.TorusGeometry(.3,.09,8,16),new THREE.MeshStandardMaterial({color:'#ffd24a',metalness:.7,roughness:.25}));mesh.position.fromArray(coin.position);mesh.position.y+=.8;scene.add(mesh);lootMeshes.set(coin.id,mesh);}}
function showWater(data){const origin=new THREE.Vector3(...data.origin),direction=new THREE.Vector3(...data.direction);const mesh=new THREE.Group();const stream=new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin,origin.clone().addScaledVector(direction,18)]),new THREE.LineBasicMaterial({color:'#61cfff',transparent:true,opacity:.8}));mesh.add(stream);for(let i=0;i<12;i++){const drop=new THREE.Mesh(new THREE.SphereGeometry(.055+(i%3)*.02,6,6),new THREE.MeshBasicMaterial({color:'#82e4ff',transparent:true,opacity:.8}));drop.position.copy(origin).addScaledVector(direction,i*1.1);mesh.add(drop);}scene.add(mesh);waterEffects.push({mesh,left:.4});if(data.hit)$('water-status').textContent=(gameView.hits?.[selectedCharacter]||0)+' / 3 hits · Splash!';}
async function shootWater(){if(!admitted||!connected||phase!==PHASE.EXPLORE||shooting)return;shooting=true;$('water-gun').disabled=true;const direction=camera.getWorldDirection(new THREE.Vector3());const other=[...remotePlayers.values()].find(p=>p.state?.visible);if(other){const aim=new THREE.Vector3(...other.state.position).sub(charRoot.position).normalize();if(aim.dot(direction)>.3)direction.copy(aim);}try{await api('/api/game',{action:'shoot',direction:direction.toArray()});}catch(e){message(e.message);}finally{setTimeout(()=>{shooting=false;$('water-gun').disabled=false;},700);}}
$('water-gun').onclick=e=>{e.stopPropagation();shootWater();};
window.addEventListener('keydown',e=>{if(e.code==='KeyQ'&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();shootWater();}});
function updateWater(dt){waterGunModel.visible=admitted&&phase===PHASE.EXPLORE;if(charModel){waterGunModel.position.set(.35,.8,.25);waterGunModel.rotation.y=charModel.rotation.y;}for(const [id,mesh] of lootMeshes){mesh.rotation.y+=dt*2;mesh.position.y=(gameView.loot.find(c=>c.id===id)?.position[1]||0)+.8+Math.sin(performance.now()/400)*.12;}for(const fx of waterEffects)fx.left-=dt;waterEffects=waterEffects.filter(fx=>{fx.mesh.traverse(o=>{if(o.material)o.material.opacity=Math.max(0,fx.left/.4);});if(fx.left>0)return true;scene.remove(fx.mesh);fx.mesh.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return false;});if(!connected||phase!==PHASE.EXPLORE||performance.now()-lastPickup<500)return;lastPickup=performance.now();for(const coin of gameView.loot||[])if(!collecting.has(coin.id)&&Math.hypot(charRoot.position.x-coin.position[0],charRoot.position.z-coin.position[2])<2&&Math.abs(charRoot.position.y-coin.position[1])<3){collecting.add(coin.id);api('/api/game',{action:'collect',id:coin.id}).catch(()=>{}).finally(()=>collecting.delete(coin.id));}}
