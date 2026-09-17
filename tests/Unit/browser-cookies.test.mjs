import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {dismissOptionalCookies} from '../../resources/js/browser-cookies.mjs';
let browser;
before(async()=>{browser=await chromium.launch();});
after(async()=>{await browser?.close();});
async function fixture(html, callback) {
  const page=await browser.newPage();
  try {await page.setContent(html);await callback(page);} finally {await page.close();}
}

test('declines optional cookies without clicking accept', async()=>{
  await fixture(`<section id="cookie-banner">This website uses cookies.<button onclick="document.body.dataset.choice='all'">Accept all</button><button onclick="document.body.dataset.choice='minimum';this.parentElement.remove()">Reject all</button></section>`,async page=>{
    assert.equal(await dismissOptionalCookies(page),true);
    assert.equal(await page.locator('body').getAttribute('data-choice'),'minimum');
  });
});
test('handles the German minimum-cookie choice',async()=>{
  await fixture(`<div class="cookie-notice">Diese Website verwendet Cookies.<button onclick="this.parentElement.remove()">Ablehnen</button><button>Akzeptieren</button></div>`,async page=>{
    assert.equal(await dismissOptionalCookies(page),true);
    assert.equal(await page.locator('.cookie-notice').count(),0);
  });
});
test('turns optional categories off before saving settings',async()=>{
  await fixture(`<div role="dialog">Cookie preferences<button onclick="document.querySelector('#options').hidden=false;this.remove()">Cookie settings</button><div id="options" hidden><label><input type="checkbox" checked disabled>Necessary cookies</label><label><input id="marketing" type="checkbox" checked>Marketing cookies</label><label><input id="analytics" type="checkbox" checked>Analytics cookies</label><button onclick="document.body.dataset.optional=document.querySelector('#marketing').checked||document.querySelector('#analytics').checked;document.querySelector('[role=dialog]').remove()">Save preferences</button></div></div>`,async page=>{
    assert.equal(await dismissOptionalCookies(page),true);
    assert.equal(await page.locator('body').getAttribute('data-optional'),'false');
  });
});
test('never accepts all as a fallback',async()=>{
  await fixture(`<div id="cookie-banner">Cookies<button onclick="document.body.dataset.choice='all'">Accept all</button></div>`,async page=>{
    await assert.rejects(dismissOptionalCookies(page),/no clear necessary-only/);
    assert.equal(await page.locator('body').getAttribute('data-choice'),null);
  });
});
test('does not click unrelated reject buttons',async()=>{
  await fixture(`<main><h1>Booking</h1><button onclick="document.body.dataset.clicked='yes'">Reject all</button></main>`,async page=>{
    assert.equal(await dismissOptionalCookies(page),false);
    assert.equal(await page.locator('body').getAttribute('data-clicked'),null);
  });
});
test('does not save settings with unknown categories',async()=>{
  await fixture(`<div role="dialog">Cookie settings<button onclick="this.remove()">Manage preferences</button><label><input type="checkbox" checked>Partner services</label><button onclick="document.body.dataset.saved='yes'">Save preferences</button></div>`,async page=>{
    await assert.rejects(dismissOptionalCookies(page),/no clear necessary-only/);
    assert.equal(await page.locator('body').getAttribute('data-saved'),null);
  });
});
test('handles consent banners inside a frame',async()=>{
  await fixture(`<iframe srcdoc='<div id="cookie-banner">Cookies<button onclick="this.parentElement.remove()">Necessary only</button></div>'></iframe>`,async page=>{
    await page.frames()[1].getByRole('button').waitFor();
    assert.equal(await dismissOptionalCookies(page),true);
    assert.equal(await page.frames()[1].locator('#cookie-banner').count(),0);
  });
});
