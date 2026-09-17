import {test} from 'node:test';
import assert from 'node:assert/strict';
import {copyStep} from '../../public/step-reorder.js';

test('copy inserts an independent step and keeps notifications attached to their original steps',()=>{
  const flow={steps:[{id:11,type:'condition',text:'Conditional instruction'},{id:12,type:'scroll',text:'Scroll down 600 pixels'}],notifications:[{trigger:'step',step:0},{trigger:'step',step:1},{trigger:'complete'}]};
  assert.equal(copyStep(flow,0),true);
  assert.deepEqual(flow.steps.map(step=>step.type),['condition','condition','scroll']);
  assert.equal(flow.steps[1].text,'Conditional instruction');
  assert.equal(flow.steps[1].id,undefined);
  flow.steps[1].text='Changed copy';
  assert.equal(flow.steps[0].text,'Conditional instruction');
  assert.deepEqual(flow.notifications,[{trigger:'step',step:0},{trigger:'step',step:2},{trigger:'complete'}]);
  assert.equal(copyStep(flow,2),true);
  assert.equal(flow.steps[3].text,'Scroll down 600 pixels');
  assert.equal(copyStep(flow,-1),false);
});
