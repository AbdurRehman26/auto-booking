import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseWait,executeWait} from '../../public/step-wait.js';

test('wait accepts durations and a few seconds without interpreting availability as a timer',()=>{
  assert.equal(parseWait('Wait for a few seconds'),3);
  assert.equal(parseWait('Wait 5 seconds'),5);
  assert.equal(parseWait('Wait for 0.5s'),0.5);
  for(const text of ['Wait for availability','Wait -1 seconds','Wait 0 seconds','Wait 31 seconds']) assert.equal(parseWait(text),null);
});
test('wait counts down the requested duration then continues',async()=>{
  let clock=0;const ticks=[];
  const result=await executeWait('Wait for a few seconds',{now:()=>clock,sleep:async ms=>{clock+=ms;},onTick:value=>ticks.push(value)});
  assert.equal(clock,3000);
  assert.deepEqual(ticks,[3,2,1]);
  assert.equal(result,'Waited 3 seconds.');
});
test('stop interrupts a wait promptly instead of waiting for its entire duration',async()=>{
  let clock=0;
  await assert.rejects(executeWait('Wait 30 seconds',{now:()=>clock,sleep:async ms=>{clock+=ms;},assertRunning:()=>{if(clock>=200) throw new Error('Stopped');}}),/Stopped/);
  assert.equal(clock,200);
  await assert.rejects(executeWait('Wait for availability'),/Specify a wait/);
});
