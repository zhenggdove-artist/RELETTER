// Remove only automated test plants. Never remove player-created garden entries.
const url='http://127.0.0.1:3000';
const login=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:process.env.GAME_PASSWORD||'RAE1210'})});
if(!login.ok)throw new Error('Fixture cleanup login failed');
const cookie=login.headers.get('set-cookie').split(';')[0];
const entries=await (await fetch(url+'/api/entries',{headers:{Cookie:cookie}})).json();
for(const entry of entries)if(/^給 Rae 的花園測試 \d+$/.test(entry.text)&&Date.now()-new Date(entry.created_at).getTime()>120000)await fetch(url+'/api/entries/'+entry.id,{method:'DELETE',headers:{Cookie:cookie}});
console.log('Old automated test plants removed');
