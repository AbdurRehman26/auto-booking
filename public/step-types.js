import {formatNotification} from './step-notification.js';
export const stepTypes = {
  click: {label:'Click', icon:'⌁', description:'Click a button or link by its exact label.', text:'Click "Button label"'},
  instruction: {label:'Just instruction', icon:'≡', description:'Write a free-form instruction for human review.', text:'Describe what should happen'},
  check: {label:'Verify', icon:'✓', description:'Check text, an open modal, or a newly loaded page.', text:'Verify "Expected text"'},
  condition: {label:'If / else', icon:'⑂', description:'Choose an action based on visible page text.', text:'If "Expected text" is visible then click: "Click \\"Continue\\"" else review: "Pause for review"'},
  navigate: {label:'Go to URL', icon:'↗', description:'Open a specific web address.', text:'Go to https://example.com'},
  scroll: {label:'Scroll', icon:'↕', description:'Move up or down by a chosen number of pixels.', text:'Scroll down 600 pixels'},
  enter: {label:'Enter information', icon:'Aa', description:'Pause before entering personal information.', text:'Enter the required information'},
  wait: {label:'Wait', icon:'◷', description:'Wait a few seconds, then continue automatically.', text:'Wait 3 seconds'},
  notify: {label:'Send notification',icon:'✉',description:'Send a message to a webhook, WhatsApp, Slack, and more.',text:formatNotification({provider:'webhook',destination:'',message:'Appointment update'})},
  review: {label:'Human review', icon:'◉', description:'Stop here for your review.', text:'Pause for review'},
};
const quoted = '"(?:[^"\\\\]|\\\\.)*"';
const conditionalPattern = new RegExp(`^If (${quoted}) is visible then (click|instruction|check|navigate|scroll|enter|wait|review|notify): (${quoted}) else (click|instruction|check|navigate|scroll|enter|wait|review|notify): (${quoted})$`, 'i');
export function parseConditional(text) {
  const match = text.trim().match(conditionalPattern);
  if (!match) return null;
  try {return {condition:JSON.parse(match[1]),then:{type:match[2].toLowerCase(),text:JSON.parse(match[3])},else:{type:match[4].toLowerCase(),text:JSON.parse(match[5])}};} catch {return null;}
}
export function formatConditional(value) {
  return `If ${JSON.stringify(value.condition)} is visible then ${value.then.type}: ${JSON.stringify(value.then.text)} else ${value.else.type}: ${JSON.stringify(value.else.text)}`;
}
export function defaultConditional() {
  return {condition:'Expected text',then:{type:'click',text:'Click "Continue"'},else:{type:'review',text:'Pause for review'}};
}
stepTypes.condition.text = formatConditional(defaultConditional());
export function parseStep(line) {
  const text=line.replace(/^\s*\d+[.)]\s*/, '').trim();
  const type=/^notify\s+/i.test(text)?'notify':/^scroll\b/i.test(text)?'scroll':/^if\b/i.test(text)?'condition':/^(go|open|visit|navigate)\b/i.test(text)?'navigate':/^(click|choose|select|press)\b/i.test(text)?'click':/^(check|verify|confirm|make sure)\b/i.test(text)?'check':/^(enter|fill|type|provide)\b/i.test(text)?'enter':/^(wait|retry|monitor)\b/i.test(text)?'wait':/^(pause|review|approve)\b/i.test(text)?'review':'instruction';
  return text?{type,text}:null;
}
export async function chooseBranch(page, text) {
  const value=parseConditional(text);
  if(!value || !value.condition.trim() || !value.then.text.trim() || !value.else.text.trim()) throw new Error('Complete the condition and both branches before running this If / else step.');
  let matched=false;
  for(const element of await page.getByText(value.condition,{exact:true}).all()) {
    if(await element.isVisible()) {matched=true;break;}
  }
  return {matched,action:matched?value.then:value.else,condition:value.condition};
}

export function parseScroll(text) {
  const match=text.trim().match(/^scroll (up|down) ([1-9]\d{0,3}) (?:pixels|px)$/i);
  if(!match || Number(match[2])>5000) return null;
  return {direction:match[1].toLowerCase(),distance:Number(match[2])};
}
export async function executeScroll(page,text) {
  const value=parseScroll(text);
  if(!value) throw new Error('Use Scroll up or down with a distance from 1 to 5000 pixels, for example Scroll down 600 pixels.');
  const result=await page.evaluate(({direction,distance})=>{
    const start=window.scrollY;
    window.scrollBy({top:direction==='up'?-distance:distance,behavior:'instant'});
    return {moved:Math.round(Math.abs(window.scrollY-start)),atEdge:window.scrollY===start};
  },value);
  return result.atEdge ? `Already at the ${value.direction==='up'?'top':'bottom'} of the page.` : `Scrolled ${value.direction} ${result.moved} pixels.`;
}
