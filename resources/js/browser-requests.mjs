export function isNavigationAction(label,instruction='') {
  const name=label.trim().replace(/[›»→>]+$/u,'').trim();
  if(/^(weiter|next|continue|fortfahren)$/i.test(name)) return true;
  return /^ok$/i.test(name) && /\b(?:on|in|inside|within)\s+(?:the\s+)?(?:modal|dialog|popup|pop-up)\b/i.test(instruction);
}

export function requestDecision(request, {approvedNavigationOrigin=null, mainFrame=false}={}) {
  if(['GET','HEAD'].includes(request.method())) return 'allow';
  if(request.method()==='POST' && request.isNavigationRequest() && mainFrame && approvedNavigationOrigin && new URL(request.url()).origin===approvedNavigationOrigin) return 'allow-approved-navigation';
  return request.isNavigationRequest() ? 'pause-submission' : 'block-background';
}

export async function clickAndFollow(page, element) {
  // Begin watching before clicking: the form may navigate immediately or after a short script delay.
  const navigation=page.waitForNavigation({waitUntil:'domcontentloaded',timeout:5000}).catch(error=>{
    if(error.name==='TimeoutError') return null;
    throw error;
  });
  await element.click({timeout:6000});
  // A dialog can close or update the screen without a document navigation.
  const dismissed=element.waitFor({state:'hidden',timeout:5000}).then(()=>null).catch(error=>{
    if(error.name==='TimeoutError') return null;
    throw error;
  });
  const response=await Promise.race([navigation,dismissed]);
  if(response && !response.ok()) throw new Error(`The next screen returned HTTP ${response.status()}.`);
  return response;
}
