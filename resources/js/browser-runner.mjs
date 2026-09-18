import {interpretCondition} from './browser-ai-condition.mjs';
import {configureNotificationProviders} from '../../public/step-notification.js';
import { executeNotification } from './browser-notifications.mjs';
import { requestDecision, clickAndFollow, isNavigationAction } from './browser-requests.mjs';
import { executeWait } from '../../public/step-wait.js';
import { verifyPage, capturePageState } from './browser-verification.mjs';
import { chromium } from 'playwright';
import { readFileSync, appendFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { findClickTarget, parseIconClick } from './browser-targets.mjs';
import { publicUrl } from './browser-safety.mjs';
import { dismissOptionalCookies } from './browser-cookies.mjs';
import { join } from 'node:path';
import { chooseBranch, executeScroll } from '../../public/step-types.js';

const directory = process.argv[2];
const input = JSON.parse(readFileSync(join(directory, 'input.json'), 'utf8'));
configureNotificationProviders(input.notification_providers);
const state = JSON.parse(readFileSync(join(directory, 'state.json'), 'utf8'));
let browser, page, heartbeat, deadline, capturing = false, finished = false, interrupted = '';
let approvedNavigation = null;
let previousPage = null;
class NeedsInput extends Error {}
function publish() {
  state.updatedAt = Date.now();
  writeFileSync(join(directory, 'state.tmp'), JSON.stringify(state));
  renameSync(join(directory, 'state.tmp'), join(directory, 'state.json'));
}
function stopped() { return existsSync(join(directory, 'stop')); }
function assertRunning() {
  if (stopped()) throw new Error('Stopped by you.');
  if (interrupted) throw new NeedsInput(interrupted);
}
async function capture() {
  if (!page || page.isClosed() || capturing) return;
  capturing = true;
  try {
    const frame = await page.screenshot({type:'jpeg', quality:70, timeout:2500});
    writeFileSync(join(directory, 'frame.tmp'), frame);
    renameSync(join(directory, 'frame.tmp'), join(directory, 'frame.jpg'));
    state.url = page.url();
    state.frameAt = Date.now();
    publish();
  } catch { /* Navigation can replace a frame while it is being captured. */ }
  finally { capturing = false; }
}
async function handleCookies() {
  try {
    await dismissOptionalCookies(page, {
      beforeAction: async message => {assertRunning(); state.message = message; publish(); await capture();},
      afterAction: async message => {state.cookieNotice = message; publish(); await capture();},
    });
  } catch (error) {
    throw new NeedsInput(error.message);
  }
}
async function checkpoint() {
  assertRunning();
  await handleCookies();
  assertRunning();
  const challenge = page.locator('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], input[name*="captcha"], #challenge-running');
  for (const element of await challenge.all()) {
    if (await element.isVisible()) throw new NeedsInput('A CAPTCHA or browser challenge needs your attention. Complete this step on the booking site.');
  }
}
function targetText(instruction, type) {
  const icon=type==='click' && parseIconClick(instruction);
  if(icon) return `plus for ${icon.context}`;
  const quoted = instruction.match(/["“]([^"”]+)["”]/);
  if (quoted) return quoted[1];
  const text = instruction.replace(type === 'check' ? /^(check|verify|confirm)(\s+that)?\s+/i : /^(click|choose|select|press)\s+(on\s+)?/i, '').replace(/\s+(?:on|in|inside|within)\s+(?:the\s+)?(?:modal|dialog|popup|pop-up)\s*$/i, '').trim();
  if (/\b(required|available|appropriate|summary|appears|and|concern)\b/i.test(text) || text.length > 80) return null;
  return text;
}
async function execute(step, index) {
  assertRunning();
  if(step.type==='record') {
    const message=step.text.trim().replace(/^Save to database:\s*/i,'');
    if(!message) throw new NeedsInput('Write the message to save to the database.');
    appendFileSync(join(directory,'records.jsonl'),JSON.stringify({step_number:index+1,message,page_url:page?.url()||null,created_at:new Date().toISOString()})+'\n');
    return 'Record captured. It will be saved to your database when this run finishes.';
  }
  if(step.type==='notify') return executeNotification(step.text,{live:input.send_notifications===true,shouldStop:()=>stopped() || !!interrupted});
  await checkpoint();
  if (step.type === 'scroll') {
    try {return await executeScroll(page,step.text);} catch(error) {throw new NeedsInput(error.message);}
  }
  if (step.type === 'instruction') throw new NeedsInput(`Instruction for human review: ${step.text}`);
  if (step.type === 'condition') {
    let branch;
    try {branch=await chooseBranch(page,step.text,interpretCondition);} catch(error) {throw new NeedsInput(error.message);}
    state.message = `${branch.matched?'Then':'Else'} branch: ${branch.action.type==='notify'?'Send notification':branch.action.text}`;
    step.detail = `“${branch.condition}” ${branch.matched?'is true':'is false'} → ${branch.matched?'Then':'Else'}: ${branch.action.type==='notify'?'Send notification':branch.action.text}`;
    if(branch.evidence) step.detail+=` Evidence: ${branch.evidence}`;
    publish();
    const result=await execute(branch.action,index);
    return `${step.detail}. ${result}`;
  }
  if (step.type === 'navigate') {
    const explicit = step.text.match(/https?:\/\/[^\s"<>]+/i)?.[0];
    if (!explicit && index > 0) throw new NeedsInput('Add the full destination URL to this navigation step.');
    const url = await publicUrl(explicit || input.url);
    previousPage=await capturePageState(page);
    const response = await page.goto(url.href, {waitUntil:'domcontentloaded', timeout:20000});
    if (response && !response.ok()) throw new Error(`The website returned HTTP ${response.status()}.`);
    await page.waitForLoadState('load', {timeout:3000}).catch(()=>{});
    await checkpoint();
    return 'Page opened in the test browser.';
  }
  if (step.type === 'review' || step.type === 'enter') throw new NeedsInput('Human checkpoint reached. Continue on the booking site to review or enter personal information.');
  if (step.type === 'wait') return executeWait(step.text,{assertRunning,onTick:remaining=>{state.message=`Waiting… ${remaining}s remaining`;publish();}});
  if (step.type === 'check') {
    try {return await verifyPage(page,step.text,{previousPage});} catch(error) {throw new NeedsInput(error.message);}
  }
  const target = targetText(step.text, step.type);
  if (!target) throw new NeedsInput('This instruction is ambiguous. Use the exact visible text, for example Click "Weiter", then run again.');
  if (/\b(book|confirm|submit|pay|purchase|reserve|send|delete|buchen|verbindlich|bestätigen|absenden|bezahlen|reservieren|löschen)\b/i.test(target)) throw new NeedsInput('This action may submit or confirm a booking. Review it on the booking site.');
  let element;
  try {element = await findClickTarget(page,target,{instruction:step.text});} catch(error) {throw new NeedsInput(error.message);}
  await element.scrollIntoViewIfNeeded();
  await element.evaluate(el => { el.dataset.previewOutline = el.style.outline; el.dataset.previewOutlineOffset = el.style.outlineOffset; el.dataset.testRunHighlight = 'true'; el.style.outline = '3px solid #2c6b4f'; el.style.outlineOffset = '4px'; });
  state.message = `Clicking “${target}”…`;
  await capture();
  await new Promise(resolve => setTimeout(resolve, 150));
  await checkpoint();
  previousPage=await capturePageState(page);
  if(isNavigationAction(target,step.text)) {
    approvedNavigation={origin:new URL(page.url()).origin,expires:Date.now()+10000};
    state.message='Loading the next screen…';publish();
    try {await clickAndFollow(page,element);} finally {approvedNavigation=null;}
  } else {
    await element.click({timeout:6000});
  }
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll('[data-test-run-highlight]')) {
      el.style.outline=el.dataset.previewOutline || '';
      el.style.outlineOffset=el.dataset.previewOutlineOffset || '';
      delete el.dataset.previewOutline;delete el.dataset.previewOutlineOffset;delete el.dataset.testRunHighlight;
    }
  }).catch(()=>{});
  await page.waitForLoadState('domcontentloaded', {timeout:6000}).catch(()=>{});
  await checkpoint();
  return `Clicked “${target}”.`;
}

try {
  assertRunning();
  if (Date.now() - state.startedAt > 70000) throw new Error('This run expired before a browser became available. Please retry.');
  await publicUrl(input.url);
  browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:{width:1280,height:800}, deviceScaleFactor:1, serviceWorkers:'block', acceptDownloads:false});
  await context.route('**/*', async route => {
    try {
      const request = route.request();
      const decision=requestDecision(request,{
        approvedNavigationOrigin:approvedNavigation && approvedNavigation.expires>Date.now()?approvedNavigation.origin:null,
        mainFrame:request.isNavigationRequest() && request.frame()===page?.mainFrame(),
      });
      if(decision==='allow-approved-navigation') approvedNavigation=null;
      if(decision==='pause-submission') {
        interrupted = 'The website attempted to submit a form while navigating. That submission was blocked; review this action on the booking site.';
        return await route.abort();
      }
      if(decision==='block-background') {
        state.blockedBackgroundRequests=(state.blockedBackgroundRequests || 0)+1;
        state.networkNotice='Background data requests were blocked. Clicks can continue, but use a Verify step to confirm the expected result.';
        publish();
        return await route.abort();
      }
      await publicUrl(request.url());
      await route.continue();
    } catch (error) {
      if (route.request().isNavigationRequest()) interrupted = error.message;
      await route.abort().catch(()=>{});
    }
  });
  await context.routeWebSocket('**/*', socket => socket.close());
  page = await context.newPage();
  page.on('dialog', async dialog => {interrupted = 'A website dialog needs your review.'; await dialog.dismiss();});
  context.on('page', popup => {if (popup !== page) {interrupted = 'The website opened another window. Continue this step on the booking site.'; popup.close().catch(()=>{});}});
  state.status = 'running';
  publish();
  heartbeat = setInterval(async () => {
    if (stopped() && !finished) {interrupted = 'Stopped by you.'; await browser.close().catch(()=>{});}
    else await capture();
  }, 900);
  deadline = setTimeout(() => {interrupted = 'The test reached its one-minute limit. Review the last screenshot and retry.'; browser.close().catch(()=>{});}, 50000);
  if (input.steps[0].type !== 'navigate') {
    state.message = 'Opening the start URL…'; publish();
    const response = await page.goto(input.url,{waitUntil:'domcontentloaded',timeout:20000});
    if (response && !response.ok()) throw new Error(`The website returned HTTP ${response.status()}.`);
  }
  for (const [index, step] of state.steps.entries()) {
    assertRunning();
    state.currentStep = index; step.status = 'active'; step.startedAt = Date.now();
    state.message = step.type==='notify'?'Preparing notification…':step.text; publish();
    step.detail = await execute(step, index);
    step.status = 'done'; step.finishedAt = Date.now();
    await capture(); publish();
  }
  state.status = 'completed';
  state.message = input.send_notifications ? 'All configured steps completed. Notification results are shown above.' : 'All configured steps completed. Notifications were previewed only.';
} catch (error) {
  state.status = stopped() ? 'stopped' : (error instanceof NeedsInput || interrupted ? 'paused' : 'failed');
  state.message = stopped() ? 'Stopped by you. The browser has been closed.' : interrupted || (error.name === 'TimeoutError' ? 'The expected page or element did not appear in time. Review the screenshot and update the instruction.' : error.message);
  const step = state.steps[state.currentStep];
  if (step?.status === 'active') {step.status = state.status; step.detail = step.detail ? `${step.detail}. ${state.message}` : state.message;}
} finally {
  finished = true;
  clearInterval(heartbeat); clearTimeout(deadline);
  await capture();
  state.finishedAt = Date.now();
  publish();
  await browser?.close().catch(()=>{});
}
