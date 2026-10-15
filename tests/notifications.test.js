import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configured,notificationMail,deliverNotification,recipients} from '../cloudflare/notifications.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('EmailJS uses a fixed template without dynamic recipient overrides and rejects failed sends',async()=>{
 const env={EMAILJS_SERVICE_ID:'service_test',EMAILJS_TEMPLATE_ID:'template_test',EMAILJS_PUBLIC_KEY:'test-public'},event={kind:'chat',name:'Ely',text:'Hello',time:Date.now()};
 assert.equal(configured(env),true);assert.equal(configured({...env,EMAILJS_TEMPLATE_ID:''}),false);
 assert.equal(await deliverNotification(env,'chat-test',event,async(url,request)=>{
  assert.equal(url,'https://api.emailjs.com/api/v1.0/email/send');const body=JSON.parse(request.body);
  assert.equal(body.service_id,'service_test');assert.equal(body.template_id,'template_test');assert.equal(body.user_id,'test-public');
  assert.deepEqual(Object.keys(body.template_params).sort(),['event_id','message','subject']);assert.ok(body.template_params.message.includes('Hello'));
  return new Response('OK');
 }), 'chat-test');
 await assert.rejects(deliverNotification(env,'chat-test',event,async()=>new Response('quota',{status:429})),e=>e.retryAfterMs===60000);
 await assert.rejects(deliverNotification(env,'chat-test',event,async()=>new Response('error',{status:403})),/HTTP_403/);
 await assert.rejects(deliverNotification(env,'chat-test',event,async()=>new Response('<html>error</html>')),/INVALID_RESPONSE/);
});
test('Brevo sends to both recipients with stable UUID, verified sender and quota deferral',async()=>{
 const env={BREVO_API_KEY:'test-only',BREVO_SENDER_EMAIL:'zhenggdove@gmail.com'},event={kind:'chat',name:'Rae',text:'Hello',time:Date.now()};
 assert.equal(configured(env),true);assert.equal(configured({BREVO_API_KEY:'test-only'}),false);
 const keys=[];
 for(let i=0;i<2;i++)assert.equal(await deliverNotification(env,'chat-123',event,async(url,request)=>{
  assert.equal(url,'https://api.brevo.com/v3/smtp/email');assert.equal(request.headers['api-key'],'test-only');
  const body=JSON.parse(request.body);assert.deepEqual(body.to,recipients.map(email=>({email})));assert.equal(body.sender.email,env.BREVO_SENDER_EMAIL);assert.equal(body.textContent.includes('Hello'),true);
  assert.match(body.headers.idempotencyKey,/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);keys.push(body.headers.idempotencyKey);
  return Response.json({messageId:'brevo-id'});
 }), 'brevo-id');
 assert.equal(keys[0],keys[1]);
 await assert.rejects(deliverNotification(env,'chat-123',event,async()=>Response.json({code:'not_enough_credits'},{status:400})),e=>e.retryAfterMs===3600000);
 await assert.rejects(deliverNotification(env,'chat-123',event,async()=>Response.json({},{status:401})),/HTTP_401/);
 await assert.rejects(deliverNotification(env,'chat-123',event,async()=>Response.json({})),/INVALID_RESPONSE/);
 assert.equal(await deliverNotification(env,'chat-123',event,async()=>Response.json({code:'duplicate_parameter',message:'idempotency key already used'},{status:400})),'duplicate:chat-123');
 await assert.rejects(deliverNotification(env,'chat-123',event,async()=>Response.json({code:'duplicate_parameter',message:'invalid recipient'},{status:400})),/HTTP_400/);
});
test('all event kinds notify both intended recipients with Taiwan time and literal user text',()=>{
 for(const kind of ['online','plant','chat']){
  const mail=notificationMail({kind,name:'Rae',text:'<script>hello</script>',time:Date.parse('2026-10-15T06:30:00Z')},'Garden <notify@example.com>');
  assert.deepEqual(mail.to,['zhenggdove@gmail.com','partoftheszene@gmail.com']);assert.ok(mail.text.includes('14:30'));assert.ok(mail.text.includes('<script>hello</script>'));assert.ok(mail.subject.includes('Rae'));
 }
 assert.equal(configured({}),false);assert.equal(configured({RESEND_API_KEY:'test',NOTIFICATION_FROM:'test@example.com'}),true);
});
test('free Google relay validates authentication, fixed recipients, duplicates and daily quota',async()=>{
 const values=new Map([['RELETTER_TOKEN','local-test-token']]);let mails=0,quota=100;
 const context=vm.createContext({console,Date,Number,JSON,Object,PropertiesService:{getScriptProperties:()=>({getProperty:k=>values.get(k),setProperty:(k,v)=>values.set(k,v),deleteProperty:k=>values.delete(k),getProperties:()=>Object.fromEntries(values)})},Utilities:{formatDate:()=> '2026 10.15 14:30:00'},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:mail=>{mails++;assert.equal(mail.to,'zhenggdove@gmail.com,partoftheszene@gmail.com');}},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}});
 vm.runInContext(await readFile('cloudflare/GoogleMailRelay.gs','utf8'),context);
 const body={token:'local-test-token',id:'chat-test',event:{kind:'chat',name:'Ely',text:'Hello',time:Date.now()}},post=value=>context.doPost({postData:{contents:JSON.stringify(value)}});
 assert.equal(post({...body,token:'wrong'}).code,'AUTH');assert.equal(mails,0);
 assert.equal(post(body).ok,true);assert.equal(post(body).duplicate,true);assert.equal(mails,1);
 quota=1;assert.equal(post({...body,id:'chat-another'}).code,'QUOTA');assert.equal(mails,1);
 quota=100;assert.equal(post({...body,id:'chat-invalid',event:{...body.event,name:'Mallory'}}).code,'INVALID');assert.equal(mails,1);
});
test('Google relay transport defers exhausted free quota and accepts only the Google deployment URL',async()=>{
 const env={GOOGLE_MAIL_RELAY_URL:'https://script.google.com/macros/s/test-deployment/exec',GOOGLE_MAIL_RELAY_TOKEN:'test'},event={kind:'online',name:'Rae',time:Date.now()};
 assert.equal(configured(env),true);
 assert.equal(await deliverNotification(env,'online-123',event,async(url,request)=>{assert.equal(JSON.parse(request.body).token,'test');return Response.json({ok:true,id:'online-123'});}), 'online-123');
 await assert.rejects(deliverNotification(env,'online-123',event,async()=>Response.json({ok:false,code:'QUOTA'})),error=>error.retryAfterMs===3600000);
 await assert.rejects(deliverNotification({...env,GOOGLE_MAIL_RELAY_URL:'https://example.com'},'online-123',event),/INVALID_RELAY_URL/);
});
test('provider request is idempotent and does not falsely report delivery failures as success',async()=>{
 const env={RESEND_API_KEY:'test',NOTIFICATION_FROM:'test@example.com'},event={kind:'chat',name:'Ely',text:'Hello',time:Date.now()};
 let calls=0;const transport=async(url,request)=>{calls++;assert.equal(url,'https://api.resend.com/emails');assert.equal(request.headers['Idempotency-Key'],'reletter/chat-123');assert.deepEqual(JSON.parse(request.body).to,recipients);return Response.json({id:'provider-id'});};
 assert.equal(await deliverNotification(env,'chat-123',event,transport),'provider-id');assert.equal(calls,1);
 await assert.rejects(deliverNotification({},'chat-123',event,transport),/NOT_CONFIGURED/);assert.equal(calls,1);
 await assert.rejects(deliverNotification(env,'chat-123',event,async()=>new Response('',{status:429})),/HTTP_429/);
 await assert.rejects(deliverNotification(env,'chat-123',event,async()=>Response.json({error:'bad'})),/INVALID_RESPONSE/);
});
