import { modalSelector } from './browser-verification.mjs';

const clickableRoles = ['button', 'link', 'radio', 'checkbox', 'tab', 'switch', 'menuitem', 'treeitem'];

export async function findClickTarget(page, text, {instruction='', timeout=3000}={}) {
  const icon=parseIconClick(text);
  if(icon) return findContextualPlus(page,icon.context);
  const modalRequested=/\b(?:on|in|inside|within)\s+(?:the\s+)?(?:modal|dialog|popup|pop-up)\b/i.test(instruction);
  const scope=modalRequested ? page.locator(modalSelector).filter({visible:true}) : page;
  const normalized=text.trim().split(/\s+/).map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');
  const name=new RegExp(`^\\s*${normalized}\\s*$`,'i');
  const candidates=clickableRoles.map(role=>scope.getByRole(role,{name})).reduce((result,locator)=>result.or(locator)).filter({visible:true});
  try {await candidates.first().waitFor({state:'visible',timeout});} catch(error) {if(error.name!=='TimeoutError') throw error;}
  const visible=[];
  for(const element of await candidates.all()) {
    if(!await element.isVisible()) continue;
    if(!await element.evaluate(el=>!el.closest('[aria-hidden="true"]') && el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))) continue;
    visible.push(element);
  }
  if(visible.length!==1) {
    const location=modalRequested?' in the open modal':'';
    throw new Error(visible.length
      ? `Several controls are labelled “${text}”${location}. Make this instruction more specific.`
      : `No supported interactive control matches “${text}”${location}. The text may be present as a label rather than a clickable control.`);
  }
  return visible[0];
}

export function parseIconClick(instruction) {
  const text=instruction.trim().replace(/^(?:click|press|select)\s+(?:on\s+)?/i,'');
  const match=text.match(/^(?:t\s+)?(?:the\s+)?(?:plus|\+|add)(?:\s+(?:icon|button))?\s+(?:for|next to|beside)\s+(.+)$/i);
  if(!match) return null;
  const context=match[1].trim().replace(/^["“](.*)["”]$/,'$1').trim();
  return context ? {icon:'plus',context} : null;
}

async function findContextualPlus(page, context) {
  const matches=[];
  for(const label of await page.getByText(context,{exact:true}).all()) {
    if(await label.isVisible()) matches.push(label);
  }
  if(matches.length!==1) throw new Error(matches.length ? `Several service labels match “${context}”. Specify a unique service.` : `The service label “${context}” is not visible. Expand its section first.`);
  let scope=matches[0];
  for(let depth=0;depth<5;depth++) {
    scope=scope.locator('..');
    const tooBroad=await scope.evaluate(el=>['BODY','HTML','MAIN','FORM'].includes(el.tagName) || el.innerText.length>1200);
    if(tooBroad) break;
    const controls=scope.locator('button, a, input[type="button"], input[type="submit"], [role="button"], [onclick], [tabindex="0"]');
    const plus=[];
    for(const control of await controls.all()) {
      if(!await control.isVisible()) continue;
      const isPlus=await control.evaluate(el=>{
        const names=[el.getAttribute('aria-label'),el.getAttribute('title'),el.getAttribute('value'),el.textContent].filter(Boolean).map(s=>s.trim());
        const named=names.some(name=>/^(?:\+|＋|plus|add|increase|hinzufügen|erhöhen)(?:\s|$)/i.test(name));
        const icon=el.matches('[class~="plus"], [class*="-plus"], [class*="_plus"], [data-icon="plus"]') || !!el.querySelector('[class~="plus"], [class*="-plus"], [class*="_plus"], [data-icon="plus"], [aria-label="plus" i], img[alt="+"], img[alt="plus" i]');
        // Do not choose a surrounding click handler when its child is the actual control.
        return (named || icon) && !el.querySelector('button, a, input, [role="button"]');
      });
      if(isPlus) plus.push(control);
    }
    if(plus.length>1) throw new Error(`Several plus controls appear beside “${context}”. The runner will not guess which one to click.`);
    if(plus.length===1) return plus[0];
    // A complete row with controls but no plus must not borrow a neighbouring row's plus.
    if(await scope.evaluate(el=>el.matches('tr, li, [role="row"], [role="group"]')) && await controls.count()) break;
  }
  throw new Error(`No identifiable plus control was found beside “${context}”. The icon needs an accessible label or recognizable plus marker.`);
}
