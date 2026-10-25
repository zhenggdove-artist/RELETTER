// Shared 3D trajectories: warning, particles and authoritative collision use these same volumes.
export const ADVANCED_SPELLS=[
 ['sky-lances','Sky Lances',30,1.1,1800,1800,'SIDESTEP'],['orbit-reapers','Orbit Reapers',35,1.25,2000,2400,'LEAVE THE RINGS'],['crossfire','Crossfire Cathedral',40,1.4,2100,1800,'MOVE DIAGONALLY'],['rising-helix','Rising Serpents',30,1.1,1900,2600,'LEAVE THE SPIRAL'],['starfall','Shattered Starfall',45,1.6,2300,2200,'DODGE THE MARKERS'],['soul-net','Soul Net',40,1.2,2200,2200,'CHANGE ALTITUDE'],['thunder-spears','Thunder Spears',35,1.3,1800,1800,'SIDESTEP'],['saw-crescent','Chainsaw Crescent',50,1.5,2100,2000,'DODGE SIDEWAYS'],['void-bloom','Void Sphere Bloom',50,1.8,2400,2200,'ESCAPE THE SPHERE'],['sky-guillotine','Sky Guillotine',50,1.8,2400,2000,'LEAVE THE RED WALL']
].map(([id,name,level,multiplier,windup,duration,hint],i)=>({id,name,level,multiplier,windup,duration,hint,mode:24+i,kind:'spatial',anchor:'target',radius:16,height:60,air:true,index:i}));
export const advancedSpell=id=>ADVANCED_SPELLS.find(s=>s.id===id);
export function spatialVolumes(s,now){const d=advancedSpell(s.type);if(!d)return [];const u=Math.max(0,Math.min(1,(now-s.start)/d.duration)),c=s.aim,o=s.origin,a=Math.atan2(c[0]-o[0],c[2]-o[2]),out=[],put=(x,y,z,r=.8)=>out.push([x,y,z,r]),local=(x,y,z,r)=>put(c[0]+x,c[1]+y,c[2]+z,r);
 switch(d.index){
 case 0:for(let k=0;k<5;k++){const t=k*2.4,rr=k?5:0;for(let j=0;j<8;j++)local(Math.cos(t)*rr,18*(1-u)-j*.8,Math.sin(t)*rr,.85);}break;
 case 1:for(let k=0;k<3;k++)for(let j=0;j<18;j++){const t=j/18*Math.PI*2+u*3;local(Math.cos(t)*(3+k*2.5),Math.sin(t*2+u*4)*.6+(k-1)*3,Math.sin(t)*(3+k*2.5),.7);}break;
 case 2:for(let k=0;k<2;k++)for(let j=0;j<27;j++){const t=u*Math.PI*.65+k*Math.PI/2,v=(j-13)*1.;local(Math.cos(t)*v,0,Math.sin(t)*v,.85);}break;
 case 3:for(let k=0;k<2;k++)for(let j=0;j<28;j++){const y=j*1.2,t=j*.28+u*6+k*Math.PI;put(c[0]+Math.cos(t)*5,y,c[2]+Math.sin(t)*5,1.);}break;
 case 4:for(let k=0;k<7;k++){const t=k*2.4,rr=Math.sqrt(k/7)*11;local(Math.cos(t)*rr,22*(1-u)-3,Math.sin(t)*rr,1.6);}break;
 case 5:for(let k=-2;k<=2;k++)for(let j=0;j<12;j++){const v=j*1.8-10;local(k*4,(u-.5)*9,v,.65);}break;
 case 6:for(let k=-2;k<=2;k++)for(let j=0;j<8;j++){const v=Math.max(0,u-j*.02);put(o[0]+(c[0]-o[0])*v+Math.cos(a)*k*2,o[1]+(c[1]-o[1])*v,o[2]+(c[2]-o[2])*v-Math.sin(a)*k*2,.85);}break;
 case 7:for(let j=0;j<40;j++){const t=(j/39-.5)*Math.PI,side=Math.sin(t)*(3+u*8),ahead=u*35+Math.cos(t)*3;put(o[0]+Math.sin(a)*ahead+Math.cos(a)*side,o[1]+(c[1]-o[1])*u+Math.cos(t)*2,o[2]+Math.cos(a)*ahead-Math.sin(a)*side,1.);}break;
 case 8:for(let k=0;k<3;k++)for(let j=0;j<20;j++){const t=j/20*Math.PI*2,r=2+u*13;local(k===0?0:Math.cos(t)*r,k===1?0:Math.sin(t)*r,k===2?0:(k===0?Math.cos(t):Math.sin(t))*r,1.);}break;
 case 9:for(let j=0;j<60;j++){const x=(j%12-5.5)*1.6,y=24*(1-u)-Math.floor(j/12)*1.2;local(x,y,0,1.);}break;
 }return out;
}
export function spatialContains(s,p,now){if(s.phase!=='active'||now<s.start||now>=s.end)return false;return spatialVolumes(s,now).some(q=>Math.hypot(p[0]-q[0],p[1]+.8-q[1],p[2]-q[2])<=q[3]+.55);}
