// Shared progression formulas. Total experience is the persisted source of truth.
export function xpForNextLevel(level){const n=Math.max(0,Math.floor(level)-1);return 5*Math.ceil((10+6*n+1.5*n*n)/5);}
export function progression(total=0){total=Number.isFinite(total)?Math.max(0,Math.floor(total)):0;let level=1,xp=total;while(xp>=xpForNextLevel(level)&&level<10000){xp-=xpForNextLevel(level);level++;}const n=level-1;return {level,totalXp:total,xp,nextXp:xpForNextLevel(level),maxHp:3+n,attackMultiplier:1+.04*n,speedMultiplier:1+.3*(1-Math.exp(-n/20)),jumpMultiplier:1+.2*(1-Math.exp(-n/25))};}
export function playerStats(game,name){return progression(game.progression?.[name]?.xp||0);}
export function awardKill(game,name){if(!['Ely','Rae'].includes(name))return;game.progression??={};const p=game.progression[name]??={xp:0,kills:0};p.xp+=10;p.kills++;}
