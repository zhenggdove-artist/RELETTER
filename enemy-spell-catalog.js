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
export const enemySpell=id=>FOREMAN_SPELLS.find(s=>s.id===id)||ENEMY_SPELLS.find(s=>s.id===id)||ENEMY_SPELLS[1];
export const spellsForLevel=level=>ENEMY_SPELLS.filter(s=>s.level<=level);
export function spellCenter(s){return enemySpell(s.type).anchor==='target'?s.aim:s.origin;}
export function spellRadius(s,now){const d=enemySpell(s.type),r=s.radius||d.radius;return d.kind==='ring'?r*Math.min(1,Math.max(0,(now-s.start)/d.duration)):['meteor','eclipse'].includes(d.id)?r*Math.max(0,Math.min(1,((now-s.start)/d.duration-.3)/.7)):r;}
export function spellContains(s,p,now){const d=enemySpell(s.type);if(d.kind==='impact'&&now-s.start<d.duration*.3)return false;const c=spellCenter(s),r=spellRadius(s,now),dist=Math.hypot(p[0]-c[0],p[2]-c[2]);return p[1]>=-.5&&p[1]<=d.height&&(d.kind==='ring'?Math.abs(dist-r)<1.25:dist<r);}
