import {evaluateCondition} from './step-condition.js';
export const stepTypes = {};
export function configureStepTypes(value) {
  for(const key of Object.keys(stepTypes)) delete stepTypes[key];
  Object.assign(stepTypes,value);
}
const quoted = '"(?:[^"\\\\]|\\\\.)*"';
const conditionalPattern = new RegExp(`^If (${quoted})(?: is visible)? then (click|instruction|check|navigate|scroll|enter|wait|review|notify|condition|record): (${quoted}) else (click|instruction|check|navigate|scroll|enter|wait|review|notify|condition|record): (${quoted})$`, 'i');
export function parseConditional(text) {
  const match = text.trim().match(conditionalPattern);
  if (!match) return null;
  try {return {condition:JSON.parse(match[1]),then:{type:match[2].toLowerCase(),text:JSON.parse(match[3])},else:{type:match[4].toLowerCase(),text:JSON.parse(match[5])}};} catch {return null;}
}
export function formatConditional(value) {
  return `If ${JSON.stringify(value.condition)} then ${value.then.type}: ${JSON.stringify(value.then.text)} else ${value.else.type}: ${JSON.stringify(value.else.text)}`;
}
export function defaultConditional() {
  return parseConditional(stepTypes.condition.text);
}

export function parseStep(line) {
  const text=line.replace(/^\s*\d+[.)]\s*/, '').trim();
  const type=/^save to database:/i.test(text)?'record':/^notify\s+/i.test(text)?'notify':/^scroll\b/i.test(text)?'scroll':/^if\b/i.test(text)?'condition':/^(go|open|visit|navigate)\b/i.test(text)?'navigate':/^(click|choose|select|press)\b/i.test(text)?'click':/^(check|verify|confirm|make sure)\b/i.test(text)?'check':/^(enter|fill|type|provide)\b/i.test(text)?'enter':/^(wait|retry|monitor)\b/i.test(text)?'wait':/^(pause|review|approve)\b/i.test(text)?'review':'instruction';
  return text?{type,text}:null;
}
export async function chooseBranch(page, text) {
  const value=parseConditional(text);
  if(!value || !value.condition.trim() || !value.then.text.trim() || !value.else.text.trim()) throw new Error('Complete the condition and both branches before running this If / else step.');
  const matched=await evaluateCondition(page,value.condition);
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
