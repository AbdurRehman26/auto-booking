import {test} from 'node:test';
import assert from 'node:assert/strict';
import {judgeCondition,interpretCondition} from '../../resources/js/browser-ai-condition.mjs';
import {chooseBranch,formatConditional} from '../../public/step-types.js';
const pageText='Leider sind keine Termine verfügbar.';
const reply=(result,evidence=pageText)=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({result,evidence,reason:'The displayed message states availability.'})}]}]})});
test('semantic decision uses grounded evidence and chooses the corresponding branch',async()=>{
  for(const result of ['true','false']) {
    const options={key:'test-key',send:async(url,request)=>{
      assert.equal(url,'https://api.openai.com/v1/responses');
      const body=JSON.parse(request.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
      return reply(result);
    }};
    const chosen=await chooseBranch({},formatConditional({condition:'It shows that Appoint is not available',then:{type:'record',text:'Unavailable'},else:{type:'record',text:'Available'}}),()=>judgeCondition('It shows that Appoint is not available',pageText,options));
    assert.equal(chosen.action.text,result==='true'?'Unavailable':'Available');
    assert.equal(chosen.evidence,pageText);
  }
});
test('uncertain, ungrounded, failed, and unconfigured AI never select a branch',async()=>{
  await assert.rejects(judgeCondition('Availability',pageText,{key:''}),/OPENAI_API_KEY/);
  for(const response of [reply('uncertain'),reply('true','invented evidence'),{ok:false,status:429,json:async()=>{throw new Error("No JSON body");}},{ok:true,json:async()=>({status:'incomplete'})}]) {
    await assert.rejects(judgeCondition('Availability',pageText,{key:'test',send:async()=>response}),/No branch was selected/);
  }
  await assert.rejects(judgeCondition('Availability',pageText,{key:'test',send:async()=>{throw new Error('secret');}}),/No branch was selected/);
});
test('explicit element checks need no AI connection',async()=>{
  const page={getByRole:()=>({all:async()=>[{isVisible:async()=>true}]})};
  assert.equal((await interpretCondition(page,'button is shown',{key:''})).matched,true);
});

test('billing errors are distinguished from rate limits without exposing response secrets',async()=>{
  for(const [code,type,expected] of [['credit_balance_exhausted','insufficient_quota',/credits are exhausted/],['project_spend_limit_exceeded','insufficient_quota',/project spending limit/],['rate_limit_exceeded','rate_limit_error',/temporarily rate-limiting/]]) {
    let calls=0;
    await assert.rejects(judgeCondition('Availability',pageText,{key:'test',send:async()=>{calls++;return {ok:false,status:429,json:async()=>({error:{code,type,message:'secret'}})};}}),error=>expected.test(error.message)&&!error.message.includes('secret'));
    assert.equal(calls,1);
  }
});

test('OpenAI failures fall back to exact or substring matching, including a missing key',async()=>{
  function pageWith(text){const frame={evaluate:async()=>text};return {frames:()=>[frame],mainFrame:()=>frame};}
  for(const options of [{key:''},{key:'test',send:async()=>({ok:false,status:429,json:async()=>({error:{code:'credit_balance_exhausted'}})})},{key:'test',send:async()=>{throw new Error('timeout');}}]) {
    const exact=await interpretCondition(pageWith('Header\nAppoint is not available'),'It shows that Appoint is not available',options);
    assert.equal(exact.matched,true);assert.match(exact.evidence,/exact match/);
    const partial=await interpretCondition(pageWith('Notice: Appoint   is not available today'),'It shows that Appoint is not available',options);
    assert.equal(partial.matched,true);assert.match(partial.evidence,/substring match/);
    const missing=await interpretCondition(pageWith('Welcome'),'It shows that Appoint is not available',options);
    assert.equal(missing.matched,false);assert.match(missing.evidence,/not proof/);
  }
  await assert.rejects(interpretCondition(pageWith(pageText),'Appointment availability',{key:'test',send:async()=>reply('uncertain')}),/Condition uncertain/);
  await assert.rejects(interpretCondition(pageWith(''),'Appointment availability',{key:''}),/No branch was selected/);
});
