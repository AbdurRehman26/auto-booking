import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {moveStep} from '../../public/step-reorder.js';
import {readFileSync} from 'node:fs';

test('moving steps preserves their data and updates step notification targets',()=>{
  const flow={steps:[{text:'Open'},{text:'Click',type:'click'},{text:'Verify'}],notifications:[{trigger:'step',step:1},{trigger:'complete'}]};
  assert.equal(moveStep(flow,1,0),true);
  assert.deepEqual(flow.steps.map(s=>s.text),['Click','Open','Verify']);
  assert.equal(flow.notifications[0].step,0);
  assert.equal(moveStep(flow,0,2),true);
  assert.equal(flow.notifications[0].step,2);
  assert.equal(moveStep(flow,0,-1),false);
});
test('mouse, touch and keyboard reorder steps and cancellation preserves order',async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage({hasTouch:true});
    await page.setContent(`<style>.step{height:100px}.step-drag{touch-action:none;width:50px;height:50px}</style><div id="steps">${[0,1,2].map(i=>`<div class="step" data-index="${i}"><button class="step-drag">${i}</button></div>`).join('')}</div>`);
    const source=readFileSync(new URL('../../public/step-reorder.js',import.meta.url),'utf8');
    await page.addScriptTag({type:'module',content:source+`\nwindow.moves=[];bindStepDragging(document.querySelector('#steps'),(from,to)=>window.moves.push([from,to]));window.ready=true;`});
    await page.waitForFunction(()=>window.ready);
    await page.mouse.move(25,25);await page.mouse.down();await page.mouse.move(25,280,{steps:10});await page.mouse.up();
    assert.deepEqual(await page.evaluate(()=>window.moves),[[0,2]]);
    await page.locator('[data-index="1"] .step-drag').focus();await page.keyboard.press('ArrowDown');
    assert.deepEqual(await page.evaluate(()=>window.moves.at(-1)),[1,2]);
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:25,y:25}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:25,y:280}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.deepEqual(await page.evaluate(()=>window.moves.at(-1)),[1,2]);
    assert.equal(await page.evaluate(()=>window.moves.length),3);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:25,y:25}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:25,y:280}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    assert.equal(await page.evaluate(()=>window.moves.length),3);
    assert.deepEqual(await page.locator('.step').evaluateAll(rows=>rows.map(row=>row.dataset.index)),['0','1','2']);
  } finally {await browser.close();}
});
