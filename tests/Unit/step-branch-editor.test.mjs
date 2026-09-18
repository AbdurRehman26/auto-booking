import {readFileSync} from 'node:fs';
import {configureStepTypes} from '../../public/step-types.js';
import {configureNotificationProviders} from '../../public/step-notification.js';
const catalog=JSON.parse(readFileSync(new URL('../../database/seeders/editor-configuration.json',import.meta.url),'utf8'));
Object.assign(catalog,{schedule_fields:{'Manual only':[],'Every day':['time'],'Specific days':['days','time'],'On a specific date':['date','time']},schedule_defaults:{time:'09:00',timezone:'Europe/Berlin',days:[1],date:''},schedule_days:{'1':'Monday','3':'Wednesday'},timezones:['Europe/Berlin','UTC']});
catalog.schedule_repeat_options={'0':'Once at a specific time','1':'Every minute','15':'Every 15 minutes','custom':'Custom interval'};
catalog.intervals.push('Every day','Specific days','On a specific date');
configureStepTypes(catalog.step_types);
configureNotificationProviders(catalog.notification_providers);
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {stepTypes,parseConditional,formatConditional,defaultConditional} from '../../public/step-types.js';
import {parseNotification} from '../../public/step-notification.js';

test('branches use regular editors and persist nested settings without changing the other branch',async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage();
    const flow={id:1,name:'Editor fixture',status:'Draft',url:'https://example.com',interval:'Manual only',pause:true,notifications:[],steps:[{type:'condition',text:formatConditional({...defaultConditional(),then:{type:'notify',text:'Click \"Continue\"'}})}]};
    let saved;
    let rejectActivation=false;
    let savedChannels=[];
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!=='https://editor.test') return route.abort();
      if(url.pathname==='/api/channels') {
        if(route.request().method()==='POST') {const channel={id:1,...route.request().postDataJSON()};savedChannels=[channel];return route.fulfill({status:201,json:channel});}
        return route.fulfill({json:savedChannels});
      }
      if(url.pathname==='/api/editor-configuration') return route.fulfill({json:catalog});
      if(url.pathname.startsWith('/api/workflows')) {
        if(route.request().method()==='PUT') {
          if(rejectActivation && route.request().postDataJSON().scheduleEnabled) return route.fulfill({status:422,json:{message:'Choose a schedule, start URL, and at least one step before enabling scheduled runs.'}});
          saved=route.request().postDataJSON();
        }
        return route.fulfill({json:route.request().method()==='GET'?[saved||flow]:saved});
      }
      if(url.pathname==='/') {
        const html=(await readFile(new URL('../../resources/views/app.blade.php',import.meta.url),'utf8')).replace(/\{\{ asset\('([^']+)'\) \}\}/g,'/$1');
        return route.fulfill({contentType:'text/html',body:html});
      }
      const file=url.pathname.slice(1);
      if(!/^[\w-]+\.(js|css)$/.test(file)) return route.abort();
      return route.fulfill({contentType:file.endsWith('.js')?'application/javascript':'text/css',body:await readFile(new URL('../../public/'+file,import.meta.url),'utf8')});
    });
    await page.goto('https://editor.test');
    async function choose(path,branch,type) {
      const container=page.locator(`[data-step-path="${path}"] > .condition-editor > [data-branch="${branch}"]`);
      await container.locator(':scope > .branch-heading > .branch-change').click();
      const picker=container.locator(':scope > .branch-picker');
      assert.equal(await picker.locator('.step-choice').count(),Object.keys(stepTypes).length);
      await picker.locator(`[data-branch-type="${type}"]`).click();
    }
    assert.equal(await page.locator('[data-step-path="then"] [data-notification-field="message"]').inputValue(),'Click \"Continue\"');
    await choose('','then','notify');
    const branch=page.locator('[data-step-path="then"]');
    await branch.locator('[data-notification-field="provider"]').selectOption('slack');
    await branch.locator('[data-notification-field="destination"]').fill('https://hooks.slack.com/services/example');
    await branch.locator('[data-notification-field="message"]').fill('Appointment found');
    await choose('','else','condition');
    await choose('else','then','wait');
    await page.locator('[data-step-path="else.then"] [data-wait-duration]').fill('7');
    await choose('else','else','scroll');
    await page.locator('[data-step-path="else.else"] [data-scroll-field="direction"]').selectOption('up');
    await page.locator('[data-step-path="else.else"] [data-scroll-field="distance"]').fill('450');
    await page.waitForResponse(response=>response.url().endsWith('/api/workflows/1') && response.request().method()==='PUT');
    const value=parseConditional(saved.steps[0].text);
    assert.deepEqual(parseNotification(value.then.text),{provider:'slack',destination:'https://hooks.slack.com/services/example',message:'Appointment found'});
    const nested=parseConditional(value.else.text);
    assert.equal(nested.then.text,'Wait 7 seconds');
    assert.equal(nested.else.text,'Scroll up 450 pixels');
    await page.reload();
    assert.equal(await page.locator('[data-step-path="else.then"] [data-wait-duration]').inputValue(),'7');
    assert.equal(await page.locator('[data-step-path="then"] [data-notification-field="message"]').inputValue(),'Appointment found');
    await page.getByRole('button',{name:'Change then step',exact:true}).click();
    const picker=page.locator('#branch-picker-0-then');
    assert.equal(await picker.locator('.step-choice').first().textContent(),await page.locator('#stepChoices .step-choice').first().textContent());
    await picker.locator('.step-choice').first().press('Escape');
    assert.equal(await picker.isVisible(),false);
    assert.equal(await branch.locator('[data-notification-field="destination"]').getAttribute('type'),'url');
    await branch.locator('[data-notification-field="provider"]').selectOption('email');
    assert.equal(await branch.locator('[data-notification-field="destination"]').getAttribute('type'),'email');
    await branch.locator('[data-notification-field="destination"]').fill('reader@example.com');
    await branch.locator('[data-notification-field="subject"]').fill('Appointment alert');
    await page.waitForResponse(response=>response.url().endsWith('/api/workflows/1') && response.request().method()==='PUT');
    await page.reload();
    assert.equal(await branch.locator('[data-notification-field="subject"]').inputValue(),'Appointment alert');
    assert.equal(await branch.locator('[data-notification-field="destination"]').inputValue(),'reader@example.com');
    await page.locator('#interval').selectOption('Specific days');
    await page.locator('[data-schedule-field="days"][value="3"]').check();
    await page.locator('[data-schedule-field="time"]').fill('14:30');
    await page.locator('[data-schedule-field="time"]').blur();
    await page.waitForResponse(response=>response.url().endsWith('/api/workflows/1') && response.request().method()==='PUT');
    assert.deepEqual(saved.schedule,{days:[1,3],time:'14:30',timezone:'Europe/Berlin'});
    await page.reload();
    assert.equal(await page.locator('[data-schedule-field="days"][value="3"]').isChecked(),true);
    assert.equal(await page.locator('[data-schedule-field="time"]').inputValue(),'14:30');
    await page.locator('#scheduleRepeat').selectOption('custom');
    await page.locator('[data-schedule-field="repeat_minutes"]').fill('7');
    await page.locator('[data-schedule-field="repeat_minutes"]').blur();
    await page.waitForResponse(response=>response.url().endsWith('/api/workflows/1') && response.request().method()==='PUT');
    await page.reload();
    assert.equal(await page.locator('[data-schedule-field="repeat_minutes"]').inputValue(),'7');
    assert.equal(await page.locator('[data-schedule-field="days"][value="3"]').isChecked(),true);
    assert.equal(await page.locator('[data-schedule-field="time"]').count(),0);
    await page.getByRole('button',{name:'Channels',exact:false}).click();
    await page.locator('#newChannelBtn').click();
    await page.locator('#channelName').fill('Team alerts');
    await page.locator('#channelProvider').selectOption('slack');
    await page.locator('#channelDestination').fill('https://hooks.slack.com/services/example');
    await page.locator('#saveChannel').click();
    await page.locator('.channel-card h3').waitFor();
    assert.equal(await page.locator('.channel-card h3').textContent(),'Team alerts');
    await page.locator('#myFlowsNav').click();
    await branch.locator('[data-saved-channel]').selectOption('1');
    assert.equal(await branch.locator('[data-notification-field="provider"]').inputValue(),'slack');
    assert.equal(await branch.locator('[data-notification-field="destination"]').inputValue(),'https://hooks.slack.com/services/example');
    await page.locator('#activateFlow').click();
    await page.getByRole('button',{name:'Pause workflow',exact:true}).waitFor();
    assert.equal(saved.scheduleEnabled,true);
    assert.match(await page.locator('#activationError').textContent(),/Workflow activated/);
    assert.equal(await page.locator('#activationError').isVisible(),true);
    assert.equal(await page.locator('#workflowStatus').textContent(),'ACTIVE');
    await page.reload();
    await page.getByRole('button',{name:'Pause workflow',exact:true}).click();
    await page.getByRole('button',{name:'Activate workflow',exact:true}).waitFor();
    assert.equal(saved.scheduleEnabled,false);
    assert.match(await page.locator('#activationError').textContent(),/Workflow paused/);
    rejectActivation=true;
    await page.locator('#activateFlow').click();
    await page.locator('#activationError[data-kind="error"]').waitFor();
    assert.match(await page.locator('#activationError').textContent(),/Choose a schedule/);
    assert.equal(saved.scheduleEnabled,false);
    assert.equal(await page.locator('#activateFlow').isEnabled(),true);
    assert.equal(await page.locator('#workflowStatus').textContent(),'PAUSED');
    const originalSteps=structuredClone(saved.steps);
    await page.getByRole('button',{name:'Change step 1 type',exact:true}).click();
    const typePicker=page.locator('#step-type-picker-0');
    assert.equal(await typePicker.locator('[data-replace-type]').count(),Object.keys(stepTypes).length);
    await typePicker.locator('[data-replace-type="condition"]').click();
    assert.equal(await branch.locator('[data-notification-field="destination"]').inputValue(),'https://hooks.slack.com/services/example');
    assert.deepEqual(saved.steps,originalSteps);
    await page.getByRole('button',{name:'Change step 1 type',exact:true}).click();
    await typePicker.locator('[data-replace-type="wait"]').click();
    await page.locator('[data-step-path=""] [data-wait-duration]').fill('9');
    await page.waitForResponse(response=>response.url().endsWith('/api/workflows/1') && response.request().method()==='PUT');
    assert.deepEqual(saved.steps,[{type:'wait',text:'Wait 9 seconds'}]);
    await page.reload();
    assert.equal(await page.locator('[data-wait-duration]').inputValue(),'9');
    await page.getByRole('button',{name:'Change step 1 type',exact:true}).click();
    await typePicker.locator('[data-replace-type="click"]').press('Escape');
    assert.equal(await typePicker.isVisible(),false);
    assert.equal(await page.getByRole('button',{name:'Change step 1 type',exact:true}).getAttribute('aria-expanded'),'false');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);

  } finally {await browser.close();}
});
