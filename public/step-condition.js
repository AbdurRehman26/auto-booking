export function parseCondition(instruction) {
  const text=instruction.trim().replace(/^if\s+/i,'').replace(/[.!]$/,'').trim();
  const state=text.match(/^(.*?)\s+(?:(?:is|are)\s+)?(not\s+)?(?:shown|visible|displayed|present|open|loaded)$/i);
  if(!state) return {kind:'text',name:text.replace(/^["“](.*)["”]$/,'$1'),negated:false};
  let subject=state[1].replace(/^(?:a|an|the)\s+/i,'').trim();
  const negated=!!state[2];
  if(/^(?:error|error message)$/i.test(subject)) return {kind:'error',negated};
  if(/^(?:modal|dialog|popup|pop-up)$/i.test(subject)) return {kind:'modal',negated};
  const control=subject.match(/^(button|link|checkbox|textbox|input)(?:\s+["“](.*)["”])?$/i)||subject.match(/^["“](.*)["”]\s+(button|link|checkbox|textbox|input)$/i)?.map((v,i,a)=>i===1?a[2]:i===2?a[1]:v);
  if(control) return {kind:control[1].toLowerCase()==='input'?'textbox':control[1].toLowerCase(),name:control[2]||null,negated};
  const literal=subject.match(/^(?:text\s+)?["“](.*)["”]$/i);
  if(literal) return {kind:'text',name:literal[1],negated};
  throw new Error('Describe a visible button, link, error message, or dialog; quote an exact label when needed. This condition could not be interpreted.');
}
export async function evaluateCondition(page,instruction) {
  const check=parseCondition(instruction);
  let matched=false;
  const frames=typeof page.frames==='function'?page.frames():[page];
  for(const frame of frames) {
    if(frame!==page && typeof page.mainFrame==='function' && frame!==page.mainFrame() && !await frame.frameElement().then(el=>el.isVisible())) continue;
    const locator=check.kind==='text'?frame.getByText(check.name,{exact:true}):check.kind==='error'?frame.locator('[role="alert"], [role="alertdialog"], .error, .error-message, .alert-danger, .invalid-feedback, [aria-invalid="true"]'):check.kind==='modal'?frame.locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open], .ui-dialog, .modal, .swal2-popup'):frame.getByRole(check.kind,check.name?{name:check.name,exact:true}:{});
    for(const element of await locator.all()) {
      if(await element.isVisible()) {matched=true;break;}
    }
    if(matched) break;
  }
  return check.negated?!matched:matched;
}
