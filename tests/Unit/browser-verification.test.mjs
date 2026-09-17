import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {parseVerification,verifyPage} from '../../resources/js/browser-verification.mjs';

test('modal instructions describe state while quoted instructions remain literal',()=>{
  for(const text of ['Verify Modal is loaded','Check that the dialog is visible','Verify the popup has appeared','Verify modal is open']) assert.equal(parseVerification(text).kind,'modal');
  assert.deepEqual(parseVerification('Verify "Modal is loaded"'),{kind:'text',text:'Modal is loaded'});
});
test('checks actual visible dialogs, waits for loading, and rejects hidden templates and overlays',async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage();await page.route('**/*',route=>route.abort());
    for(const html of ['<div role="dialog">Service details</div>','<dialog open>Service details</dialog>','<div class="ui-dialog">Service details</div>','<div class="modal show">Service details</div>']) {
      await page.setContent(html);
      assert.equal(await verifyPage(page,'Verify Modal is loaded'),'Verified that a dialog is open and visible.');
    }
    await page.setContent('<div role="dialog" hidden>Delayed details</div><script>setTimeout(()=>document.querySelector("div").hidden=false,150)</script>');
    assert.match(await verifyPage(page,'Verify Modal is loaded'),/open and visible/);
    for(const html of ['<div role="dialog" hidden>Hidden</div>','<div class="modal" style="opacity:0">Hidden</div>','<div role="dialog" aria-hidden="true">Hidden</div>','<div class="modal-backdrop">Backdrop</div>','<p>Modal is loaded</p>']) {
      await page.setContent(html);
      await assert.rejects(verifyPage(page,'Verify Modal is loaded',{timeout:120}),/No visible modal/);
    }
    await page.setContent('<p hidden>Available</p><p>Available</p>');
    assert.match(await verifyPage(page,'Verify "Available"'),/Verified visible text/);
    await page.setContent('<p>Modal is loaded</p>');
    assert.match(await verifyPage(page,'Verify "Modal is loaded"'),/Verified visible text/);
  } finally {await browser.close();}
});

test('new screen means a transition, not literal text, and waits do not change its baseline',async()=>{
  const {capturePageState,pageHasChanged}=await import('../../resources/js/browser-verification.mjs');
  for(const instruction of ['Verify New screen is loaded','Verify a new page','Verify the next page has loaded']) assert.equal(parseVerification(instruction).kind,'new-page');
  assert.equal(parseVerification('Verify "New screen is loaded"').kind,'text');
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage();await page.route('**/*',route=>route.abort());
    await page.setContent('<main><h1>Select service</h1></main>');
    const previousPage=await capturePageState(page);
    assert.equal(pageHasChanged(previousPage,await capturePageState(page)),false);
    await assert.rejects(verifyPage(page,'Verify new page',{previousPage,timeout:100}),/No page transition/);
    await page.evaluate(()=>document.querySelector('h1').textContent='Select location');
    assert.equal(await verifyPage(page,'Verify New screen is loaded',{previousPage}),'Verified that a new page or screen loaded.');
    assert.equal(await verifyPage(page,'Verify page is loaded'),'Verified that the page finished loading.');
    await assert.rejects(verifyPage(page,'Verify a new page'),/preceding click/);
    assert.equal(pageHasChanged(previousPage,{...previousPage,documentTime:previousPage.documentTime+1}),true);
    assert.equal(pageHasChanged(previousPage,{...previousPage,url:'https://example.com/next'}),true);
  } finally {await browser.close();}
});
