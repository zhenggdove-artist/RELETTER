export const recipients=['zhenggdove@gmail.com','partoftheszene@gmail.com'];
export const configured=env=>Boolean((env.GOOGLE_MAIL_RELAY_URL&&env.GOOGLE_MAIL_RELAY_TOKEN)||(env.RESEND_API_KEY&&env.NOTIFICATION_FROM));
export function notificationMail(event,from){
 const date=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'medium',timeStyle:'medium',hourCycle:'h23'}).format(new Date(event.time));
 const action={online:'上線了',plant:'在花園留下了留言',chat:'傳送了聊天留言'}[event.kind];
 return {from,to:recipients,subject:`RELETTER · ${event.name} ${action}`,text:`${event.name} ${action}\n時間：${date}（台灣時間）${event.text?'\n\n'+event.text:''}\n\nhttps://reletter-garden.zhenggdove-artist.workers.dev/`};
}
export async function deliverNotification(env,id,event,transport=fetch){
 if(!configured(env))throw new Error('EMAIL_NOT_CONFIGURED');
 if(env.GOOGLE_MAIL_RELAY_URL&&env.GOOGLE_MAIL_RELAY_TOKEN){
  const url=new URL(env.GOOGLE_MAIL_RELAY_URL);if(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname))throw new Error('EMAIL_INVALID_RELAY_URL');
  const response=await transport(url.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:env.GOOGLE_MAIL_RELAY_TOKEN,id,event}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`EMAIL_HTTP_${response.status}`);const result=await response.json();if(!result.ok){const error=new Error('EMAIL_RELAY_'+result.code);if(result.code==='QUOTA')error.retryAfterMs=3600000;throw error;}return result.id;
 }

 const response=await transport('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`reletter/${id}`},body:JSON.stringify(notificationMail(event,env.NOTIFICATION_FROM)),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(`EMAIL_HTTP_${response.status}`);
 const result=await response.json();if(!result.id)throw new Error('EMAIL_INVALID_RESPONSE');return result.id;
}
