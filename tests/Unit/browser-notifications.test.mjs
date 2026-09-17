import {readFileSync} from 'node:fs';
import {configureStepTypes} from '../../public/step-types.js';
import {configureNotificationProviders} from '../../public/step-notification.js';
const catalog=JSON.parse(readFileSync(new URL('../../database/seeders/editor-configuration.json',import.meta.url),'utf8'));
configureStepTypes(catalog.step_types);
configureNotificationProviders(catalog.notification_providers);
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatNotification,parseNotification} from '../../public/step-notification.js';
import {executeNotification,notificationRequest} from '../../resources/js/browser-notifications.mjs';
const webhook={provider:'webhook',destination:'https://example.com/hook',message:'Appointment available'};

test('notification configuration round-trips and preview never calls a provider',async()=>{
  assert.deepEqual(parseNotification(formatNotification(webhook)),webhook);
  const fail=()=>{throw new Error('Network must not be called');};
  assert.match(await executeNotification(formatNotification(webhook),{send:fail,validateUrl:fail}),/Nothing sent/);
});
test('live delivery posts the message once with redirects disabled',async()=>{
  const calls=[];
  const result=await executeNotification(formatNotification(webhook),{live:true,validateUrl:async url=>assert.equal(url,webhook.destination),send:async(url,options)=>{calls.push({url,options});return {ok:true};}});
  assert.equal(calls.length,1);assert.equal(calls[0].options.redirect,'error');
  assert.deepEqual(JSON.parse(calls[0].options.body),{text:'Appointment available'});
  assert.match(result,/accepted the message/);
});
test('provider adapters use their expected payloads and server-held credentials',()=>{
  assert.deepEqual(JSON.parse(notificationRequest({...webhook,provider:'discord'}).body),{content:webhook.message,allowed_mentions:{parse:[]}});
  assert.equal(JSON.parse(notificationRequest({...webhook,provider:'teams'}).body).attachments[0].content.type,'AdaptiveCard');
  assert.equal(JSON.parse(notificationRequest({...webhook,provider:'slack'}).body).text,webhook.message);
  const telegram=notificationRequest({...webhook,provider:'telegram',destination:'@channel'},{TERMINPILOT_TELEGRAM_TOKEN:'123:secret'});
  assert.equal(JSON.parse(telegram.body).chat_id,'@channel');
  const whatsapp=notificationRequest({...webhook,provider:'whatsapp',destination:'+491234567890'},{TERMINPILOT_TWILIO_SID:`AC${'a'.repeat(32)}`,TERMINPILOT_TWILIO_TOKEN:'secret',TERMINPILOT_WHATSAPP_FROM:'+14155238886'});
  assert.equal(new URLSearchParams(whatsapp.body).get('To'),'whatsapp:+491234567890');
  assert.equal(whatsapp.headers['Content-Type'],'application/x-www-form-urlencoded');
});
test('errors, cancellation and invalid setup do not trigger retries or disclose credentials',async()=>{
  let calls=0;
  const options={live:true,validateUrl:async()=>{},send:async()=>{calls++;return {ok:false,status:429};}};
  await assert.rejects(executeNotification(formatNotification(webhook),options),/HTTP 429/);assert.equal(calls,1);
  await assert.rejects(executeNotification(formatNotification(webhook),{...options,shouldStop:()=>true}),/Stopped before sending/);assert.equal(calls,1);
  await assert.rejects(executeNotification(formatNotification({...webhook,provider:'whatsapp',destination:'+491234567890'}),{...options,env:{}}),/not connected/);
  await assert.rejects(executeNotification(formatNotification({...webhook,destination:'http://example.com'}),options),/HTTPS/);
  await assert.rejects(executeNotification(formatNotification({...webhook,provider:'slack'}),options),/Slack incoming/);
  await assert.rejects(executeNotification(formatNotification(webhook),{...options,send:async()=>{throw new Error('secret token');}}),/could not be confirmed/);
});
test('private network rejection prevents delivery and telegram failure is not reported as success',async()=>{
  let sent=false;
  await assert.rejects(executeNotification(formatNotification(webhook),{live:true,validateUrl:async()=>{throw new Error('Private address');},send:async()=>{sent=true;}}),/Private address/);
  assert.equal(sent,false);
  await assert.rejects(executeNotification(formatNotification({...webhook,provider:'telegram',destination:'@channel'}),{live:true,env:{TERMINPILOT_TELEGRAM_TOKEN:'123:secret'},validateUrl:async()=>{},send:async()=>({ok:true,json:async()=>({ok:false})})}),/Telegram rejected/);
});

test('email keeps its subject, validates the recipient and previews without delivery',async()=>{
  const email={provider:'email',destination:'reader@example.com',subject:'Available appointment',message:'A new slot is available.'};
  assert.deepEqual(parseNotification(formatNotification(email)),email);
  const fail=()=>{throw new Error('Must not send');};
  assert.match(await executeNotification(formatNotification(email),{send:fail,env:{}}),/Nothing sent/);
  await assert.rejects(executeNotification(formatNotification({...email,destination:'not an email'})),/email address/);
  await assert.rejects(executeNotification(formatNotification({...email,subject:''})),/subject/);
  await assert.rejects(executeNotification(formatNotification(email),{live:true,env:{},send:fail}),/Email is not connected/);
  let calls=0;
  await executeNotification(formatNotification(email),{live:true,env:{TERMINPILOT_RESEND_KEY:'test-key',TERMINPILOT_EMAIL_FROM:'sender@example.com'},validateUrl:async()=>{},send:async(url,options)=>{
    calls++;
    assert.equal(url,'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization,'Bearer test-key');
    assert.deepEqual(JSON.parse(options.body),{from:'sender@example.com',to:['reader@example.com'],subject:email.subject,text:email.message});
    return {ok:true};
  }});
  assert.equal(calls,1);
});
