// Shared, server-owned encounter and persistent construction rules.
export const blockSize=b=>b.shape==='bar'?(b.rotation===1?[2,2,6]:[6,2,2]):[2,2,2];
export function ensureWorld(g){g.blocks??=[];g.boss??={hp:100,maxHp:100,position:[40,0,0],revision:0,generation:1};g.redMode??=false;return g;}
export function resetEncounter(g,now=Date.now()){ensureWorld(g);g.redMode=false;g.boss={hp:100,maxHp:100,position:[40,0,0],revision:0,generation:g.boss.generation+1};g.bossClock=now;}
export function activateEncounter(g,text){ensureWorld(g);if(text.trim()!=='一起打阿姨')return false;g.redMode=true;return true;}
export function worldView(g){ensureWorld(g);return {wallets:g.wallets||{},hits:g.hits||{},loot:g.loot||[],redMode:g.redMode,boss:g.boss,blocks:g.blocks};}
export function containsBlock(b,x,y,z,padding=0){const [w,h,d]=blockSize(b),p=b.position;if(y<p[1]||y>=p[1]+h)return false;if(b.shape==='cylinder')return Math.hypot(x-p[0],z-p[2])<1+padding;return Math.abs(x-p[0])<w/2+padding&&Math.abs(z-p[2])<d/2+padding;}
export function advanceBoss(g,players,now=Date.now()){
 ensureWorld(g);const dt=Math.max(0,Math.min(.25,(now-(g.bossClock||now))/1000));g.bossClock=now;
 if(!g.redMode||g.boss.hp<=0||players.some(p=>p.state?.paused))return;
 const pos=g.boss.position,targets=players.filter(p=>p.state?.visible&&p.state.phase===2&&p.state.position[1]<5);
 targets.sort((a,b)=>Math.hypot(a.state.position[0]-pos[0],a.state.position[2]-pos[2])-Math.hypot(b.state.position[0]-pos[0],b.state.position[2]-pos[2]));
 if(!targets.length)return;const t=targets[0].state.position,dx=t[0]-pos[0],dz=t[2]-pos[2],distance=Math.hypot(dx,dz);if(distance<1.3)return;
 const step=Math.min(distance-1.3,(distance<8?4.5:1.25)*dt),nx=pos[0]+dx/distance*step,nz=pos[2]+dz/distance*step;
 const free=(x,z)=>!g.blocks.some(b=>b.position[1]<12&&containsBlock(b,x,b.position[1]+.5,z,1.1));
 if(free(nx,nz)){pos[0]=nx;pos[2]=nz;}else if(free(nx,pos[2]))pos[0]=nx;else if(free(pos[0],nz))pos[2]=nz;
 g.boss.rotation=Math.atan2(dx,dz);
}
export function buildAction(g,actor,players,body,now=Date.now()){
 ensureWorld(g);const pos=actor.state?.position;if(!pos||!actor.state.visible)return {error:'Enter the garden first'};
 if(body.action==='destroy'){
  const i=g.blocks.findIndex(b=>b.id===body.id);if(i<0)return {error:'Block no longer exists'};
  if(Math.hypot(...g.blocks[i].position.map((v,j)=>v-pos[j]))>18)return {error:'Move closer to the block'};
  g.blocks.splice(i,1);return {};
 }
 if(!['cube','bar','cylinder'].includes(body.shape))return {error:'Choose a block shape'};
 const p=body.position;if(!Array.isArray(p)||p.length!==3||!p.every(n=>Number.isFinite(n)&&Math.abs(n)<=500&&Math.abs(n/2-Math.round(n/2))<.001)||p[1]<0||p[1]>40)return {error:'Choose a valid grid position'};
 if(Math.hypot(...p.map((v,i)=>v-pos[i]))>14)return {error:'Build within 14 metres'};
 const block={id:crypto.randomUUID(),shape:body.shape,rotation:body.rotation===1?1:0,position:[...p],color:/^#[0-9a-f]{6}$/i.test(body.color||'')?body.color:'#c6a5dc',createdAt:now};
 const [w,h,d]=blockSize(block),overlap=(b,vertical=true)=>{const [bw,bh,bd]=blockSize(b);return Math.abs(p[0]-b.position[0])<(w+bw)/2-.01&&Math.abs(p[2]-b.position[2])<(d+bd)/2-.01&&(!vertical||(p[1]<b.position[1]+bh-.01&&p[1]+h>b.position[1]+.01));};
 if(g.blocks.some(b=>overlap(b)))return {error:'This space is occupied'};
 if(p[1]>0&&!g.blocks.some(b=>b.position[1]+2===p[1]&&overlap(b,false)))return {error:'Stack on the ground or an existing block'};
 if(players.some(player=>player.state?.visible&&containsBlock(block,player.state.position[0],player.state.position[1]+.8,player.state.position[2],.5)))return {error:'A player is standing here'};
 if(g.blocks.length>=2000)return {error:'The garden has reached its block limit'};
 g.blocks.push(block);return {block};
}
// Ray/slab intersection; cylinder footprints use their actual circular side/caps.
export function rayBlock(b,origin,direction){
 const [w,h,d]=blockSize(b),p=b.position;let near=0,far=Infinity;
 for(let i=0;i<3;i++){const lo=p[i]-(i===0?w/2:i===2?d/2:0),hi=lo+[w,h,d][i];if(Math.abs(direction[i])<1e-8){if(origin[i]<lo||origin[i]>hi)return Infinity;continue;}let a=(lo-origin[i])/direction[i],c=(hi-origin[i])/direction[i];if(a>c)[a,c]=[c,a];near=Math.max(near,a);far=Math.min(far,c);if(near>far)return Infinity;}
 if(b.shape!=='cylinder')return near;
 const ox=origin[0]-p[0],oz=origin[2]-p[2],a=direction[0]**2+direction[2]**2,c=ox*ox+oz*oz-1,bb=2*(ox*direction[0]+oz*direction[2]);
 if(a<1e-8)return c<=0?near:Infinity;const disc=bb*bb-4*a*c;if(disc<0)return Infinity;
 near=Math.max(near,(-bb-Math.sqrt(disc))/(2*a));far=Math.min(far,(-bb+Math.sqrt(disc))/(2*a));return far>=near?near:Infinity;
}
export function coverDistance(g,origin,direction){return Math.min(Infinity,...(g.blocks||[]).map(b=>rayBlock(b,origin,direction)));}
export function shootBoss(g,shot,now=Date.now()){
 shot.red=true;if(g.boss.hp<=0)return;
 const p=g.boss.position,delta=[p[0]-shot.origin[0],0,p[2]-shot.origin[2]],along=delta.reduce((s,v,i)=>s+v*shot.direction[i],0),side=Math.hypot(...delta.map((v,i)=>v-shot.direction[i]*along));
 if(along<0||along>shot.range||side>4.5+shot.radius||shot.origin[1]<p[1]||shot.origin[1]>p[1]+12||coverDistance(g,shot.origin,shot.direction)<Math.max(0,along-3))return;
 const damage=1+Math.floor(4*shot.charge);g.boss.hp=Math.max(0,g.boss.hp-damage);g.boss.revision++;g.boss.lastHit=now;
 shot.hit='Auntie';shot.damage=damage;shot.impact=shot.origin.map((v,i)=>v+shot.direction[i]*Math.max(0,along-2));
}
