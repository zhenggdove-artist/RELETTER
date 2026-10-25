import {ADVANCED_SPELLS,advancedSpell,spatialContains} from './advanced-enemy-spells.js';
// Shared timings and geometry: rendering and server damage use the same definitions.
export const ENEMY_SPELLS=[
 ['bolt','Ember Comet',5,1,8,7,1000,1700,'projectile','origin'],
 ['shockwave','Cinder Shockwave',5,1.1,10,2,1100,1200,'ring','origin'],
 ['summon','Soul Gate',12,0,6,12,1500,2200,'summon','origin'],
 ['volley','Storm Serpents',24,1.2,12,8,1100,2000,'projectile','origin'],
 ['eruption','Infernal Pillar',12,1.6,6,22,1400,2400,'pulse','target'],
 ['meteor','Astral Impact',24,2.1,9,24,1700,1500,'impact','target'],
 ['nova','Scarlet Supernova',30,1.7,16,5,1600,1500,'ring','origin'],
 ['blizzard','Glacial Tempest',12,.65,11,12,1600,3800,'pulse','target'],
 ['cyclone','Razor Cyclone',12,.75,8,19,1300,3000,'pulse','target'],
 ['thunder-cage','Thunder Cage',24,1.5,10,20,1700,2000,'pulse','target'],
 ['venom-tide','Venom Tide',5,.4,7,4,1500,4200,'pulse','target'],
 ['soul-vortex','Soul Vortex',24,.8,10,14,1700,3200,'pulse','target'],
 ['solar-rain','Solar Rain',30,1,13,24,1900,3200,'pulse','target'],
 ['frost-geyser','Frost Geysers',12,1.3,8,15,1400,2200,'impact','target'],
 ['blood-roses','Crimson Briars',24,.9,10,10,1700,3000,'pulse','target'],
 ['eclipse','Eclipse Collapse',40,2.6,17,22,2200,2200,'impact','target'],
 ['comet-helix','Twin Comet Helix',30,1.4,12,18,1700,2600,'pulse','target'],
 ['sandstorm','Glass Sandstorm',5,.5,8,9,1400,3200,'pulse','target'],
 ['tidal-crown','Tidal Crown',30,1.7,15,13,1900,2200,'ring','target'],
 ['void-lotus','Abyssal Lotus',40,2.2,18,20,2300,2600,'impact','target']
].map(([id,name,level,multiplier,radius,height,windup,duration,kind,anchor],mode)=>({id,name,level,multiplier,radius,height,windup,duration,kind,anchor,mode}));
export const FOREMAN_SPELLS=[{id:'rat-swarm',name:'Vermin Covenant',level:50,multiplier:0,radius:8,height:4,windup:1400,duration:1600,kind:'summon',anchor:'origin',mode:20},{id:'timber-fall',name:'Falling Forest',level:50,multiplier:1.5,radius:16,height:15,windup:2100,duration:3000,kind:'impact',anchor:'target',mode:21},{id:'dark-stomp',name:'Seismic Rage',level:50,multiplier:1.3,radius:20,height:2,windup:1200,duration:1600,kind:'ring',anchor:'origin',mode:22}];
FOREMAN_SPELLS.push({id:'saw-sparks',name:'Chainsaw Sparks',level:50,multiplier:.6,radius:14,height:5,windup:0,duration:1200,kind:'pulse',anchor:'origin',mode:23});
export const enemySpell=id=>advancedSpell(id)||FOREMAN_SPELLS.find(s=>s.id===id)||ENEMY_SPELLS.find(s=>s.id===id)||ENEMY_SPELLS[1];
export const spellsForLevel=level=>[...ENEMY_SPELLS,...ADVANCED_SPELLS].filter(s=>s.level<=level);
export function spellCenter(s){return enemySpell(s.type).anchor==='target'?s.aim:s.origin;}
export function spellRadius(s,now){const d=enemySpell(s.type),r=s.radius||d.radius;return d.kind==='ring'?r*Math.min(1,Math.max(0,(now-s.start)/d.duration)):['meteor','eclipse'].includes(d.id)?r*Math.max(0,Math.min(1,((now-s.start)/d.duration-.3)/.7)):r;}
export function spellContains(s,p,now){const d=enemySpell(s.type);if(d.air)return spatialContains(s,p,now);if(s.phase!=='active'||now>=s.end)return false;const c=spellCenter(s),r=s.radius||d.radius,u=Math.max(0,Math.min(1,(now-s.start)/d.duration)),x=p[0]-c[0],z=p[2]-c[2],y=p[1]-c[1],dist=Math.hypot(x,z),a=Math.atan2(z,x);if(y<-.5||y>d.height)return false;
 if(s.type==='saw-sparks')return sparkPositions(s,now).some(q=>Math.hypot(q[0]-p[0],q[1]-(p[1]+.8),q[2]-p[2])<1.15);
 if(d.kind==='summon'||d.kind==='projectile')return false;
 if(s.type==='timber-fall'){const tilt=Math.min(1,u/.3)*Math.PI/2;for(let i=0;i<7;i++){const angle=i*2.39996;for(let k=0;k<=20;k++){const along=k/20*d.height,rr=r*.75-along*Math.sin(tilt),qy=Math.max(.08,along*Math.cos(tilt));if(Math.hypot(x-Math.cos(angle)*rr,z-Math.sin(angle)*rr)<1.3&&Math.abs(y+.7-qy)<1.8)return true;}}return false;}
 if(d.kind==='ring'){const h=s.type==='dark-stomp'?2:s.type==='tidal-crown'?d.height*(.4+.6*Math.pow(Math.abs(Math.sin(a*6)),3)):d.height*(1-u*.5);return y<=h&&Math.abs(dist-spellRadius(s,now))<1.1;}
 if(s.type==='meteor'||s.type==='eclipse'){if(u<.3)return false;const q=(u-.3)/.7;return dist<r*q&&y<=Math.sin(q*Math.PI)*d.height*(s.type==='meteor'?.3:.5)+.5;}
 if(s.type==='frost-geyser'){for(let i=0;i<7;i++){const theta=i*Math.PI*2/7,rr=i===0?0:r*.65;if(Math.hypot(x-Math.cos(theta)*rr,z-Math.sin(theta)*rr)<1.3&&y<=d.height*(.4+.6*Math.sin(u*Math.PI)))return true;}return false;}
 if(s.type==='eruption')return dist<r*.9*(1-.65*y/d.height)+.6;
 if(s.type==='cyclone')return Math.abs(dist-r*(.12+.8*y/d.height)*.85)<r*.18+.6;
 if(s.type==='thunder-cage'){if(Math.abs(y-d.height*.8)<1)return dist<r;for(let i=0;i<9;i++)if(Math.hypot(x-Math.cos(i*Math.PI*2/9)*r*.8,z-Math.sin(i*Math.PI*2/9)*r*.8)<1.4)return true;return false;}
 if(s.type==='solar-rain'){for(let i=0;i<24;i++){const a=i*2.39996,rr=Math.sqrt(i/24)*r;if(Math.hypot(x-Math.cos(a)*rr,z-Math.sin(a)*rr)<.9)return true;}return false;}
 if(s.type==='soul-vortex')return Math.abs(dist-r*(.1+Math.abs(y/d.height-.5)*1.5))<1;
 if(s.type==='blood-roses')return dist<r&&y<=Math.sin(dist/r*Math.PI)*d.height;
 if(s.type==='comet-helix')return Math.abs(dist-r*(.2+.6*y/d.height))<1;
 if(s.type==='void-lotus')return dist<r*Math.min(1,u*3)&&Math.abs(y-(dist/r)*d.height*.7)<2;
 return dist<r;}
export function sparkPositions(s,now){const t=(now-s.start)/1000;if(t<0||t>1.2)return [];const a=Math.atan2(s.aim[0]-s.origin[0],s.aim[2]-s.origin[2]),points=[];for(let i=0;i<48;i++){const delay=(i%8)*.055,age=t-delay;if(age<0||age>.65)continue;const angle=a+Math.sin(i*12.9898)*.8,speed=9+(i%7)*1.7;points.push([s.origin[0]+Math.sin(angle)*speed*age,s.origin[1]+1.2+(3+i%5)*age-10*age*age,s.origin[2]+Math.cos(angle)*speed*age]);}return points;}
