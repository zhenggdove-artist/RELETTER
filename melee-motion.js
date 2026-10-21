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

// Independent authored keyframes: arm wind/contact, torso twist/lean, elbow and stance.
const choreography={
 whip:[[-1.9,-1,.2,-.4,1.4,-.9,-.8,.8,-.1,.15,-1.3,.2],[-.2,1.5,-.8,-1.7,-1.1,.3,.7,-.8,.15,-.1,-.6,-.2],[-2.2,.1,-.4,-.6,.2,-1.6,-.3,.4,-.2,.3,-1.6,.3],[-.4,-1.4,-.4,-1.8,1.2,-.3,-.9,.8,.2,-.1,-.7,.2],[-1.6,-.8,.2,-.1,1.5,-1.1,-.6,.9,-.1,.25,-1.4,-.3],[-2,-.4,-.6,-.5,1.8,-1.3,-.9,1.1,-.2,.25,-1.2,.4],[-2.5,-1,-.2,-.2,1.7,-1.2,-1,1.2,-.3,.4,-1.7,.5]],
 swatter:[[-1.6,.2,-.2,-.2,.1,-.3,-.1,.1,-.1,.35,-1.4,.1],[-.4,-.8,-.1,-.7,.9,-1.1,-.35,.4,.15,.1,-.5,.15],[-.5,1,-.9,-1,-.7,-.2,.3,-.5,.05,.2,-1.1,-.2],[-2.3,0,-.1,-.4,0,-.2,-.15,.15,-.15,.4,-.4,.3],[-.8,-.4,-1.5,-.6,.8,-.1,-.5,.4,.1,.15,-1.7,-.2],[-1.7,.5,-.4,-.3,-.5,-1.2,.4,-.55,-.1,.35,-1,.2],[-2.6,.15,-.1,-.1,-.1,-.2,-.25,.25,-.3,.55,-1.6,.45]],
 pan:[[-.8,-1,-.8,-.6,1.2,-1.3,-.7,.7,.15,.2,-.7,.35],[-.5,1.2,-1.2,-1.1,-1,-.3,.65,-.7,.2,.1,-1,-.3],[-.4,-.5,-.2,-2,.3,-.1,-.3,.35,.3,-.15,-1.8,.4],[-2.5,-.1,-.3,-.35,.15,-.5,-.1,.25,-.25,.5,-.6,.35],[-.6,-1.2,-.9,-.5,1.4,-1.2,-.8,.9,.2,.15,-.9,-.35],[-1.4,.6,-.4,-.3,-1.1,-1.2,.5,-.8,-.1,.4,-1.3,.3],[-2.7,-.3,-.3,-.2,.4,-.4,-.4,.6,-.35,.65,-1.5,.55]],
 planter:[[-.8,-.6,-.7,-.4,.65,-.55,-.4,.5,.1,.3,-1.8,.2],[-.6,.7,-.6,-1.1,-.7,-.5,.4,-.5,.2,-.1,-1.5,-.3],[-1.2,0,-.4,-.25,0,-.35,0,0,-.2,.45,-2,.5],[-2.2,-.25,-.5,-.4,.3,-.7,-.3,.4,-.3,.5,-1.4,.3],[-.7,-.9,-.5,-1.5,.8,-.6,-.7,.7,.3,-.2,-1.7,-.25],[-1.9,.8,-.6,-.6,-.8,-.7,.8,-.8,-.2,.35,-1.5,.4],[-2.5,0,-.5,-.3,0,-.6,-.2,.2,-.4,.6,-1.9,.6]],
 palm:[[-1.3,-1.2,-.9,-.5,1.3,-1.1,-.9,.9,.1,.25,-.9,.4],[-.5,1.3,-1,-1.4,-1.2,-.7,.9,-.9,.2,.1,-1.1,-.4],[-1.7,-.4,-.4,-.15,.5,-.5,-.4,.5,-.2,.5,-1.5,.55],[-2.6,.1,-.5,-.5,-.2,-.8,.2,-.35,-.3,.55,-.8,.5],[-.6,-1.4,-1.2,-1.6,1.2,-.6,-1,1,.3,-.15,-1.2,-.4],[-1.6,-1,-.8,-.6,1.6,-1.2,-1,1.1,-.15,.35,-1,.5],[-2.8,-.5,-.6,-.3,.6,-.8,-.6,.8,-.4,.7,-1.6,.65]]
};
const familyMoves={saber:moves};
for(const [family,tracks] of Object.entries(choreography))familyMoves[family]=tracks.map(v=>[
 pose(v.slice(0,3),[v[10],0,.12],[v[8],v[6],v[6]*.2],[0,v[6]*.45,0],v[11]),
 pose(v.slice(3,6),[-.18,0,family==='pan'?.6:.08],[v[9],v[7],-v[7]*.18],[0,v[7]*.45,0],-v[11])]);
export const meleeMoveNames={saber:['Cleave','Reverse crescent','Thrust','Rising star','Cross cut','Spiral','Astral bloom'],whip:['Sidewinder','Backlash','Sky lash','Figure eight','Twin coils','Vortex','Thorn tempest'],swatter:['Snap','Side slap','Backhand','Overhead swat','Net flick','Double tap','Prismatic trap'],pan:['Skillet sweep','Backhand clang','Flip uppercut','Iron smash','Heat sweep','Rim roll','Meteor sear'],planter:['Cradle swing','Root hook','Pot thrust','Earth drop','Bloom lift','Garden turn','World blossom'],palm:['Canopy sweep','Return sweep','Trunk ram','Timber fall','Leaf uppercut','Typhoon turn','Island storm']};
export function meleeTrailPattern(family,combo){
 const reverse=combo%2?-1:1,delay=combo===6?.1:.04;
 switch(family){
 case 'whip':return [[.3*reverse,-1.7*reverse,1.7*reverse,0],[-.9*reverse,1.5*reverse,-1.2*reverse,delay],[1.2,-.8,1.3,delay*2]];
 case 'swatter':return [[1.5, -.6*reverse,.6*reverse,0],[-.15, .65*reverse,-.65*reverse,delay]];
 case 'pan':return [[combo%3===0?1.45:.1,-1.3*reverse,1.3*reverse,0],[.1,-.8,.8,delay]];
 case 'planter':return [[1.3,-.75,.75,0],[.6*reverse,-.6,.9,delay],[-.6*reverse,.6,-.9,delay*2]];
 case 'palm':return [[.12,-1.8*reverse,1.8*reverse,0],[1.5,-1.3,1.3,delay]];
 default:return [[[.7,-1.25,1.25,0]],[[-.7,1.25,-1.25,0]],[[.08,-1.45,1.45,0]],[[1.45,-1.3,1.3,0]],[[.8,-1.3,1.3,0],[-.8,1.3,-1.3,.08]],[[.18,-1.5,1.5,0],[-.25,1.5,-1.5,.07]],[[.75,-1.5,1.5,0],[-.75,1.5,-1.5,.06],[.02,-1.6,1.6,.12]]][combo];
 }
}
export const meleeFamilies=['saber','whip','swatter','pan','planter','palm'];
export const meleeDuration=(family,combo)=> (combo===6?.65:.3)*({swatter:.85,pan:1.1,planter:1.18,palm:1.25,whip:1.05}[family]||1);
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function sampleMeleePose(family,combo,age){
 combo=Math.max(0,Math.min(6,combo||0));const duration=meleeDuration(family,combo),t=Math.max(0,Math.min(1,age/duration)),[wind,contact]=(familyMoves[family]||moves)[combo];
 const heavy=['pan','planter','palm'].includes(family),windEnd=({saber:.22,whip:.3,swatter:.16,pan:.28,planter:.32,palm:.34}[family]||.24),contactEnd=({saber:.44,whip:.52,swatter:.36,pan:.5,planter:.56,palm:.58}[family]||.46);
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
  turn:combo===5?smooth(t)*({saber:Math.PI*2,whip:-Math.PI*2,swatter:0,pan:0,planter:0,palm:Math.PI*2}[family]||0):0};
}
