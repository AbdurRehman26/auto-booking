import {parseNotification,notificationProviders} from '../../public/step-notification.js';
import {publicUrl} from './browser-safety.mjs';

export function notificationRequest(value,env=process.env) {
  const {provider,destination,message}=value;
  let url=destination,headers={'Content-Type':'application/json'},body={text:message};
  if(provider==='email') {
    if(!env.TERMINPILOT_RESEND_KEY || !env.TERMINPILOT_EMAIL_FROM) throw new Error('Email is not connected. Configure RESEND_API_KEY and MAIL_FROM_ADDRESS on the server.');
    url='https://api.resend.com/emails';
    headers.Authorization=`Bearer ${env.TERMINPILOT_RESEND_KEY}`;
    body={from:env.TERMINPILOT_EMAIL_FROM,to:[destination],subject:value.subject,text:message};
  }
  if(provider==='discord') body={content:message,allowed_mentions:{parse:[]}};
  if(provider==='teams') body={type:'message',attachments:[{contentType:'application/vnd.microsoft.card.adaptive',content:{type:'AdaptiveCard',version:'1.2',body:[{type:'TextBlock',text:message,wrap:true}]}}]};
  if(provider==='telegram') {
    if(!env.TERMINPILOT_TELEGRAM_TOKEN) throw new Error('Telegram is not connected. Configure TELEGRAM_BOT_TOKEN on the server.');
    url=`https://api.telegram.org/bot${env.TERMINPILOT_TELEGRAM_TOKEN}/sendMessage`;
    body={chat_id:destination,text:message};
  }
  if(provider==='whatsapp') {
    if(!env.TERMINPILOT_TWILIO_SID || !env.TERMINPILOT_TWILIO_TOKEN || !env.TERMINPILOT_WHATSAPP_FROM) throw new Error('WhatsApp is not connected. Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM on the server.');
    if(!/^AC[0-9a-f]{32}$/i.test(env.TERMINPILOT_TWILIO_SID)) throw new Error('The configured Twilio account ID is invalid.');
    url=`https://api.twilio.com/2010-04-01/Accounts/${env.TERMINPILOT_TWILIO_SID}/Messages.json`;
    headers={'Content-Type':'application/x-www-form-urlencoded',Authorization:`Basic ${Buffer.from(`${env.TERMINPILOT_TWILIO_SID}:${env.TERMINPILOT_TWILIO_TOKEN}`).toString('base64')}`};
    body=new URLSearchParams({To:`whatsapp:${destination}`,From:`whatsapp:${env.TERMINPILOT_WHATSAPP_FROM.replace(/^whatsapp:/,'')}`,Body:message}).toString();
  } else body=JSON.stringify(body);
  return {url,headers,body};
}

export async function executeNotification(text,{live=false,env=process.env,send=fetch,validateUrl=publicUrl,shouldStop=()=>false}={}) {
  const value=parseNotification(text);
  if(!value || !value.destination.trim() || !value.message.trim()) throw new Error('Choose a notification provider, destination, and message.');
  if(value.message.length>1600) throw new Error('Keep notification messages within 1600 characters.');
  if(value.provider==='whatsapp' && !/^\+[1-9]\d{6,14}$/.test(value.destination)) throw new Error('Enter the WhatsApp number with its country code, for example +491234567890.');
  if(value.provider==='telegram' && !/^(@[A-Za-z0-9_]{5,}|-?\d+)$/.test(value.destination)) throw new Error('Enter a Telegram chat ID or @channel username.');
  if(value.provider==='email') {
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.destination)) throw new Error('Enter a valid recipient email address.');
    if(!value.subject.trim() || value.subject.length>200 || /[\r\n]/.test(value.subject)) throw new Error('Enter an email subject of 1–200 characters on one line.');
  }
  if(!['whatsapp','telegram','email'].includes(value.provider)) {
    let url;try {url=new URL(value.destination);} catch {throw new Error('Enter a valid HTTPS webhook URL.');}
    if(url.protocol!=='https:' || url.username || url.password) throw new Error('Use an HTTPS webhook URL without embedded login credentials.');
    if(value.provider==='slack' && !['hooks.slack.com','hooks.slack-gov.com'].includes(url.hostname)) throw new Error('Use a Slack incoming webhook URL.');
    if(value.provider==='discord' && (!['discord.com','discordapp.com'].includes(url.hostname) || !url.pathname.startsWith('/api/webhooks/'))) throw new Error('Use a Discord webhook URL.');
  }
  const label=notificationProviders[value.provider].label;
  if(!live) return `Preview only — ${label} message: ${value.message}. Nothing sent.`;
  if(shouldStop()) throw new Error('Stopped before sending the notification.');
  const request=notificationRequest(value,env);
  await validateUrl(request.url);
  const controller=new AbortController();
  const timer=setInterval(()=>{if(shouldStop()) controller.abort();},100);
  try {
    const response=await send(request.url,{method:'POST',headers:request.headers,body:request.body,redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
    if(!response.ok) throw new Error(`${label} rejected the message (HTTP ${response.status}). Check the connection and recipient. No automatic retry was made.`);
    if(value.provider==='telegram' && !(await response.json()).ok) throw new Error('Telegram rejected the message. Check the bot permissions and chat ID.');
    return `${label} accepted the message for delivery.`;
  } catch(error) {
    if(error.message.startsWith(`${label} rejected`) || error.message.startsWith('Telegram rejected')) throw error;
    throw new Error(`${label} delivery could not be confirmed. Check the provider before retrying to avoid a duplicate.`);
  } finally {clearInterval(timer);}
}
