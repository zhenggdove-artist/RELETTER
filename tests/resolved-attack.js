// Legacy rule assertions inspect the resolved attack, while impact-timing.test.js
// tests the real launch -> waiting -> contact sequence without this helper.
import {battleAction as launch} from '../server/game-rules.js';import {flushBossHits} from '../server/world-rules.js';
export function battleAction(g,...args){const result=launch(g,...args),due=g.pendingBossHits?.at(-1)?.due;if(due)flushBossHits(g,due);return result;}
