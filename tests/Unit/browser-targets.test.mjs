import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {findClickTarget} from '../../resources/js/browser-targets.mjs';

test('the visible service tab expands even though it is not a button or link',async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage();
    const label='Umschreibung ausländische Fahrerlaubnis / Dienstfahrerlaubnis';
    await page.setContent(`<div role="tablist"><h3 role="tab" aria-expanded="false" onclick="this.setAttribute('aria-expanded','true');document.querySelector('#services').hidden=false">${label}</h3><section id="services" hidden>Available services</section></div>`);
    await (await findClickTarget(page,label)).click();
    assert.equal(await page.getByRole('tab').getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('#services').isVisible(),true);
    await page.setContent('<button>Weiter</button><button>Weiter</button>');
    await assert.rejects(findClickTarget(page,'Weiter'),/Several controls/);
    await page.setContent('<p>Weiter</p>');
    await assert.rejects(findClickTarget(page,'Weiter'),/label rather than a clickable/);
    await page.setContent('<button hidden>Weiter</button><button>Weiter</button>');
    assert.equal(await (await findClickTarget(page,'Weiter')).isVisible(),true);
  } finally {await browser.close();}
});

test('plus instructions resolve the icon beside the named service, including the reported typo',async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage();
    await page.route('**/*',route=>route.abort());
    const service='Umschreibung ausländischer Führerschein (sonstige Staaten)';
    for(const icon of ['<span class="fa fa-plus"></span>','<svg data-icon="plus"></svg>','+']) {
      await page.setContent(`<div role="group"><span>Other service</span><button onclick="document.body.dataset.clicked='wrong'">+</button></div><div role="group"><span>${service}</span><button onclick="document.body.dataset.clicked='correct'">${icon}</button></div>`);
      await (await findClickTarget(page,`Click on t the plus for ${service}`)).click();
      assert.equal(await page.locator('body').getAttribute('data-clicked'),'correct');
    }
    await page.setContent(`<div role="group"><span>${service}</span><button aria-label="Anzahl erhöhen" title="Hinzufügen" onclick="document.body.dataset.clicked='correct'"><svg></svg></button></div>`);
    await (await findClickTarget(page,`Click the plus icon next to "${service}"`)).click();
    assert.equal(await page.locator('body').getAttribute('data-clicked'),'correct');
    await page.setContent(`<div><div role="group"><span>${service}</span><button>−</button></div><div role="group"><span>Other service</span><button>+</button></div></div>`);
    await assert.rejects(findClickTarget(page,`plus for ${service}`),/No identifiable plus/);
    await page.setContent(`<div role="group"><span>${service}</span><button>+</button><button>+</button></div>`);
    await assert.rejects(findClickTarget(page,`plus for ${service}`),/Several plus controls/);
  } finally {await browser.close();}
});

test('modal clicks handle capitalization and nested labels without selecting background controls',async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage();await page.route('**/*',route=>route.abort());
    await page.setContent(`<button onclick="document.body.dataset.clicked='background'">Ok</button><div class="ui-dialog" role="dialog"><button onclick="document.body.dataset.clicked='modal'"><span> OK </span></button></div>`);
    await (await findClickTarget(page,'Ok',{instruction:'Click "Ok" on the modal'})).click();
    assert.equal(await page.locator('body').getAttribute('data-clicked'),'modal');
    await page.setContent('<button>OK</button><div role="dialog"><button>Cancel</button></div>');
    await assert.rejects(findClickTarget(page,'Ok',{instruction:'Click "Ok" on the modal',timeout:100}),/in the open modal/);
    await page.setContent('<div role="dialog"><button>OK</button><button>Ok</button></div>');
    await assert.rejects(findClickTarget(page,'Ok',{instruction:'Click "Ok" on the modal'}),/Several controls/);
    await page.setContent('<div role="dialog"><input type="button" value="OK"></div>');
    assert.equal(await (await findClickTarget(page,'Ok',{instruction:'Click "Ok" on the modal'})).getAttribute('value'),'OK');
    await page.setContent('<div role="dialog"><button>Save (draft)</button></div>');
    assert.equal(await (await findClickTarget(page,'save (draft)',{instruction:'Click "save (draft)" in the modal'})).innerText(),'Save (draft)');
    await page.setContent('<div role="dialog"></div><script>setTimeout(()=>document.querySelector("div").innerHTML="<button>OK</button>",100)</script>');
    assert.equal(await (await findClickTarget(page,'Ok',{instruction:'Click "Ok" on the modal'})).innerText(),'OK');
  } finally {await browser.close();}
});
