import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
// The GLB keeps the supplied OBJ vertices/UVs and the matching FBX weights and clips.
export async function installForemanRig(T,root){
 const u=root.userData;for(const c of root.children)if(c!==u.drips)c.visible=false;
 const gltf=await new GLTFLoader().loadAsync(new URL('./art/foreman-rig.glb',import.meta.url).href);
 const photo=await new T.TextureLoader().loadAsync(new URL('./art/foreman-reference.png',import.meta.url).href);photo.colorSpace=T.SRGBColorSpace;
 const model=gltf.scene,rigBones={};model.traverse(o=>{if(o.isBone)rigBones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});
 const bind=[];model.traverse(o=>{if(o.isSkinnedMesh){bind.push(o);}});model.updateMatrixWorld(true);
 const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3());const container=new T.Group();container.rotation.y=-Math.PI/2;container.scale.setScalar(2.4/size.y);model.position.y-=box.min.y;container.add(model);
 // Props and particles survive the geometry replacement; no procedural body is shown.
 u.saw.removeFromParent();u.sign.removeFromParent();u.hurtFace.removeFromParent();
 for(const c of [...root.children])if(c!==u.drips){root.remove(c);c.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
 root.add(container);root.scale.setScalar(40/2.4);u.bones={};u.anchors=[];
 const names={Hips:'Hips',Spine:'Spine2',Neck:'Neck',Head:'Head',LUpperArm:'LeftArm',RUpperArm:'RightArm',LForearm:'LeftForeArm',RForearm:'RightForeArm',LHand:'LeftHand',RHand:'RightHand',LThigh:'LeftUpLeg',RThigh:'RightUpLeg',LShin:'LeftLeg',RShin:'RightLeg',LFoot:'LeftFoot',RFoot:'RightFoot'};
 for(const [alias,name] of Object.entries(names)){const anchor=new T.Group();root.add(anchor);u.bones[alias]=anchor;u.anchors.push([anchor,rigBones[name]]);}
 u.bones.RHand.add(u.saw);u.saw.position.set(0,-.07,.15);u.saw.rotation.set(Math.PI/2,Math.PI/2,0);u.saw.visible=true;
 u.bones.LHand.add(u.sign);u.sign.position.set(0,-.02,.12);u.sign.rotation.set(.45,0,0);u.sign.visible=true;
 u.bones.Head.add(u.hurtFace);u.hurtFace.scale.setScalar(.56);u.hurtFace.position.set(0,.10,.13);
 const colors=[];for(const prop of [u.saw,u.sign])prop.traverse(o=>{if(o.material?.color)colors.push({m:o.material,color:o.material.color.clone()});});model.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;const m=o.material;m.metalness=0;m.roughness=.85;m.normalScale?.set(.3,.3);
 m.onBeforeCompile=shader=>{shader.uniforms.foremanPhoto={value:photo};shader.vertexShader='varying vec3 portraitPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nportraitPosition=position*100.;');shader.fragmentShader='uniform sampler2D foremanPhoto;varying vec3 portraitPosition;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 vec2 face=vec2(-(portraitPosition.z-.002)/.058,(portraitPosition.y-.429)/.069);
 float oval=dot(face,face);float mask=(1.-smoothstep(.78,1.,oval))*smoothstep(.025,.045,portraitPosition.x);
 vec2 faceUV=vec2((512.+face.x*80.)/1024.,1.-(150.-face.y*110.)/1536.);
 vec3 faceColor=texture2D(foremanPhoto,faceUV).rgb;
 diffuseColor.rgb=mix(diffuseColor.rgb,faceColor,mask);
 `);};m.customProgramCacheKey=()=> 'foreman-obj-photo-v1';m.needsUpdate=true;colors.push({m,color:m.color.clone()});});u.colors=colors;
 u.rig={model,container,bones:rigBones,mixer:new T.AnimationMixer(model),rest:new Map(Object.values(rigBones).map(b=>[b,{q:b.quaternion.clone(),p:b.position.clone(),s:b.scale.clone()}])),point:new T.Vector3(),q0:new T.Quaternion(),q1:new T.Quaternion(),q2:new T.Quaternion(),forward:new T.Vector3(),az:new T.Vector3(0,0,1),last:null};
 root.updateMatrixWorld(true);u.rig.hipBindInverse=root.getWorldQuaternion(new T.Quaternion()).invert().multiply(rigBones.Hips.getWorldQuaternion(new T.Quaternion())).invert();
 for(const clip of gltf.animations){clip.tracks=clip.tracks.filter(t=>!t.name.endsWith('.position')||!t.name.includes('Hips'));}u.rig.run=u.rig.mixer.clipAction(gltf.animations.find(c=>c.name==='Run')||gltf.animations[0]);u.rig.run.play();u.rig.kick=gltf.animations.find(c=>c.name==='Kick');u.sourceModel='user-obj';u.ready=true;updateForemanRig(T,root,{skills:[],paused:true},0);
}
export function updateForemanRig(T,root,boss,time){const u=root.userData,r=u.rig;if(!r)return;const t=time/1000;r.container.rotation.y=-Math.PI/2;const skill=(boss.skills||[]).find(s=>time<s.end&&['timber-fall','dark-stomp','rat-swarm'].includes(s.type));
 r.run.enabled=!!(boss.chasing||boss.sign)&&!boss.paused&&!skill;
 if(r.run.enabled)r.mixer.setTime(t*.75);else for(const [b,v] of r.rest){b.quaternion.copy(v.q);b.position.copy(v.p);b.scale.copy(v.s);}
 // FBX local bone axes differ from the former procedural rig; offsets are applied to rest quaternions.
 const rotate=(name,axis,v)=>{const b=r.bones[name];if(b)b.rotateOnAxis(axis,v);};
 const az=r.az;
 if(!r.run.enabled){
 if(r.idle){for(const [bone,q] of r.idle)bone.quaternion.copy(q);}else {r.idle=new Map();for(const side of ['Left','Right']){const bone=r.bones[side+'Arm'],child=r.bones[side+'ForeArm'];root.updateMatrixWorld(true);const a=bone.getWorldPosition(new T.Vector3()),b=child.getWorldPosition(new T.Vector3()),dir=b.sub(a).normalize(),target=new T.Vector3(side==='Left'?.12:-.12,-1,.03).normalize().transformDirection(root.matrixWorld),delta=new T.Quaternion().setFromUnitVectors(dir,target),world=bone.getWorldQuaternion(new T.Quaternion()),parent=bone.parent.getWorldQuaternion(new T.Quaternion()).invert();bone.quaternion.copy(parent.multiply(delta).multiply(world));r.idle.set(bone,bone.quaternion.clone());}}
 }
 if(skill){const p=Math.max(0,Math.min(1,(time-skill.start)/(skill.end-skill.start)));if(skill.type==='timber-fall'){rotate('RightArm',az,-1.8*Math.sin(p*Math.PI));rotate('Spine2',az,.25*Math.sin(p*Math.PI));}if(skill.type==='dark-stomp'&&r.kick){r.run.enabled=false;const action=r.mixer.clipAction(r.kick);action.enabled=true;action.play();r.mixer.setTime(p*r.kick.duration);action.enabled=false;}if(skill.type==='rat-swarm')rotate('LeftForeArm',az,-.8);}
 root.updateMatrixWorld(true);const relative=root.getWorldQuaternion(r.q0).invert().multiply(r.bones.Hips.getWorldQuaternion(r.q1)).multiply(r.hipBindInverse),forward=r.forward.set(0,0,1).applyQuaternion(relative);r.container.rotation.y-=Math.atan2(forward.x,forward.z);root.updateMatrixWorld(true);for(const [anchor,bone] of u.anchors){if(!bone)continue;bone.getWorldPosition(r.point);root.worldToLocal(r.point);anchor.position.copy(r.point);const rel=root.getWorldQuaternion(r.q0).invert().multiply(bone.getWorldQuaternion(r.q1));anchor.userData.bindInverse??=rel.clone().invert();anchor.quaternion.copy(rel.multiply(anchor.userData.bindInverse));}root.updateMatrixWorld(true);
}
