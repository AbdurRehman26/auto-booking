export const modalSelector = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open], .ui-dialog, .modal, .swal2-popup, .swal-modal';

export function parseVerification(instruction) {
  const text=instruction.trim().replace(/^(?:check|verify|confirm|make sure)(?:\s+that)?\s+/i,'').trim();
  const quoted=text.match(/^["“]([^"”]+)["”]$/);
  if(quoted) return {kind:'text',text:quoted[1]};
  if(/^(?:(?:the|a)\s+)?(?:modal|dialog|dialogue|popup|pop-up)(?:\s+(?:window|box))?\s+(?:(?:is|has)\s+)?(?:loaded|open|opened|visible|displayed|appeared|shown|appears)(?:[.!])?$/i.test(text)) return {kind:'modal'};
  if(/^(?:(?:the|a)\s+)?(?:new|next|different)\s+(?:page|screen)(?:\s+(?:(?:is|has)\s+)?(?:loaded|visible|displayed|appeared|shown|appears))?[.!]?$/i.test(text)) return {kind:'new-page'};
  if(/^(?:page|screen|the page|the screen)\s+(?:(?:is|has)\s+)?(?:loaded|ready)[.!]?$/i.test(text)) return {kind:'page-loaded'};
  return {kind:'text',text};
}

export async function verifyPage(page,instruction,{timeout=6000,previousPage=null}={}) {
  const check=parseVerification(instruction);
  if(check.kind==='new-page' || check.kind==='page-loaded') {
    if(check.kind==='new-page' && !previousPage) throw new Error('A new-page check needs a preceding click or Go to URL step to compare against.');
    const deadline=Date.now()+timeout;
    do {
      const current=await capturePageState(page).catch(()=>null);
      if(current?.ready && (check.kind==='page-loaded' || pageHasChanged(previousPage,current))) return check.kind==='new-page'?'Verified that a new page or screen loaded.':'Verified that the page finished loading.';
      await new Promise(resolve=>setTimeout(resolve,100));
    } while(Date.now()<deadline);
    throw new Error(check.kind==='new-page'?'No page transition was detected after the last action. Add a Verify step with distinctive text from the expected screen if its address and heading stay the same.':'The page has not finished loading.');
  }
  if(check.kind==='text') {
    if(!check.text) throw new Error('Specify the text or dialog state to verify.');
    try {await page.getByText(check.text,{exact:true}).filter({visible:true}).first().waitFor({state:'visible',timeout});}
    catch(error) {if(error.name!=='TimeoutError') throw error;throw new Error(`The text “${check.text}” did not become visible.`);}
    return `Verified visible text: “${check.text}”.`;
  }
  const deadline=Date.now()+timeout;
  do {
    for(const frame of page.frames()) {
      if(frame!==page.mainFrame() && !await frame.frameElement().then(el=>el.isVisible()).catch(()=>false)) continue;
      for(const modal of await frame.locator(modalSelector).all()) {
        if(!await modal.isVisible()) continue;
        const displayed=await modal.evaluate(el=>!el.closest('[aria-hidden="true"]') && el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}));
        if(displayed) return 'Verified that a dialog is open and visible.';
      }
    }
    if(Date.now()>=deadline) break;
    await new Promise(resolve=>setTimeout(resolve,100));
  } while(Date.now()<deadline);
  throw new Error('No visible modal or dialog appeared. Hidden dialogs and background overlays do not count as an open modal.');
}

export async function capturePageState(page) {
  return page.evaluate(()=>{
    const root=document.querySelector('main, [role="main"], #inhalt') || document.body;
    const heading=[...(root?.querySelectorAll('h1, [role="heading"][aria-level="1"]') || [])].find(el=>el.checkVisibility() && !el.closest('[role="dialog"], [role="alertdialog"], dialog, .modal, .ui-dialog'));
    return {url:location.href.split('#')[0],documentTime:performance.timeOrigin,title:document.title,heading:heading?.textContent.trim() || '',ready:document.readyState!=='loading' && !!document.body?.innerText.trim()};
  });
}
export function pageHasChanged(before,after) {
  return before.url!==after.url || before.documentTime!==after.documentTime || before.title!==after.title || (!!after.heading && before.heading!==after.heading);
}
