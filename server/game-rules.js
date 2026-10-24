import {withMilkBoss} from './milk-encounter.js';
import {incomingElement} from './element-rules.js';
import {applyDeathPenalty,deathProtected} from './death-rules.js';
import {GARDEN_ACTIONS,gardenAction} from './garden-rules.js';
import {effectActive} from './combat-effects.js';
import {playerStats} from '../progression.js';
import {attackStats} from '../equipment-catalog.js';
import {paintAction} from './surface-rules.js';
import {FISH_ACTIONS,fishingAction} from './fishing-rules.js';
import {ensureEquipment,equipmentAction,equippedWeapon,absorbShield} from './equipment-rules.js';
import {ensureWorld,buildAction,coverDistance,shootBoss,shootConstruction} from './world-rules.js';
// Shared authoritative rules for the Cloudflare and local transports.
export const mediaKinds=['drawing','image','audio','video'];
export const mediaTypes={drawing:['image/png','image/jpeg','image/webp'],image:['image/png','image/jpeg','image/webp'],audio:['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/webm','audio/mp4','audio/aac','audio/flac'],video:['video/mp4','video/webm','video/ogg','video/quicktime']};
export function validMedia(kind,data){if(!data)return true;if(typeof data!=='string'||data.length>(['audio','video'].includes(kind)?7_000_000:2_200_000))return false;const m=data.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/);return !!m&&mediaTypes[kind].includes(m[1])&&m[2].length%4===0;}
export function battleAction(game,actor,players,body,now=Date.now()){
 ensureWorld(game);ensureEquipment(game);if(body.action==='monster-hit'&&body.target==='foreman'){if(game.milkEncounter.phase!=='active')return {blocked:true};return withMilkBoss(game,()=>battleAction(game,actor,players,{...body,target:null},now));}if(GARDEN_ACTIONS.includes(body.action))return gardenAction(game,actor,body,now);if(body.action==='paint')return paintAction(game,actor,body);if(FISH_ACTIONS.includes(body.action))return fishingAction(game,actor,body,now);if(['buy','equip','unequip','sell-rarity'].includes(body.action))return equipmentAction(game,actor.character,body);if(body.action==='build'||body.action==='destroy')return buildAction(game,actor,players,body,now);
 game.wallets??={};game.hits??={};game.shots??={};game.loot??=[];game.claims??={};game.loot=game.loot.filter(c=>now-c.time<300000);
 const name=actor.character,pos=actor.state?.position;if(!pos||!actor.state.visible)return {error:'Enter the garden first'};
 const balance=()=>game.wallets[name]||0;
 if(body.action==='earn'){
  if(!Number.isInteger(body.index)||body.index<0||body.index>200)return {error:'Invalid coin'};
  const key=name+':'+body.index;if(now-(game.claims[key]||0)<10000)return {error:'Coin is respawning'};
  game.claims[key]=now;game.wallets[name]=balance()+1;return {};
 }
 if(body.action==='collect'){
  const i=game.loot.findIndex(c=>c.id===body.id);if(i<0)return {error:'Coin already collected'};const coin=game.loot[i];
  if(Math.hypot(pos[0]-coin.position[0],pos[2]-coin.position[2])>2.2||Math.abs(pos[1]-coin.position[1])>3)return {error:'Move closer to the coin'};
  if(coin.owner===name&&now-coin.time<2000)return {error:'Coin is still falling'};
  game.wallets[name]=balance()+coin.amount;game.loot.splice(i,1);return {};
 }
 if(body.action==='monster-hit'){
  if(deathProtected(game,name,now)||game.boss.hp<=0||effectActive(game.boss,'stun',now)||effectActive(game.boss,'fear',now)||game.boss.paused||pos[1]>=5||Math.abs(pos[1]-game.boss.position[1])>3||Math.hypot(pos[0]-game.boss.position[0],pos[2]-game.boss.position[2])>5)return {blocked:true};
  game.monsterHits??={};if(now-(game.monsterHits[name]||0)<1800)return {blocked:true};game.monsterHits[name]=now;
  const result=absorbShield(game,name,game.boss.damage*incomingElement(game,name,game.boss.element)*(1-(effectActive(game.boss,'weak',now)?.power||0)),now),hits=(game.hits[name]||0)+result.damage,defeated=hits>=playerStats(game,name,now).maxHp;game.hits[name]=defeated?0:hits;if(defeated)applyDeathPenalty(game,name,now,'monster-contact');return {blocked:result.damage===0,defeated};
 }
 if(body.action!=='shoot')return {error:'Unknown action'};
 const weapon=equippedWeapon(game,name);
 game.nextShots??={};
 if(now<(game.nextShots[name]||0)||now-(game.shots[name]||0)<weapon.cooldown)return {error:'Water gun is refilling'};
 let d=body.direction;if(!Array.isArray(d)||d.length!==3||!d.every(Number.isFinite)||Math.abs(Math.hypot(...d)-1)>.05)return {error:'Invalid aim'};
 const charge=typeof body.charge==='number'&&Number.isFinite(body.charge)?Math.max(0,Math.min(1,body.charge)):0;
 if(charge===1&&pos[1]<5&&d[1]<0&&!['saber','whip','swatter','pan','planter','palm'].includes(weapon.family)){const horizontal=Math.hypot(d[0],d[2]);if(horizontal>1e-5)d=[d[0]/horizontal,0,d[2]/horizontal];}
 const {range,radius,damage:baseDamage,ultimate}=attackStats(weapon,charge),damage=+(baseDamage*playerStats(game,name,now).attackMultiplier).toFixed(2);
 game.shots[name]=now;game.nextShots[name]=now+weapon.cooldown;const origin=[pos[0],pos[1]+1,pos[2]],shot={origin,direction:d,charge,range,radius,hit:null,weapon:weapon.id,family:weapon.family,color:weapon.color,shooter:name,damage,ultimate,element:weapon.element};
 if(['saber','whip','swatter','pan','planter','palm'].includes(weapon.family)){game.meleeCombos??={};const previous=game.meleeCombos[name];shot.combo=charge>=.8?6:previous&&now-previous.time<4000?(previous.index+1)%6:0;game.meleeCombos[name]={index:shot.combo===6?0:shot.combo,time:now};}
 const wall=coverDistance(game,origin,d);
 shootBoss(game,shot,now);
 if(!game.pkMode||shot.hit){shootConstruction(game,shot,now);if(!shot.hit&&wall<range)shot.impact=origin.map((v,i)=>v+d[i]*wall);return {shot};}
 shot.red=false;
 for(const target of players){if(target.id===actor.id||!target.state?.visible||deathProtected(game,target.character,now))continue;const t=target.state.position,delta=[t[0]-origin[0],t[1]+1-origin[1],t[2]-origin[2]],along=delta.reduce((s,v,i)=>s+v*d[i],0);if(coverDistance(game,origin,d)<along||along<0||along>range||Math.hypot(...delta.map((v,i)=>v-d[i]*along))>1.25+radius-.12)continue;
  shot.hit=target.character;const pvpDamage=Math.min(2,weapon.id==='water'?playerStats(game,name,now).attackMultiplier:shot.damage),guard=absorbShield(game,target.character,pvpDamage*incomingElement(game,target.character,weapon.element),now);shot.blocked=guard.blocked;const hits=(game.hits[target.character]||0)+guard.damage,maxHp=playerStats(game,target.character,now).maxHp;shot.defeated=hits>=maxHp;game.hits[target.character]=shot.defeated?0:+hits.toFixed(2);
  if(shot.defeated){const penalty=applyDeathPenalty(game,target.character,now,'player'),amount=Math.max(1,penalty?.coins||0);game.loot.push({id:crypto.randomUUID(),position:[...t],amount,owner:target.character,time:now});}break;
 }
 shootConstruction(game,shot,now);
 if(!shot.hit&&wall<range)shot.impact=origin.map((v,i)=>v+d[i]*wall);
 return {shot};
}
