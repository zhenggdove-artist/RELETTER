// Original authored poses: anticipation, fast contact, follow-through and deliberate recovery.
// Rotations are additive to the rig's animated pose; no movement is granted by a visual lunge.
const pose=(arm,fore,spine,hips,legs)=>({
 RightArm:arm,RightForeArm:fore,Spine2:spine,Hips:hips,
 LeftArm:[-.65,.15,.55],LeftForeArm:[-1.05,0,-.15],
 RightUpLeg:[legs,0,-.06],LeftUpLeg:[-legs*.65,0,.08],
 RightLeg:[Math.max(0,-legs)*1.2,0,0],LeftLeg:[Math.max(0,legs)*1.2,0,0],
 Head:[-.08,-spine[1]*.4,0]
});
const moves=[
 [pose([-1.55,-.55,-.3],[-.85,0,.15],[.05,-.55,-.14],[0,-.25,0],.22),pose([-.35,1.15,-1.05],[-.2,0,.05],[.2,.6,.14],[0,.3,0],-.24)],
 [pose([-.3,1,-1.05],[-1.1,.1,0],[.08,.5,.1],[0,.22,0],-.18),pose([-1.5,-.8,-.2],[-.3,0,.1],[.1,-.65,-.1],[0,-.3,0],.25)],
 [pose([-.5,-.35,-.25],[-1.65,0,.1],[-.12,-.3,0],[0,-.2,0],.28),pose([-1.35,.12,-.12],[-.08,0,.06],[.27,.15,0],[0,.16,0],-.4)],
 [pose([-2.3,-.1,-.2],[-.65,0,.1],[-.2,-.14,0],[0,-.1,0],.12),pose([-.65,.2,-.24],[-.3,0,.12],[.36,.2,0],[0,.1,0],-.3)],
 [pose([-.2,-.8,-.95],[-.5,0,.15],[.2,-.65,-.2],[0,-.3,0],.27),pose([-1.95,.7,-.3],[-.45,0,.08],[-.18,.55,.12],[0,.3,0],-.22)],
 [pose([-1.25,-.9,-.75],[-.6,0,.2],[.1,-.6,0],[0,-.35,0],.2),pose([-.8,1.1,-1.2],[-.2,0,.05],[.2,.65,0],[0,.35,0],-.3)],
 [pose([-2.25,-.3,-.3],[-1,0,.2],[-.22,-.2,0],[0,-.18,0],.4),pose([-.55,.3,-.25],[-.12,0,.05],[.42,.25,.05],[0,.12,0],-.42)]
];
export const meleeFamilies=['saber','whip','swatter','pan','planter','palm'];
export const meleeDuration=(family,combo)=> (combo===6?.65:.3)*({swatter:.85,pan:1.1,planter:1.18,palm:1.25,whip:1.05}[family]||1);
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function sampleMeleePose(family,combo,age){
 combo=Math.max(0,Math.min(6,combo||0));const duration=meleeDuration(family,combo),t=Math.max(0,Math.min(1,age/duration)),[wind,contact]=moves[combo];
 const heavy=['pan','planter','palm'].includes(family),windEnd=heavy?.36:.27,contactEnd=heavy?.58:.46;
 let a,b,k,phase;
 if(t<windEnd){a={};b=wind;k=smooth(t/windEnd);phase='windup';}
 else if(t<contactEnd){a=wind;b=contact;k=smooth((t-windEnd)/(contactEnd-windEnd));phase='strike';}
 else if(t<.69){a=contact;b=contact;k=0;phase='follow-through';}
 else{a=contact;b={};k=smooth((t-.69)/.31);phase='recovery';}
 const bones={};for(const key of Object.keys(wind))bones[key]=mix(a[key]||[0,0,0],b[key]||[0,0,0],k);
 const envelope=Math.sin(t*Math.PI),drive=Math.sin(smooth((t-windEnd)/(1-windEnd))*Math.PI);
 if(family==='whip'){bones.RightArm[1]*=1.3;bones.Spine2[1]*=1.2;bones.RightForeArm[0]+=-Math.sin(t*Math.PI*4)*.3*envelope;}
 if(family==='swatter'){bones.RightForeArm[0]*=.65;bones.RightArm[2]*=1.15;}
 if(family==='pan')bones.RightForeArm[2]+=.35*envelope;
 if(family==='planter'||family==='palm'){
  bones.LeftArm=[bones.RightArm[0]*.85,-bones.RightArm[1]*.3,-bones.RightArm[2]*.65];
  bones.LeftForeArm=[bones.RightForeArm[0]-.25*envelope,0,-.2*envelope];
  bones.Spine2[0]*=1.25;
 }
 return {bones,phase,duration,offset:[combo===5?Math.sin(t*Math.PI*2)*.12:0,
  combo===6?Math.sin(Math.min(1,t/.58)*Math.PI)*.22-Math.sin(t*Math.PI)*.06:-Math.sin(t*Math.PI)*.035,
  drive*(combo===2?.32:heavy?.17:.12)],
  turn:combo===5?smooth(t)*Math.PI*2:0};
}
