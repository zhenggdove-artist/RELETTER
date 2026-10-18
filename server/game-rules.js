// Shared authoritative rules for the Cloudflare and local transports.
export const mediaKinds=['drawing','image','audio','video'];
export const mediaTypes={drawing:['image/png','image/jpeg','image/webp'],image:['image/png','image/jpeg','image/webp'],audio:['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/webm','audio/mp4','audio/aac','audio/flac'],video:['video/mp4','video/webm','video/ogg','video/quicktime']};
export function validMedia(kind,data){if(!data)return true;if(typeof data!=='string'||data.length>(['audio','video'].includes(kind)?7_000_000:2_200_000))return false;const m=data.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/);return !!m&&mediaTypes[kind].includes(m[1])&&m[2].length%4===0;}
export function battleAction(game,actor,players,body,now=Date.now()){
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
 if(body.action!=='shoot')return {error:'Unknown action'};
 if(now-(game.shots[name]||0)<650)return {error:'Water gun is refilling'};
 const d=body.direction;if(!Array.isArray(d)||d.length!==3||!d.every(Number.isFinite)||Math.abs(Math.hypot(...d)-1)>.05)return {error:'Invalid aim'};
 game.shots[name]=now;const origin=[pos[0],pos[1]+1,pos[2]],shot={origin,direction:d,hit:null};
 for(const target of players){if(target.id===actor.id||!target.state?.visible)continue;const t=target.state.position,delta=[t[0]-origin[0],t[1]+1-origin[1],t[2]-origin[2]],along=delta.reduce((s,v,i)=>s+v*d[i],0);if(along<0||along>18||Math.hypot(...delta.map((v,i)=>v-d[i]*along))>1.25)continue;
  shot.hit=target.character;const hits=(game.hits[target.character]||0)+1;game.hits[target.character]=hits%3;
  if(hits===3){const amount=Math.max(1,game.wallets[target.character]||0);game.wallets[target.character]=0;game.loot.push({id:crypto.randomUUID(),position:[...t],amount,owner:target.character,time:now});}break;
 }
 return {shot};
}
