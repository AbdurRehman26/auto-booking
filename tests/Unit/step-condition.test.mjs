import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {parseCondition,evaluateCondition} from '../../public/step-condition.js';
import {chooseBranch,formatConditional} from '../../public/step-types.js';

test('conditions describe page state rather than literal instruction text',async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage();
    await page.setContent('<button>Weiter</button><div role="alert" hidden>No appointments</div><div role="dialog" hidden>Dialog</div>');
    assert.equal(await evaluateCondition(page,'button is shown'),true);
    assert.equal(await evaluateCondition(page,'button "Weiter" is shown'),true);
    assert.equal(await evaluateCondition(page,'"Missing" button is shown'),false);
    assert.equal(await evaluateCondition(page,'error message is shown'),false);
    assert.equal(await evaluateCondition(page,'modal is not visible'),true);
    await page.locator('[role="alert"]').evaluate(el=>el.hidden=false);
    const condition={condition:'error message is shown',then:{type:'notify',text:'Message'},else:{type:'wait',text:'Wait 3 seconds'}};
    assert.equal((await chooseBranch(page,formatConditional(condition))).action.type,'notify');
    assert.equal(await evaluateCondition(page,'"No appointments" is shown'),true);
    assert.equal(await evaluateCondition(page,'button "Weiter" is not shown'),false);
    assert.throws(()=>parseCondition('appointment is loaded'),/could not be interpreted/);
  } finally {await browser.close();}
});
