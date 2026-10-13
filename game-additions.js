// Runs inside the original game's module, sharing its scene and plant lifecycle.
let selectedCharacter='Ely', admitted=false, selfId=null, connected=false, onlineSocket=null;
let draftMedia={drawing:null,image:null}, plantingMedia=null;
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
  if(type==='welcome'){selfId=data.id;connected=true;updateRoster(data.players);api('/api/chat',undefined,'GET').then(history=>{history.forEach(appendChat);}).catch(e=>message(e.message));if(admitted)loadEntries().then(es=>es.forEach(e=>addStoredPlant(e))).catch(e=>message(e.message));}
  if(type==='players')updateRoster(data);
  if(type==='state'&&data.id!==selfId&&remotePlayers.has(data.id))remotePlayers.get(data.id).state=data.state;
  if(type==='plant'&&data.sender!==selfId)addStoredPlant(data,true);
  if(type==='deleted'){const i=plantEntries.findIndex(p=>p.entryId===data.id);if(i>=0){plantRoot.remove(plantEntries[i].mesh);plantEntries.splice(i,1);hidePlantLabel();}}
  if(type==='chat')appendChat(data);
}
async function openConnection(character){
  if(window.RELETTER_TRANSPORT==='websocket')return openCloudConnection(character);
  const res=await fetch('/api/events?character='+character);
  if(!res.ok){const e=await res.json();throw new Error(e.error);}
  const reader=res.body.getReader(),decoder=new TextDecoder();
  (async()=>{let buffer='';try{while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n\n'))>=0){const chunk=buffer.slice(0,end);buffer=buffer.slice(end+2);const event=chunk.match(/event: (.+)/),data=chunk.match(/data: (.+)/);if(event&&data)receive(event[1],JSON.parse(data[1]));}}}catch{}finally{connected=false;message('Disconnected · Reconnecting');if(admitted)setTimeout(()=>openConnection(selectedCharacter).catch(()=>message('Unable to reconnect. Please refresh.')),2500);}})();
}
function openCloudConnection(character){
  return new Promise((resolve,reject)=>{
    const url=new URL('/api/socket',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.searchParams.set('character',character);
    const socket=new WebSocket(url);let joined=false,heartbeat;
    const timeout=setTimeout(()=>{if(!joined){socket.close();reject(new Error('Connection timed out. Please try again.'));}},12000);
    socket.onmessage=e=>{
      if(e.data==='pong')return;
      const message=JSON.parse(e.data);receive(message.type,message.data);
      if(message.type==='welcome'){joined=true;clearTimeout(timeout);onlineSocket=socket;lastOnlineState='';heartbeat=setInterval(()=>{if(socket.readyState===1)socket.send('ping');},20000);resolve();}
    };
    socket.onerror=()=>{if(!joined){clearTimeout(timeout);reject(new Error('Character unavailable. Choose the other character or try again.'));}};
    socket.onclose=()=>{clearTimeout(timeout);clearInterval(heartbeat);if(onlineSocket===socket){onlineSocket=null;connected=false;message('Disconnected · Reconnecting');if(admitted)setTimeout(()=>openCloudConnection(selectedCharacter).catch(e=>message(e.message)),2500);}if(!joined)reject(new Error('Unable to join. Sign in again or choose the other character.'));};
  });
}
for(const btn of document.querySelectorAll('[data-character]'))btn.onclick=async()=>{
  try{await openConnection(btn.dataset.character);selectedCharacter=btn.dataset.character;admitted=true;$('chat-open').hidden=false;$('chat-minimize').hidden=false;charRoot.position.x=selectedCharacter==='Ely'?-1.5:1.5;$('entry-gate').remove();$('username').value=selectedCharacter;resolveEntryGate();}
  catch(e){$('gate-error').textContent=e.message;}
};
let lastOnlineState='';
setInterval(()=>{
  if(!connected||!admitted)return;
  const state={position:charRoot.position.toArray(),rotation:charModel?.rotation.y||0,visible:charRoot.visible,phase};
  if(onlineSocket?.readyState===1){const serialized=JSON.stringify(state);if(serialized!==lastOnlineState){onlineSocket.send(JSON.stringify({type:'state',data:state}));lastOnlineState=serialized;}}
  else api('/api/state',state).catch(()=>{});
},100);
const draw=$('drawing'),ctx=draw.getContext('2d');let drawing=false,hasDrawing=false;
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
function refreshDraft(){draftMedia.drawing=hasDrawing?draw.toDataURL('image/png'):null;goBtn.disabled=!(ta.value.trim()||draftMedia.drawing||draftMedia.image);}
draw.onpointerdown=e=>{drawing=true;draw.setPointerCapture(e.pointerId);ctx.beginPath();ctx.moveTo(...point(e));ctx.lineWidth=+$('brush-size').value;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=$('brush-color').value;ctx.lineTo(...point(e).map(v=>v+.01));ctx.stroke();hasDrawing=true;e.stopPropagation();};
draw.onpointermove=e=>{if(drawing){ctx.lineTo(...point(e));ctx.stroke();}e.stopPropagation();};
draw.onpointerup=()=>{drawing=false;refreshDraft();};draw.onpointercancel=()=>{drawing=false;refreshDraft();};
$('clear-drawing').onclick=e=>{e.stopPropagation();ctx.clearRect(0,0,draw.width,draw.height);hasDrawing=false;refreshDraft();};
$('brush-size').oninput=()=>$('brush-value').textContent=$('brush-size').value+' px';
document.querySelector('.upload-button').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();$('upload-image').click();}};
$('upload-image').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){$('media-error').textContent='Choose a PNG, JPG or WebP image under 10 MB.';e.target.value='';return;}
  try{const bitmap=await createImageBitmap(file),c=document.createElement('canvas'),ratio=Math.min(1,1024/Math.max(bitmap.width,bitmap.height));c.width=Math.round(bitmap.width*ratio);c.height=Math.round(bitmap.height*ratio);c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();draftMedia.image=c.toDataURL('image/jpeg',.8);$('image-preview').src=draftMedia.image;$('image-preview').hidden=false;$('upload-name').textContent=file.name;$('media-error').textContent='';refreshDraft();}catch{$('media-error').textContent='Unable to read this image';}
};
$('remove-image').onclick=e=>{e.stopPropagation();draftMedia.image=null;$('image-preview').hidden=true;$('upload-image').value='';$('upload-name').textContent='No image selected';refreshDraft();};
ta.addEventListener('input',refreshDraft);
goBtn.addEventListener('click',()=>{
  if(!admitted)return;
  plantingMedia={...draftMedia};
  if(!ta.value.trim())ta.value=draftMedia.drawing?'A drawing':'An image';
  $('username').value=selectedCharacter;
  draftMedia={drawing:null,image:null};hasDrawing=false;ctx.clearRect(0,0,draw.width,draw.height);$('image-preview').hidden=true;$('upload-image').value='';$('upload-name').textContent='No image selected';
},true);
function addStoredPlant(e,grow=false){
  if(plantEntries.some(p=>p.entryId===e.id))return;
  const mesh=addPlant(e.text,grow,e.created_at,e.part?.username||'');
  if(mesh){const p=plantEntries[plantEntries.length-1];p.entryId=e.id;p.media=e.part;if(e.part?.position)mesh.position.fromArray(e.part.position);if(e.part?.scale)mesh.scale.fromArray(e.part.scale);}
}
function showMedia(entry){
  plantLabel.replaceChildren();const text=document.createElement('div');text.textContent=entry.text+(entry.username?' — '+entry.username:'');plantLabel.append(text);
  for(const key of ['drawing','image'])if(entry.media?.[key]){const img=document.createElement('img');img.src=entry.media[key];img.alt=key==='drawing'?'Drawing':'Uploaded image';plantLabel.append(img);}
}
let hoverPoint=null, hoverAt=0;
function positionPlantLabel(){
  if(!activeLabelEntry)return;
  const half=plantLabel.offsetWidth/2+8,height=plantLabel.offsetHeight;
  const x=hoverPoint?.x??W()/2,y=hoverPoint?hoverPoint.y+20:H()*.78;
  plantLabel.style.left=Math.max(half,Math.min(W()-half,x))+'px';
  plantLabel.style.top=Math.max(8,Math.min(H()-height-16,y))+'px';
}
new ResizeObserver(positionPlantLabel).observe(plantLabel);
canvas.addEventListener('pointermove',e=>{
  if(!admitted||ptrs.size||Date.now()-hoverAt<50)return;hoverAt=Date.now();
  hoverPoint={x:e.clientX,y:e.clientY};const rect=canvas.getBoundingClientRect();
  raycaster.setFromCamera({x:(e.clientX-rect.left)/rect.width*2-1,y:-(e.clientY-rect.top)/rect.height*2+1},camera);
  const hits=raycaster.intersectObjects(plantRoot.children,true);let entry=null;
  for(const hit of hits){let o=hit.object;while(o&&o.parent!==plantRoot)o=o.parent;entry=plantEntries.find(p=>p.mesh===o);if(entry)break;}
  if(entry){if(activeLabelEntry!==entry)showPlantLabel(entry);positionPlantLabel();}
  else hidePlantLabel();
});
canvas.addEventListener('pointerleave',e=>{if(e.pointerType==='touch')return;hoverPoint=null;hidePlantLabel();});
const chatMessages=new Map(),chatLog=$('chat-log'),chatScroll=$('chat-scroll');
function syncChatScroll(){chatScroll.max=Math.max(0,chatLog.scrollHeight-chatLog.clientHeight);chatScroll.value=chatLog.scrollTop;}
chatLog.onscroll=syncChatScroll;chatScroll.oninput=()=>chatLog.scrollTop=+chatScroll.value;
new ResizeObserver(syncChatScroll).observe(chatLog);
function appendChat(data){if(chatMessages.has(data.id))return;const atBottom=chatLog.scrollHeight-chatLog.clientHeight-chatLog.scrollTop<30;chatMessages.set(data.id,data);const line=document.createElement('div'),name=document.createElement('b');line.dataset.chatId=data.id;name.textContent=data.name+'：';line.append(name,document.createTextNode(data.text));const next=[...chatLog.children].find(n=>{const m=chatMessages.get(n.dataset.chatId);return m.time>data.time||(m.time===data.time&&m.id>data.id);});chatLog.insertBefore(line,next||null);if(atBottom)chatLog.scrollTop=chatLog.scrollHeight;syncChatScroll();}
$('chat-minimize').onclick=()=>{const small=$('online-panel').classList.toggle('minimized');$('chat-minimize').textContent=small?'HISTORY':'MINIMIZE';$('chat-minimize').setAttribute('aria-expanded',String(!small));closeChat();if(!small)syncChatScroll();};
const chatInput=$('chat-input'),chatForm=$('chat-form');
function closeChat(){chatForm.hidden=true;chatInput.hidden=true;chatInput.blur();}
function openChat(){if(!admitted)return;keysDown.clear();chatForm.hidden=false;chatInput.hidden=false;chatInput.focus();}
async function sendChat(){const text=chatInput.value.trim();if(!text){closeChat();return;}try{await api('/api/chat',{text});chatInput.value='';closeChat();}catch(e){message(e.message);}}
$('chat-open').onclick=openChat;$('chat-close').onclick=closeChat;
chatForm.onsubmit=e=>{e.preventDefault();sendChat();};

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
window.render_game_to_text=()=>JSON.stringify({mode:admitted?phase:'password-or-character',character:selectedCharacter,connected,players:1+remotePlayers.size,remotePlayers:[...remotePlayers.values()].map(p=>({character:p.character,state:p.state})),coordinateSystem:'Y up, world X/Z horizontal',position:charRoot.position.toArray(),plants:plantEntries.map(p=>({id:p.entryId,text:p.text,username:p.username,drawing:!!p.media?.drawing,image:!!p.media?.image})),chat:[...$('chat-log').children].map(x=>x.textContent)});
window.advanceTime=ms=>{for(let t=0;t<ms;t+=50)gameStep(Math.min(50,ms-t)/1000,false);composer.render();};
if(['localhost','127.0.0.1'].includes(location.hostname))window.reletter_test={THREE,renderer,model:()=>charModel,original:()=>originalCharacterTemplate,remotes:()=>[...remotePlayers.values()]};
window.reletterPlantScreenPoint=()=>{
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  for(const entry of [...plantEntries].reverse()){
    const candidates=[];entry.mesh.traverse(o=>{const pos=o.geometry?.attributes.position,index=o.geometry?.index;if(!pos)return;const count=index?.count||pos.count,step=Math.max(3,Math.floor(count/240)*3);for(let i=0;i+2<count;i+=step){const v=new THREE.Vector3();for(let j=0;j<3;j++)v.add(new THREE.Vector3().fromBufferAttribute(pos,index?index.getX(i+j):i+j));v.multiplyScalar(1/3).applyMatrix4(o.matrixWorld).project(camera);if(v.z>-1&&v.z<1&&Math.abs(v.x)<.9&&Math.abs(v.y)<.9)candidates.push(v);}});
    for(const v of candidates){raycaster.setFromCamera({x:v.x,y:v.y},camera);const hits=raycaster.intersectObject(entry.mesh,true);if(hits.length)return{x:(v.x+1)*W()/2,y:(1-v.y)*H()/2};}
  }return null;
};
