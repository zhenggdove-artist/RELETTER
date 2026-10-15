export const recipients=['zhenggdove@gmail.com','partoftheszene@gmail.com'];
export const configured=env=>Boolean((env.EMAILJS_SERVICE_ID&&env.EMAILJS_TEMPLATE_ID&&env.EMAILJS_PUBLIC_KEY)||(env.BREVO_API_KEY&&env.BREVO_SENDER_EMAIL)||(env.GOOGLE_MAIL_RELAY_URL&&env.GOOGLE_MAIL_RELAY_TOKEN)||(env.RESEND_API_KEY&&env.NOTIFICATION_FROM));
export function notificationMail(event,from){
 const date=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'medium',timeStyle:'medium',hourCycle:'h23'}).format(new Date(event.time));
 const action={online:'上線了',plant:'在花園留下了留言',chat:'傳送了聊天留言'}[event.kind];
 return {from,to:recipients,subject:`RELETTER · ${event.name} ${action}`,text:`${event.name} ${action}\n時間：${date}（台灣時間）${event.text?'\n\n'+event.text:''}\n\nhttps://reletter-garden.zhenggdove-artist.workers.dev/`};
}
export async function deliverNotification(env,id,event,transport=fetch){
 if(!configured(env))throw new Error('EMAIL_NOT_CONFIGURED');
 if(env.EMAILJS_SERVICE_ID&&env.EMAILJS_TEMPLATE_ID&&env.EMAILJS_PUBLIC_KEY){
  const mail=notificationMail(event,'RELETTER');
  const response=await transport('https://api.emailjs.com/api/v1.0/email/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({service_id:env.EMAILJS_SERVICE_ID,template_id:env.EMAILJS_TEMPLATE_ID,user_id:env.EMAILJS_PUBLIC_KEY,...(env.EMAILJS_PRIVATE_KEY?{accessToken:env.EMAILJS_PRIVATE_KEY}:{}),template_params:{subject:mail.subject,message:mail.text,event_id:id}}),signal:AbortSignal.timeout(15000)});
  const result=await response.text();
  if(!response.ok){const error=new Error(`EMAIL_HTTP_${response.status}`);if(response.status===429)error.retryAfterMs=60000;throw error;}
  if(result.trim()!=='OK')throw new Error('EMAIL_INVALID_RESPONSE');return id;
 }
 if(env.BREVO_API_KEY&&env.BREVO_SENDER_EMAIL){
  const mail=notificationMail(event,env.BREVO_SENDER_EMAIL);
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`reletter/${id}`)));
  bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes.slice(0,16),b=>b.toString(16).padStart(2,'0')).join('');
  const key=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  const response=await transport('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':env.BREVO_API_KEY,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({sender:{name:'RELETTER',email:env.BREVO_SENDER_EMAIL},to:recipients.map(email=>({email})),subject:mail.subject,textContent:mail.text,headers:{idempotencyKey:key},tags:['reletter',event.kind]}),signal:AbortSignal.timeout(15000)});
  if(!response.ok){
   const result=await response.json().catch(()=>({}));
   if(result.code==='duplicate_parameter'&&/idempotency/i.test(result.message||''))return `duplicate:${id}`;
   const error=new Error(`EMAIL_HTTP_${response.status}`);
   if(response.status===429||result.code==='not_enough_credits')error.retryAfterMs=3600000;
   throw error;
  }
  const result=await response.json();if(!result.messageId)throw new Error('EMAIL_INVALID_RESPONSE');return result.messageId;
 }
 if(env.GOOGLE_MAIL_RELAY_URL&&env.GOOGLE_MAIL_RELAY_TOKEN){
  const url=new URL(env.GOOGLE_MAIL_RELAY_URL);if(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname))throw new Error('EMAIL_INVALID_RELAY_URL');
  const response=await transport(url.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:env.GOOGLE_MAIL_RELAY_TOKEN,id,event}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`EMAIL_HTTP_${response.status}`);const result=await response.json();if(!result.ok){const error=new Error('EMAIL_RELAY_'+result.code);if(result.code==='QUOTA')error.retryAfterMs=3600000;throw error;}return result.id;
 }

 const response=await transport('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`reletter/${id}`},body:JSON.stringify(notificationMail(event,env.NOTIFICATION_FROM)),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(`EMAIL_HTTP_${response.status}`);
 const result=await response.json();if(!result.id)throw new Error('EMAIL_INVALID_RESPONSE');return result.id;
}
