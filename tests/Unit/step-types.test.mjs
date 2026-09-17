import {readFileSync} from 'node:fs';
import {configureStepTypes} from '../../public/step-types.js';
import {configureNotificationProviders} from '../../public/step-notification.js';
const catalog=JSON.parse(readFileSync(new URL('../../database/seeders/editor-configuration.json',import.meta.url),'utf8'));
configureStepTypes(catalog.step_types);
configureNotificationProviders(catalog.notification_providers);
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stepTypes,parseStep,parseConditional,formatConditional,defaultConditional,chooseBranch} from '../../public/step-types.js';

test('each picker type has a useful default and condition defaults round-trip',()=>{
  for(const type of ['click','instruction','check','condition','navigate']) assert.ok(stepTypes[type].text);
  assert.deepEqual(parseConditional(stepTypes.condition.text),defaultConditional());
});
test('conditional instructions preserve quotes, URLs and both actions',()=>{
  const value={condition:'The "next" appointment',then:{type:'navigate',text:'Go to https://example.com/path?value=one'},else:{type:'instruction',text:'Ask about "different dates"'}};
  assert.deepEqual(parseConditional(formatConditional(value)),value);
});
test('text mode recognizes branch steps and keeps free text as instruction',()=>{
  assert.equal(parseStep('1. If "Available" is visible then click: "Continue" else review: "Pause"').type,'condition');
  assert.equal(parseStep('Ask which service is needed').type,'instruction');
  assert.equal(parseStep('Go to https://example.com').type,'navigate');
  assert.equal(parseStep('Verify "Available"').type,'check');
});
test('visible condition selects Then, missing or hidden text selects Else',async()=>{
  const text=formatConditional({...defaultConditional(),condition:"Expected text"});
  for(const [states,expected] of [[[true],'click'],[[false,true],'click'],[[],'review'],[[false],'review']]) {
    const page={getByText:(value,options)=>{assert.equal(value,'Expected text');assert.equal(options.exact,true);return {all:async()=>states.map(visible=>({isVisible:async()=>visible}))};}};
    assert.equal((await chooseBranch(page,text)).action.type,expected);
  }
});
test('malformed or empty conditions cannot silently execute a branch',async()=>{
  assert.equal(parseConditional('If something then do whatever'),null);
  await assert.rejects(chooseBranch({},formatConditional({...defaultConditional(),condition:''})),/Complete the condition/);
});
