import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {parseScroll,parseStep,executeScroll,formatConditional,parseConditional} from '../../public/step-types.js';

test('scroll instructions validate direction and distance and work in branches',()=>{
  assert.equal(parseStep('Scroll down 600 pixels').type,'scroll');
  assert.deepEqual(parseScroll('Scroll up 250 px'),{direction:'up',distance:250});
  for(const text of ['Scroll down 0 pixels','Scroll down 5001 pixels','Scroll left 200 pixels','Scroll down -10 pixels']) assert.equal(parseScroll(text),null);
  const branch={condition:'More results',then:{type:'scroll',text:'Scroll down 600 pixels'},else:{type:'review',text:'Pause'}};
  assert.deepEqual(parseConditional(formatConditional(branch)),branch);
});
test('scroll moves a real page down and up and reports its boundary',async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage({viewport:{width:800,height:600}});
    await page.setContent('<main style="height:3000px">Long booking page</main>');
    assert.equal(await executeScroll(page,'Scroll down 600 pixels'),'Scrolled down 600 pixels.');
    assert.equal(await page.evaluate(()=>window.scrollY),600);
    assert.equal(await executeScroll(page,'Scroll up 600 pixels'),'Scrolled up 600 pixels.');
    assert.equal(await executeScroll(page,'Scroll up 600 pixels'),'Already at the top of the page.');
    await assert.rejects(executeScroll(page,'Scroll down 9000 pixels'),/1 to 5000/);
  } finally {await browser.close();}
});
