export const notificationProviders = {};
export function configureNotificationProviders(value) {
  for(const key of Object.keys(notificationProviders)) delete notificationProviders[key];
  Object.assign(notificationProviders,value);
}
export function parseNotification(text) {
  try {
    const value=JSON.parse(text.replace(/^Notify\s+/i,''));
    if(!notificationProviders[value.provider] || typeof value.destination!=='string' || typeof value.message!=='string') return null;
    return {provider:value.provider,destination:value.destination,message:value.message,...(value.provider==='email'?{subject:typeof value.subject==='string'?value.subject:''}:{})};
  } catch {return null;}
}
export function formatNotification(value) {return `Notify ${JSON.stringify(value)}`;}
export function notificationTitle(text) {
  const value=parseNotification(text);
  return value?`Send via ${notificationProviders[value.provider].label}: ${value.message}`:'Send notification — configuration required';
}
