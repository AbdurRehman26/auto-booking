export const notificationProviders = {
  webhook:{label:'Webhook',destination:'Webhook URL',placeholder:'https://example.com/webhook',help:'Sends JSON with a text field.'},
  whatsapp:{label:'WhatsApp',destination:'WhatsApp number',placeholder:'+491234567890',help:'Uses your configured Twilio WhatsApp sender. The recipient must be eligible for a free-form message.'},
  slack:{label:'Slack',destination:'Incoming webhook URL',placeholder:'https://hooks.slack.com/services/…',help:'Create an incoming webhook for the Slack channel.'},
  discord:{label:'Discord',destination:'Discord webhook URL',placeholder:'https://discord.com/api/webhooks/…',help:'Create a webhook in the channel’s integration settings.'},
  teams:{label:'Microsoft Teams',destination:'Teams Workflow webhook URL',placeholder:'https://…',help:'Use a Teams Workflow that accepts incoming webhook Adaptive Cards.'},
  telegram:{label:'Telegram',destination:'Chat ID or channel username',placeholder:'@your_channel',help:'Uses the configured Telegram bot. Add it to your chat or channel first.'},
};
export function parseNotification(text) {
  try {
    const value=JSON.parse(text.replace(/^Notify\s+/i,''));
    if(!notificationProviders[value.provider] || typeof value.destination!=='string' || typeof value.message!=='string') return null;
    return {provider:value.provider,destination:value.destination,message:value.message};
  } catch {return null;}
}
export function formatNotification(value) {return `Notify ${JSON.stringify(value)}`;}
export function notificationTitle(text) {
  const value=parseNotification(text);
  return value?`Send via ${notificationProviders[value.provider].label}: ${value.message}`:'Send notification — configuration required';
}
