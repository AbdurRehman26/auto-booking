import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestDecision} from '../../resources/js/browser-requests.mjs';

test('a background POST no longer reports a navigation form submission',()=>{
  assert.equal(requestDecision({method:()=> 'POST',isNavigationRequest:()=>false}),'block-background');
});
test('actual form navigation remains blocked and reads continue',()=>{
  assert.equal(requestDecision({method:()=> 'POST',isNavigationRequest:()=>true}),'pause-submission');
  assert.equal(requestDecision({method:()=> 'GET',isNavigationRequest:()=>true}),'allow');
  assert.equal(requestDecision({method:()=> 'HEAD',isNavigationRequest:()=>false}),'allow');
  assert.equal(requestDecision({method:()=> 'DELETE',isNavigationRequest:()=>false}),'block-background');
});

test('only the approved same-site main-frame POST may navigate',()=>{
  const request={method:()=> 'POST',isNavigationRequest:()=>true,url:()=> 'https://booking.test/next'};
  assert.equal(requestDecision(request,{approvedNavigationOrigin:'https://booking.test',mainFrame:true}),'allow-approved-navigation');
  assert.equal(requestDecision(request,{approvedNavigationOrigin:'https://other.test',mainFrame:true}),'pause-submission');
  assert.equal(requestDecision(request,{approvedNavigationOrigin:'https://booking.test',mainFrame:false}),'pause-submission');
  assert.equal(requestDecision({...request,isNavigationRequest:()=>false},{approvedNavigationOrigin:'https://booking.test',mainFrame:true}),'block-background');
});

test('explicit next-step controls allow navigation but final booking labels do not',async()=>{
  const {isNavigationAction}=await import('../../resources/js/browser-requests.mjs');
  for(const label of ['Weiter','weiter','Next','Continue','Fortfahren','Weiter →']) assert.equal(isNavigationAction(label),true);
  for(const label of ['Jetzt buchen','Termin bestätigen','Pay','Submit','OK']) assert.equal(isNavigationAction(label),false);
  assert.equal(isNavigationAction('OK','Click "ok" on the modal'),true);
});
