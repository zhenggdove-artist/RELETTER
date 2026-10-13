import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('HTML returned by a static host produces an actionable message instead of a JSON parser exception',async()=>{
  const source=await readFile('game-additions.js','utf8');
  const start=source.indexOf('async function api('),end=source.indexOf('\nfunction message',start);
  const context=vm.createContext({fetch:async()=>new Response('<html><head>404</head></html>',{status:404,headers:{'Content-Type':'text/html'}}),location:{hostname:'example.github.io'},Response,JSON,Error});
  vm.runInContext(source.slice(start,end)+'\nglobalThis.request=api;',context);
  await assert.rejects(context.request('/api/login',{password:'diagnostic-invalid'}),/server|backend/i);
});
