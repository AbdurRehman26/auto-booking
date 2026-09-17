import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {requestDecision,clickAndFollow,isNavigationAction} from '../../resources/js/browser-requests.mjs';

for(const label of ['OK','Weiter','Continue','Next']) test(`${label} submits its navigation form and waits for the redirected screen`,async()=>{
  const server=createServer((request,response)=>{
    if(request.url==='/next') {response.writeHead(303,{Location:'/result'});response.end();return;}
    response.setHeader('Content-Type','text/html');
    response.end(request.url==='/result'?'<h1>Select a location</h1>':`<form method="post" action="/next"><div role="dialog"><button>${label}</button></div></form>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage();
    let approval=null,posts=0;
    await page.route('**/*',async route=>{
      const request=route.request();
      const decision=requestDecision(request,{approvedNavigationOrigin:approval,mainFrame:request.isNavigationRequest() && request.frame()===page.mainFrame()});
      if(decision==='allow-approved-navigation') {approval=null;posts++;}
      else if(decision!=='allow') return route.abort();
      return route.continue();
    });
    await page.goto(`${origin}/start`);
    approval=isNavigationAction(label,`Click "${label}" on the modal`)?origin:null;
    await clickAndFollow(page,page.getByRole('button',{name:label}));
    assert.equal(page.url(),`${origin}/result`);
    assert.equal(await page.getByRole('heading').innerText(),'Select a location');
    assert.equal(posts,1);
    assert.equal(approval,null);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('modal dismissal completes without the five-second navigation timeout',async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage();
    await page.route('**/*',route=>route.abort());
    await page.setContent('<div role="dialog"><button onclick="this.parentElement.remove()">OK</button></div>');
    const started=Date.now();
    await clickAndFollow(page,page.getByRole('button',{name:'OK'}));
    assert.equal(await page.getByRole('dialog').count(),0);
    assert.ok(Date.now()-started<1500,'Dismissal should not wait for the navigation timeout');
  } finally {await browser.close();}
});
