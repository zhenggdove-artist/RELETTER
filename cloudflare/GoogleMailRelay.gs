/** RELETTER-only mail relay. No inbox/Drive access is requested. */
function initializeRelay() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('RELETTER_TOKEN')) props.setProperty('RELETTER_TOKEN', Utilities.getUuid() + Utilities.getUuid());
  console.log('RELETTER relay ready. Remaining recipient quota: ' + MailApp.getRemainingDailyQuota());
}
function doGet() { return reply({ok:true,service:'RELETTER mail relay'}); }
function reply(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return reply({ok:false,code:'BUSY'});
  try {
    const body = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('RELETTER_TOKEN');
    if (!token || body.token !== token) return reply({ok:false,code:'AUTH'});
    if (!/^[a-zA-Z0-9-]{1,120}$/.test(body.id || '')) return reply({ok:false,code:'INVALID'});
    if (props.getProperty('sent_' + body.id)) return reply({ok:true,id:body.id,duplicate:true});
    const event = body.event;
    const action = {online:'上線了',plant:'在花園留下了留言',chat:'傳送了聊天留言',test:'通知測試'}[event.kind];
    if (!action || !['Ely','Rae','RELETTER'].includes(event.name) || !Number.isFinite(event.time) || (event.text && (typeof event.text !== 'string' || event.text.length > 4000))) return reply({ok:false,code:'INVALID'});
    if (MailApp.getRemainingDailyQuota() < 2) return reply({ok:false,code:'QUOTA'});
    const time = Utilities.formatDate(new Date(event.time),'Asia/Taipei','yyyy MM.dd HH:mm:ss');
    MailApp.sendEmail({to:'zhenggdove@gmail.com,partoftheszene@gmail.com',subject:'RELETTER · '+event.name+' '+action,body:event.name+' '+action+'\n時間：'+time+'（台灣時間）'+(event.text?'\n\n'+event.text:'')+'\n\nhttps://reletter-garden.zhenggdove-artist.workers.dev/',name:'RELETTER'});
    props.setProperty('sent_' + body.id, String(Date.now()));
    const cutoff = Date.now()-30*86400000;
    const saved = props.getProperties();
    Object.keys(saved).forEach(key=>{if(key.startsWith('sent_') && Number(saved[key])<cutoff)props.deleteProperty(key);});
    return reply({ok:true,id:body.id});
  } catch (error) { return reply({ok:false,code:'RELAY_ERROR'}); }
  finally { lock.releaseLock(); }
}
