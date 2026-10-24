import {progression} from '../progression.js';
export const deathProtected=(g,name,now)=>now<(g.deaths?.[name]?.protectedUntil||0);
// One authoritative transaction per death, shared by contact, spells, minions and PvP.
export function applyDeathPenalty(g,name,now,cause){if(deathProtected(g,name,now))return null;g.progression??={};g.wallets??={};g.deaths??={};const p=g.progression[name]??={xp:0,kills:0},xp=Math.min(p.xp||0,Math.max(1,Math.ceil(progression(p.xp).nextXp*.1))),coins=Math.ceil(Math.max(0,g.wallets[name]||0)/2);p.xp=Math.max(0,(p.xp||0)-xp);g.wallets[name]=Math.max(0,(g.wallets[name]||0)-coins);const event={time:now,xp,coins,cause,protectedUntil:now+5000};g.deaths[name]=event;g.hits??={};g.hits[name]=0;if(g.playerEffects)delete g.playerEffects[name];return event;}
