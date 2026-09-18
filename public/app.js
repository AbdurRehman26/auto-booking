import {configureNotificationProviders,notificationProviders,parseNotification,formatNotification,notificationTitle} from './step-notification.js';
import {parseWait} from './step-wait.js';
import {moveStep, copyStep, bindStepDragging} from './step-reorder.js';
import {configureStepTypes,stepTypes, parseScroll, parseStep, parseConditional, formatConditional, defaultConditional} from './step-types.js';
let icons = {}, labels = {}, channelIcons = {}, triggerLabels = {}, editorConfiguration;
let flows = [];
let channels = [], currentSection = 'flows', editingChannel = null;
let activeId = null;
let activationPending=false;
let runTimer;
const $ = s => document.querySelector(s);
const active = () => flows.find(f=>f.id===activeId);
const csrf = document.querySelector('meta[name="csrf-token"]').content;
async function api(path, options={}) {
  const response=await fetch(path,{...options,headers:{'Accept':'application/json','Content-Type':'application/json','X-CSRF-TOKEN':csrf,...options.headers}});
  if(response.status===401 || response.status===419) {window.location.assign('/login');throw new Error('Please sign in again.');}
  if(!response.ok) throw new Error((await response.json().catch(()=>({message:'Request failed'}))).message||'Request failed');
  return response.status===204?null:response.json();
}
const pendingSaves = new Map();
let saveChain = Promise.resolve();
const save = () => {
  const flow=active();
  if(!flow) return;
  const snapshot=structuredClone(flow);
  clearTimeout(pendingSaves.get(flow.id));
  pendingSaves.set(flow.id,setTimeout(()=>{
    pendingSaves.delete(snapshot.id);
    saveChain=saveChain.then(async()=>{
      try {
        await api(`/api/workflows/${snapshot.id}`,{method:'PUT',body:JSON.stringify(snapshot)});
        if(activeId===snapshot.id) $('#flowMeta').textContent=`${active().steps.length} steps · Saved in database`;
      } catch(error) {toast(error.message);}
    });
  },300));
};
const esc = s => String(s).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

function stepEditor(step,index,path='') {
  const content=step.type==='record'?`<textarea class="step-instruction record-message" rows="3" maxlength="6000" placeholder="Write what you want to save for later…" aria-label="Step ${index+1} saved message">${esc(step.text)}</textarea>`:step.type==='notify'?notificationEditor(step,index):step.type==='condition'?conditionalEditor(step,index,path):step.type==='scroll'?scrollEditor(step,index):step.type==='wait'?waitEditor(step,index):`<input class="step-instruction" value="${esc(step.text)}" aria-label="Step ${index+1} instruction">`;
  return `<div data-step-path="${path}">${content}</div>`;
}
function editStep(target,change) {
  const root=active().steps[+target.closest('.step').dataset.index];
  const path=target.closest('[data-step-path]').dataset.stepPath.split('.').filter(Boolean);
  function update(step,remaining) {
    if(!remaining.length) {change(step);return;}
    const value=parseConditional(step.text);
    update(value[remaining[0]],remaining.slice(1));
    step.text=formatConditional(value);
  }
  update(root,path);save();
}
function notificationConfiguration(text) {
  return parseNotification(text)||{...parseNotification(stepTypes.notify.text),message:text};
}
function notificationEditor(step,index) {
  const value=notificationConfiguration(step.text);
  const meta=notificationProviders[value.provider];
  return `<div class="notification-step-editor">${channels.length?`<label>Use saved channel<select data-saved-channel><option value="">Choose a channel…</option>${channels.map(channel=>`<option value="${channel.id}">${esc(channel.name)} · ${esc(notificationProviders[channel.provider]?.label||channel.provider)}</option>`).join('')}</select></label><small class="condition-help">Copies the saved destination into this step. Later channel edits won’t change existing steps.</small>`:''}<label>Provider<select data-notification-field="provider" aria-label="Step ${index+1} provider">${Object.entries(notificationProviders).map(([provider,item])=>`<option value="${provider}" ${provider===value.provider?'selected':''}>${esc(item.label)}</option>`).join('')}</select></label><label>${esc(meta.destination)}<input type="${['url','email','tel'].includes(meta.input_type)?meta.input_type:'text'}" required data-notification-field="destination" value="${esc(value.destination)}" placeholder="${esc(meta.placeholder)}" aria-label="Step ${index+1} destination" autocomplete="off"></label>${meta.subject?`<label>Subject<input data-notification-field="subject" value="${esc(value.subject||'')}" placeholder="Appointment update" maxlength="200" required aria-label="Step ${index+1} email subject"></label>`:''}<label>Message<textarea data-notification-field="message" maxlength="1600" rows="3" aria-label="Step ${index+1} message">${esc(value.message)}</textarea></label><small class="condition-help">${esc(meta.help)}</small><small class="condition-help">Test runs preview this message unless you enable delivery beside Test run.</small></div>`;
}
function updateNotificationStep(event) {
  editStep(event.target,step=>{
  const value=notificationConfiguration(step.text);
  const field=event.target.dataset.notificationField;
  value[field]=event.target.value;
  if(field==='provider') {value.destination='';if(value.provider==='email') value.subject='Appointment update';else delete value.subject;}
  step.text=formatNotification(value);
  });
  if(event.target.dataset.notificationField==='provider') render();
}
function stepTitle(step) {return step.type==='notify'?notificationTitle(step.text):step.text;}
function waitEditor(step,index) {
  const seconds=parseWait(step.text);
  if(seconds===null) return `<input class="step-instruction" value="${esc(step.text)}" aria-label="Step ${index+1}"><small class="condition-help">Specify a duration, for example Wait 5 seconds.</small>`;
  return `<div class="scroll-editor"><label>Duration (seconds)<input type="number" min="0.1" max="30" step="0.1" data-wait-duration value="${seconds}" aria-label="Step ${index+1} wait duration"></label></div><small class="condition-help">Continues automatically after the countdown.</small>`;
}
function scrollEditor(step,index) {
  const value=parseScroll(step.text);
  if(!value) return `<input class="step-instruction" value="${esc(step.text)}" aria-label="Step ${index+1}"><small class="condition-help">Use: Scroll down 600 pixels (1–5000).</small>`;
  return `<div class="scroll-editor"><label>Direction<select data-scroll-field="direction" aria-label="Step ${index+1} scroll direction"><option value="down" ${value.direction==='down'?'selected':''}>Down</option><option value="up" ${value.direction==='up'?'selected':''}>Up</option></select></label><label>Distance (pixels)<input type="number" min="1" max="5000" step="1" data-scroll-field="distance" value="${value.distance}" aria-label="Step ${index+1} scroll distance"></label></div>`;
}
function updateScroll(event) {
  const card=event.target.closest('[data-step-path]');
  const distance=card.querySelector('[data-scroll-field="distance"]');
  if(!distance.checkValidity() || !distance.value) {distance.reportValidity();return;}
  editStep(event.target,step=>{step.text=`Scroll ${card.querySelector('[data-scroll-field="direction"]').value} ${distance.value} pixels`;});
}
function stepChoices(attribute='data-step-type') {
  return Object.entries(stepTypes).map(([type,meta])=>`<button class="step-choice" ${attribute}="${esc(type)}"><span class="step-icon" aria-hidden="true">${esc(meta.icon)}</span><span><strong>${esc(meta.label)}</strong><small>${esc(meta.description)}</small></span></button>`).join('');
}
function stepCard(step,index,path='') {
  return `<div class="step-card"><div class="step-icon">${esc(icons[step.type]||'•')}</div><div class="step-copy"><strong>${esc(labels[step.type]||'ACTION')}</strong>${stepEditor(step,index,path)}</div></div>`;
}
function conditionalEditor(step, index, path) {
  const value=parseConditional(step.text);
  if(!value) return `<input class="step-instruction" value="${esc(step.text)}" aria-label="Step ${index+1}"><small class="condition-help">Use: If "Text" is visible then click: "Click label" else review: "Pause"</small>`;
  return `<div class="condition-editor"><label>If<input placeholder='Button "Continue" is shown, or error message is shown' data-condition-field="condition" value="${esc(value.condition)}" aria-label="Step ${index+1} condition"></label><small class="condition-help">Describe what the page shows. Free-form conditions use OpenAI and send visible page text for interpretation. If OpenAI fails, the condition uses exact or substring text matching. Uncertain AI results pause the run. Quote exact text to check it directly.</small>${['then','else'].map(branch=>{
    const branchPath=[path,branch].filter(Boolean).join('.');
    const pickerId=`branch-picker-${index}-${branchPath.replaceAll('.','-')}`;
    return `<div class="condition-branch" data-branch="${branch}"><div class="branch-heading"><span>${branch==='then'?'THEN':'ELSE'}</span><button class="step-duplicate branch-change" aria-expanded="false" aria-controls="${pickerId}" aria-label="Change ${branchPath} step">Change step</button></div>${stepCard(value[branch],index,branchPath)}<div id="${pickerId}" class="step-picker branch-picker hidden"><div class="step-picker-head"><strong>Choose a step</strong><button class="branch-picker-close" aria-label="Close step choices">×</button></div><div class="step-choices">${stepChoices('data-branch-type')}</div></div></div>`;
  }).join('')}</div>`;
}
function bindBranchPickers() {
  document.querySelectorAll('.branch-change').forEach(button=>button.onclick=()=>{
    const picker=document.getElementById(button.getAttribute('aria-controls'));
    const opening=picker.classList.contains('hidden');
    picker.classList.toggle('hidden',!opening);button.setAttribute('aria-expanded',String(opening));
    if(opening) picker.querySelector('.step-choice').focus();
  });
  document.querySelectorAll('.branch-picker').forEach(picker=>{
    const close=()=>{picker.classList.add('hidden');const button=picker.parentElement.querySelector('.branch-change');button.setAttribute('aria-expanded','false');button.focus();};
    picker.querySelector('.branch-picker-close').onclick=close;
    picker.onkeydown=event=>{if(event.key==='Escape'){event.stopPropagation();close();}};
  });
  document.querySelectorAll('[data-branch-type]').forEach(button=>button.onclick=()=>{
    const branch=button.closest('[data-branch]').dataset.branch;
    const path=[button.closest('[data-step-path]').dataset.stepPath,branch].filter(Boolean).join('.');
    const index=button.closest('.step').dataset.index;
    editStep(button,step=>{
      const value=parseConditional(step.text);
      const type=button.dataset.branchType;
      if(value[branch].type!==type) value[branch]={type,text:stepTypes[type].text};
      step.text=formatConditional(value);
    });
    render();
    document.querySelector(`[data-index="${index}"] [data-step-path="${path}"] input`)?.focus();
  });
}
function updateConditional(event) {
  const [branch,field]=event.target.dataset.conditionField.split('.');
  editStep(event.target,step=>{
    const value=parseConditional(step.text)||defaultConditional();
    if(field) value[branch]={type:event.target.value,text:stepTypes[event.target.value].text};
    else value.condition=event.target.value;
    step.text=formatConditional(value);
  });
  if(field) render();
}
function closeStepPicker() {
  $('#stepPicker').classList.add('hidden');
  $('#addStepBtn').setAttribute('aria-expanded','false');
}
function reorderStep(from,to) {
  if(!moveStep(active(),from,to)) return;
  save();render();
  const handle=$(`#steps .step[data-index="${to}"] .step-drag`);
  handle.focus({preventScroll:true});
  handle.scrollIntoView({block:'nearest'});
  $('#reorderStatus').textContent=`Step ${from+1} moved to position ${to+1}.`;
}
function renderSchedule() {
  const flow=active();
  const fields=editorConfiguration.schedule_fields[flow.interval]||[];
  const value={...editorConfiguration.schedule_defaults,...flow.schedule};
  const repeat=Number(value.repeat_minutes||0);
  const options=editorConfiguration.schedule_repeat_options;
  const custom=value.repeat_custom || !(String(repeat) in options);
  const repeatEditor=fields.length?`<label class="field"><span>Time / interval</span><select id="scheduleRepeat">${Object.entries(options).map(([key,label])=>`<option value="${esc(key)}" ${(custom?key==='custom':key===String(repeat))?'selected':''}>${esc(label)}</option>`).join('')}</select></label>${custom?`<label class="field"><span>Repeat every (minutes)</span><input data-schedule-field="repeat_minutes" type="number" min="1" max="1440" step="1" required value="${repeat||1}"></label>`:''}` : '';
  $('#scheduleFields').innerHTML=(fields.includes('days')?`<fieldset class="schedule-days"><legend>Choose one or more days</legend>${Object.entries(editorConfiguration.schedule_days).sort(([a],[b])=>(Number(a)||7)-(Number(b)||7)).map(([day,label])=>`<label><input type="checkbox" data-schedule-field="days" value="${day}" ${(value.days||[]).map(Number).includes(Number(day))?'checked':''}>${esc(label)}</label>`).join('')}</fieldset>`:'')+(fields.includes('date')?`<label class="field"><span>Date</span><input type="date" data-schedule-field="date" value="${esc(value.date||'')}" required></label>`:'')+repeatEditor+(fields.includes('time')&&!repeat?`<label class="field"><span>Time</span><input type="time" data-schedule-field="time" value="${esc(value.time)}" required></label>`:'')+(fields.length?`<label class="field"><span>Timezone</span><select data-schedule-field="timezone">${editorConfiguration.timezones.map(zone=>`<option ${zone===value.timezone?'selected':''}>${esc(zone)}</option>`).join('')}</select></label>`:'' )+(repeat?`<small class="condition-help">Repeats every ${repeat} minute${repeat===1?'':'s'} throughout the selected days, starting at midnight in this timezone.</small>`:'');
  if($('#scheduleRepeat')) $('#scheduleRepeat').onchange=event=>{
    flow.schedule={...value,repeat_minutes:event.target.value==='custom'?1:Number(event.target.value),repeat_custom:event.target.value==='custom'};
    if(flow.schedule.repeat_minutes) delete flow.schedule.time;
    renderSchedule();save();
  };
  document.querySelectorAll('[data-schedule-field]').forEach(input=>input.onchange=()=>{
    if(!input.checkValidity()) {input.reportValidity();return;}
    const updated={...value,...active().schedule,[input.dataset.scheduleField]:input.dataset.scheduleField==='days'?[...document.querySelectorAll('[data-schedule-field="days"]:checked')].map(field=>Number(field.value)):input.dataset.scheduleField==='repeat_minutes'?Number(input.value):input.value};
    const keys=[...fields.filter(key=>key!=='time'||!Number(updated.repeat_minutes)),'timezone',...(updated.repeat_minutes!==undefined?['repeat_minutes','repeat_custom']:[])];
    active().schedule=Object.fromEntries(keys.filter(key=>updated[key]!==undefined).map(key=>[key,updated[key]]));
    if(fields.includes('days') && !updated.days.length) {toast('Choose at least one day');return;}
    if([...document.querySelectorAll('[data-schedule-field]')].every(field=>field.checkValidity())) save();
    if(input.dataset.scheduleField==='repeat_minutes') renderSchedule();
  });
}
function render(){
  const flow=active();
  closeStepPicker();
  document.querySelector('.canvas').style.display=flow&&currentSection==='flows'?'':'none';
  document.querySelector('.inspector').style.display=flow&&currentSection==='flows'?'':'none';
  $('#runBtn').disabled=!flow;
  if(!flow) {$('#flowList').textContent='No workflows yet. Choose New flow to begin.';return;}
  flow.notifications ||= [];
  $("#flowList").innerHTML=flows.map(f=>`<button class="flow-item ${f.id===activeId?'active':''}" data-id="${f.id}"><i></i><span>${esc(f.name)}<small>${f.steps.length} steps · ${f.status}</small></span></button>`).join("");
  $("#flowName").value=flow.name; $("#startUrl").value=flow.url; $("#interval").value=flow.interval;
  renderSchedule();
  $('#scheduleEnabled').checked=!!flow.scheduleEnabled;
  $('#scheduleEnabled').disabled=activationPending;
  $('#activateFlow').disabled=activationPending;
  $('#activateFlow').textContent=activationPending?'Saving…':flow.scheduleEnabled?'Pause workflow':'Activate workflow';
  $('#activateFlow').setAttribute('aria-pressed',String(!!flow.scheduleEnabled));
  $('#workflowStatus').textContent=flow.scheduleEnabled?'ACTIVE':'PAUSED';
  $('#workflowStatus').classList.toggle('workflow-active',!!flow.scheduleEnabled);
  $('#scheduledNotifications').checked=!!flow.scheduledNotifications;
  $("#flowMeta").textContent=`${flow.steps.length} steps · Saved in database`;
  $("#steps").innerHTML=flow.steps.map((s,i)=>`<div class="step" data-index="${i}"><button class="step-number step-drag" aria-label="Move step ${i+1}" aria-describedby="reorderHelp" title="Drag to move · Arrow keys to reorder"><span class="drag-grip" aria-hidden="true">⠿</span><span>${String(i+1).padStart(2,'0')}</span></button>${stepCard(s,i)}<div class="step-actions"><button class="step-duplicate" title="Copy step" aria-label="Copy step ${i+1}">Copy</button><button class="step-menu" title="Remove step" aria-label="Remove step ${i+1}">×</button></div></div>`).join("");
  $("#flowText").value=flow.steps.map((s,i)=>`${i+1}. ${s.type==='record'?'Save to database: ':''}${s.text}`).join("\n");
  $("#pauseToggle").classList.toggle("on",flow.pause);
  $("#notificationList").innerHTML=flow.notifications.length?flow.notifications.map((n,i)=>`<div class="notification-item"><span class="channel-icon">${channelIcons[n.channel]}</span><span><strong>${esc(n.channel)} · ${triggerLabels[n.trigger]}</strong><small>${esc(n.destination)}</small></span><button data-notify-index="${i}" aria-label="Remove notification">×</button></div>`).join(''):`<div class="notification-empty">No alerts yet. Add one for failures, availability, or a specific step.</div>`;
  const score=Math.min(100,55+flow.steps.length*6+(flow.url.startsWith('http')?7:0)); $("#score").textContent=score;
  $("#readinessText").textContent=flow.steps.length&&flow.url?"All steps look valid.":"Add a URL and at least one step.";
  document.querySelectorAll('.flow-item').forEach(b=>b.onclick=()=>{activeId=+b.dataset.id;render()});
  document.querySelectorAll('.step-instruction').forEach(input=>input.oninput=e=>{editStep(e.target,step=>{step.text=e.target.value;})});
  bindStepDragging($('#steps'),reorderStep);
  bindBranchPickers();
  document.querySelectorAll('[data-saved-channel]').forEach(input=>input.onchange=()=>{
    const channel=channels.find(item=>item.id===Number(input.value));if(!channel)return;
    editStep(input,step=>{const value=notificationConfiguration(step.text);step.text=formatNotification({...value,provider:channel.provider,destination:channel.destination,...(channel.provider==='email'?{subject:value.subject||'Appointment update'}:{})});});render();
  });
  document.querySelectorAll('[data-notification-field]').forEach(input=>input.oninput=updateNotificationStep);
  document.querySelectorAll('[data-wait-duration]').forEach(input=>input.oninput=()=>{
    if(!input.value || !input.checkValidity()) return;
    editStep(input,step=>{step.text=`Wait ${input.value} seconds`;});
  });
  document.querySelectorAll('[data-scroll-field]').forEach(input=>input.oninput=updateScroll);
  document.querySelectorAll('[data-condition-field]').forEach(input=>input.oninput=updateConditional);
  document.querySelectorAll('.step-actions > .step-duplicate').forEach(button=>button.onclick=()=>{
    const index=Number(button.closest('.step').dataset.index);
    if(!copyStep(active(),index)) return;
    save();render();
    const duplicate=$(`#steps .step[data-index="${index+1}"]`);
    duplicate.querySelector('input')?.focus({preventScroll:true});
    duplicate.scrollIntoView({block:'nearest'});
    toast(`Step ${index+1} copied`);
  });
  document.querySelectorAll('.step-menu').forEach(b=>b.onclick=e=>{active().steps.splice(+e.target.closest('.step').dataset.index,1);save();render();toast('Step removed')});
  document.querySelectorAll('[data-notify-index]').forEach(b=>b.onclick=()=>{active().notifications.splice(+b.dataset.notifyIndex,1);save();render();toast('Notification removed')});
}

async function newFlow(){try{const f=await api('/api/workflows',{method:'POST',body:JSON.stringify(editorConfiguration.workflow_defaults)});flows.unshift(f);activeId=f.id;render();toast('New flow created')}catch(e){toast(e.message)}}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
function switchMode(mode){document.querySelectorAll('.mode-switch button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$("#visualMode").classList.toggle('hidden',mode!=='visual');$("#textMode").classList.toggle('hidden',mode!=='text')}
let currentRun = null;
let runPending = false;
let runFinished = false;
let runStartedAt = 0;
const terminalRunStates = ['completed', 'paused', 'failed', 'stopped'];
function paintRun(state) {
  runFinished = terminalRunStates.includes(state.status);
  $('#previewBadge').textContent = {queued:'STARTING',running:'LIVE',completed:'COMPLETE',paused:'NEEDS INPUT',failed:'FAILED',stopped:'STOPPED'}[state.status] || state.status.toUpperCase();
  $('#previewBadge').dataset.status = state.status;
  $('#previewUrl').textContent = state.url || 'Opening browser…';
  $('#runStatus').textContent = state.message;
  $('#networkNotice').textContent = state.networkNotice || '';
  $('#networkNotice').classList.toggle('hidden', !state.networkNotice);
  $('#cookieNotice').textContent = state.cookieNotice || '';
  $('#cookieNotice').classList.toggle('hidden', !state.cookieNotice);
  const completed = state.steps.filter(step => step.status === 'done').length;
  $('#runCount').textContent = `${completed} / ${state.steps.length}`;
  $('#progressBar').style.width = `${completed / state.steps.length * 100}%`;
  $('#runSteps').innerHTML = state.steps.map((step,index) => `<div class="run-step ${esc(step.status)}"><i>${step.status==='done'?'✓':index+1}</i><span>${esc(stepTitle(step))}<small>${esc(step.detail || ({pending:'Waiting',active:'Running…'}[step.status] || step.status))}</small></span></div>`).join('');
  if(state.frame) {
    $('#previewFrame').src = state.frame;
    $('#previewFrame').classList.remove('hidden');
    $('#previewEmpty').classList.add('hidden');
    $('#previewTime').textContent = `${runFinished?'Last screenshot':'Updated'} · ${new Date(state.frameAt || state.updatedAt).toLocaleTimeString()}`;
  } else if(runFinished) {
    $('#previewEmpty strong').textContent = 'No screenshot captured';
    $('#previewEmpty p').textContent = state.message;
  }
  $('#stopRun').textContent = runFinished ? 'Close preview' : 'Stop test';
  $('#stopRun').disabled = false;
  $('#retryRun').classList.toggle('hidden', !runFinished);
}
async function pollRun(id) {
  if(currentRun !== id) return;
  try {
    const state = await api(`/api/test-runs/${id}`);
    if(currentRun !== id) return;
    paintRun(state);
    if(!runFinished) runTimer = setTimeout(()=>pollRun(id),800);
  } catch(error) {
    if(currentRun !== id) return;
    $('#runStatus').textContent = `Preview disconnected: ${error.message}. Reconnecting…`;
    if(Date.now()-runStartedAt < 90000) runTimer=setTimeout(()=>pollRun(id),2000);
    else {
      $('#runStatus').textContent = 'Preview connection lost. The browser has a one-minute limit. Close the preview and retry.';
      runFinished=true;
      $('#stopRun').textContent='Close preview';
      $('#retryRun').classList.remove('hidden');
    }
  }
}
async function testRun(){
  if(runPending || (currentRun && !runFinished)) return;
  const f=active();
  if(!f?.steps.length){toast('Add at least one step first');return}
  if(!/^https?:\/\//i.test(f.url)){toast('Add a valid start URL first');return}
  const sendNotifications=$('#deliverNotifications').checked;
  $('#deliverNotifications').checked=false;
  clearTimeout(runTimer);
  currentRun=null; runFinished=false; runPending=true; runStartedAt=Date.now();
  $('#runModal').classList.remove('hidden');
  $('#previewFrame').classList.add('hidden');
  $('#previewFrame').removeAttribute('src');
  $('#previewEmpty').classList.remove('hidden');
  $('#previewEmpty strong').textContent='Opening a fresh browser';
  $('#previewEmpty p').textContent='The real booking page will appear here.';
  $('#previewTime').textContent='Waiting for first screenshot';
  paintRun({status:'queued',url:f.url,message:'Starting a fresh browser…',steps:f.steps.map(step=>({...step,status:'pending'}))});
  $('#stopRun').disabled=true;
  $('#closeRun').focus();
  document.body.classList.add('preview-open');
  try {
    const state=await api('/api/test-runs',{method:'POST',body:JSON.stringify({url:f.url,steps:f.steps,send_notifications:sendNotifications})});
    currentRun=state.id; paintRun(state); pollRun(state.id);
  } catch(error) {
    runFinished=true;
    $('#runStatus').textContent=error.message;
    $('#previewBadge').textContent='FAILED';
    $('#previewEmpty strong').textContent='Could not start the browser';
    $('#previewEmpty p').textContent=error.message;
    $('#stopRun').textContent='Close preview';
    $('#stopRun').disabled=false;
    $('#retryRun').classList.remove('hidden');
  } finally {runPending=false;}
}
async function stopRun(close=false) {
  if(runPending) return;
  if(currentRun && !runFinished) {
    $('#stopRun').disabled=true;
    try {
      await api(`/api/test-runs/${currentRun}`,{method:'DELETE'});
      $('#runStatus').textContent='Stopping the browser…';
    } catch(error) {
      $('#runStatus').textContent=`Could not stop the browser: ${error.message}. Try again.`;
      $('#stopRun').disabled=false;
      return;
    }
  }
  if(close || runFinished) {
    clearTimeout(runTimer); currentRun=null;
    $('#runModal').classList.add('hidden');
    document.body.classList.remove('preview-open');
    $('#runBtn').focus();
  }
}

function openNotify(){
  const f=active();
  $("#notifyStep").innerHTML=f.steps.map((s,i)=>`<option value="${i}">${i+1}. ${esc(s.text)}</option>`).join('');
  $("#notifyChannel").value=editorConfiguration.notification_defaults.channel; $("#notifyTrigger").value=editorConfiguration.notification_defaults.trigger; $("#notifyDestination").value='';
  $("#notifyMessage").value=editorConfiguration.notification_defaults.message;
  updateNotifyFields(); $("#notifyModal").classList.remove('hidden');
}
function updateNotifyFields(){
  const channel=$("#notifyChannel").value;
  const config=editorConfiguration.channels[channel];
  $('#destinationLabel').textContent=config.destination; $('#notifyDestination').placeholder=config.placeholder;
  $("#stepTargetField").classList.toggle('hidden',$("#notifyTrigger").value!=='step');
}
function saveNotification(){
  const destination=$("#notifyDestination").value.trim();
  if(!destination){toast('Add a notification destination');return}
  active().notifications ||= [];
  active().notifications.push({id:crypto.randomUUID(),channel:$("#notifyChannel").value,trigger:$("#notifyTrigger").value,step:+$("#notifyStep").value,destination,message:$("#notifyMessage").value.trim()});
  save(); render(); $("#notifyModal").classList.add('hidden'); toast('Notification added');
}

$("#newFlowBtn").onclick=$("#addFlowSmall").onclick=newFlow;
$('#addStepBtn').onclick=()=>{
  const opening=$('#stepPicker').classList.contains('hidden');
  $('#stepPicker').classList.toggle('hidden',!opening);
  $('#addStepBtn').setAttribute('aria-expanded',String(opening));
  if(opening) $('#stepChoices button').focus();
};
$('#closeStepPicker').onclick=()=>{closeStepPicker();$('#addStepBtn').focus();};
$('#stepPicker').onkeydown=event=>{if(event.key==='Escape'){closeStepPicker();$('#addStepBtn').focus();}};
$("#flowName").onchange=e=>{active().name=e.target.value.trim()||'Untitled flow';save();render()};
$("#startUrl").onchange=e=>{active().url=e.target.value.trim();save();render()};
$("#interval").onchange=e=>{
  const flow=active();flow.interval=e.target.value;
  const fields=editorConfiguration.schedule_fields[flow.interval]||[];
  const value={...editorConfiguration.schedule_defaults,...flow.schedule};
  if(fields.includes('date') && !value.date) value.date=new Intl.DateTimeFormat('en-CA',{timeZone:value.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  flow.schedule=fields.length?Object.fromEntries([...fields.filter(key=>key!=='time'||!Number(value.repeat_minutes)),'timezone','repeat_minutes','repeat_custom'].filter(key=>value[key]!==undefined).map(key=>[key,value[key]])):null;
  renderSchedule();save();
};
function activationNotice(message,kind='info') {
  const notice=$('#activationError');
  notice.textContent=message;notice.dataset.kind=kind;
  notice.setAttribute('role',kind==='error'?'alert':'status');
  notice.classList.remove('hidden');
}
async function setWorkflowActive(enabled) {
  if(activationPending)return;
  const flow=active();if(!flow)return;
  const previous=!!flow.scheduleEnabled;
  activationPending=true;
  $('#activateFlow').disabled=true;$('#scheduleEnabled').disabled=true;
  $('#activateFlow').textContent=enabled?'Activating…':'Pausing…';
  activationNotice(enabled?'Saving your flow and enabling its schedule…':'Pausing future scheduled runs…');
  try {
    clearTimeout(pendingSaves.get(flow.id));pendingSaves.delete(flow.id);
    await saveChain;
    const snapshot={...structuredClone(flow),scheduleEnabled:enabled};
    await api('/api/workflows/'+flow.id,{method:'PUT',body:JSON.stringify(snapshot),signal:AbortSignal.timeout(15000)});
    flow.scheduleEnabled=enabled;
    const message=enabled?'Workflow activated. It will run at the next matching scheduled time.':'Workflow paused. No new scheduled runs will start.';
    activationNotice(message,'success');toast(message);
  } catch(error) {
    flow.scheduleEnabled=previous;
    const detail=error.name==='TimeoutError'?'The server did not respond in time. Refresh to confirm the saved status before retrying.':error.message;
    activationNotice(`Workflow ${enabled?'could not be activated':'could not be paused'}: ${detail}`,'error');
  } finally {
    activationPending=false;
    render();
    $('#activationError').scrollIntoView({block:'nearest',behavior:'smooth'});
  }
}
$('#scheduleEnabled').onchange=event=>setWorkflowActive(event.target.checked);
$('#activateFlow').onclick=()=>setWorkflowActive(!active().scheduleEnabled);
$('#scheduledNotifications').onchange=event=>{active().scheduledNotifications=event.target.checked;save();};
$("#pauseToggle").onclick=()=>{active().pause=!active().pause;save();render()};
$("#applyTextBtn").onclick=()=>{const parsed=$("#flowText").value.split('\n').map(parseStep).filter(Boolean);if(!parsed.length){toast('Write at least one instruction');return}active().steps=parsed;save();render();switchMode('visual');toast(`${parsed.length} steps created`)};
document.querySelectorAll('.mode-switch button').forEach(b=>b.onclick=()=>switchMode(b.dataset.mode));
$("#copyBtn").onclick=async()=>{try{const copy=structuredClone(active());delete copy.id;copy.scheduleEnabled=false;copy.name=`${copy.name} copy`;const created=await api('/api/workflows',{method:'POST',body:JSON.stringify(copy)});flows.unshift(created);activeId=created.id;render();toast('Flow copied')}catch(e){toast(e.message)}};
$("#deleteBtn").onclick=async()=>{if(flows.length===1){toast('Keep at least one flow');return}try{await api(`/api/workflows/${activeId}`,{method:'DELETE'});flows=flows.filter(f=>f.id!==activeId);activeId=flows[0].id;render();toast('Flow deleted')}catch(e){toast(e.message)}};
$("#runBtn").onclick=testRun;
$("#retryRun").onclick=testRun;
$("#closeRun").onclick=()=>stopRun(true);
$("#stopRun").onclick=()=>stopRun();
document.addEventListener('keydown', event => {
  if($('#runModal').classList.contains('hidden')) return;
  if(event.key === 'Escape') stopRun(true);
  if(event.key === 'Tab') {
    const controls=[...$('#runModal').querySelectorAll('button:not([disabled])')].filter(button=>!button.classList.contains('hidden'));
    const first=controls[0], last=controls.at(-1);
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  }
});
$("#runModal").onclick=e=>{if(e.target===$("#runModal")){$("#closeRun").click()}};
$("#openSiteBtn").onclick=()=>{const url=active().url;if(!/^https?:\/\//i.test(url)){toast('Add a valid start URL first');return}window.open(url,'_blank','noopener,noreferrer')};
$("#themeBtn").onclick=()=>document.body.classList.toggle('dark');
$("#addNotifyBtn").onclick=openNotify;
$("#closeNotify").onclick=$("#cancelNotify").onclick=()=>$("#notifyModal").classList.add('hidden');
$("#notifyChannel").onchange=$("#notifyTrigger").onchange=updateNotifyFields;
$("#saveNotify").onclick=saveNotification;
document.querySelectorAll('[data-var]').forEach(b=>b.onclick=()=>{$("#notifyMessage").value+=`${$("#notifyMessage").value?' ':''}${b.dataset.var}`});
$("#notifyModal").onclick=e=>{if(e.target===$("#notifyModal"))$("#closeNotify").click()};
function showSection(section) {
  currentSection=section;
  $('#channelsPage').classList.toggle('hidden',section!=='channels');
  $('#scheduledRunsPage').classList.toggle('hidden',section!=='scheduled');
  if(section==='scheduled') loadScheduledRuns();
  $('#recordsPage').classList.toggle('hidden',section!=='records');
  if(section==='records') loadRecords();
  document.querySelector('.intro-actions').classList.toggle('hidden',section!=='flows');
  document.querySelector('.sidebar .side-heading').classList.toggle('hidden',section!=='flows');
  $('#flowList').classList.toggle('hidden',section!=='flows');
  for(const [id,name] of [['myFlowsNav','flows'],['channelsNav','channels'],['recordsNav','records'],['scheduledRunsNav','scheduled']]) {
    $(`#${id}`).classList.toggle('active',section===name);
    if(section===name) $(`#${id}`).setAttribute('aria-current','page');else $(`#${id}`).removeAttribute('aria-current');
  }
  render();
}
function renderChannels() {
  $('#channelsList').innerHTML=channels.length?channels.map(channel=>`<article class="channel-card"><div class="step-icon">↗</div><div><h3>${esc(channel.name)}</h3><p>${esc(notificationProviders[channel.provider]?.label||channel.provider)} · Configured</p></div><div class="channel-actions"><button class="btn secondary" data-edit-channel="${channel.id}">Edit</button><button class="btn secondary" data-delete-channel="${channel.id}">Delete</button></div></article>`).join(''):`<div class="channels-empty"><h3>No channels yet</h3><p>Add a webhook, email address, or messaging destination to use in your flows.</p></div>`;
  document.querySelectorAll('[data-edit-channel]').forEach(button=>button.onclick=()=>openChannel(channels.find(channel=>channel.id===Number(button.dataset.editChannel))));
  document.querySelectorAll('[data-delete-channel]').forEach(button=>button.onclick=async()=>{
    try {await api('/api/channels/'+button.dataset.deleteChannel,{method:'DELETE'});channels=channels.filter(channel=>channel.id!==Number(button.dataset.deleteChannel));if(editingChannel===Number(button.dataset.deleteChannel))$('#channelForm').classList.add('hidden');renderChannels();render();toast('Channel deleted');}catch(error){toast(error.message);}
  });
}
function channelFields() {
  const meta=notificationProviders[$('#channelProvider').value];
  $('#channelDestinationLabel').textContent=meta.destination;
  $('#channelDestination').type=['email','url','tel'].includes(meta.input_type)?meta.input_type:'text';
  $('#channelDestination').placeholder=meta.placeholder;
  $('#channelHelp').textContent=meta.help;
}
function openChannel(channel=null) {
  editingChannel=channel?.id??null;
  $('#channelFormTitle').textContent=channel?'Edit channel':'Add channel';
  $('#channelName').value=channel?.name||'';
  $('#channelProvider').innerHTML=Object.entries(notificationProviders).map(([key,value])=>`<option value="${esc(key)}">${esc(value.label)}</option>`).join('');
  if(channel)$('#channelProvider').value=channel.provider;
  $('#channelDestination').value=channel?.destination||'';
  channelFields();$('#channelError').classList.add('hidden');$('#channelForm').classList.remove('hidden');$('#channelName').focus();
}
$('#myFlowsNav').onclick=()=>showSection('flows');
$('#channelsNav').onclick=()=>showSection('channels');
let scheduledRunPage=1;
async function loadScheduledRuns(page=1) {
  try {
    const result=await api('/api/scheduled-runs?page='+page);scheduledRunPage=page;
    $('#scheduledRunsList').innerHTML=result.data.length?result.data.map(run=>`<article class="channel-card"><div><h3>${esc(run.workflow_name)}</h3><p>${esc(run.status)} · ${esc(run.created_at)} UTC</p><p>${esc(run.message||'')}</p></div></article>`).join(''):'<p>No scheduled runs yet. Enable a schedule in My flows to begin.</p>';
    $('#previousScheduledRuns').disabled=page<=1;$('#nextScheduledRuns').disabled=page>=result.last_page;
  } catch(error){toast(error.message);}
}
$('#scheduledRunsNav').onclick=()=>showSection('scheduled');
$('#refreshScheduledRuns').onclick=()=>loadScheduledRuns();
$('#previousScheduledRuns').onclick=()=>loadScheduledRuns(scheduledRunPage-1);
$('#nextScheduledRuns').onclick=()=>loadScheduledRuns(scheduledRunPage+1);
$('#recordsNav').onclick=()=>showSection('records');
let recordsPage=1;
async function loadRecords(page=1) {
  try {const result=await api('/api/records?page='+page);recordsPage=page;$('#recordsList').innerHTML=result.data.length?result.data.map(record=>`<article class="channel-card"><div><small>${esc(new Date(record.created_at+'Z').toLocaleString())} · Step ${record.step_number}</small><p class="record-content">${esc(record.message)}</p><small>Run ${esc(record.run_id)}</small></div></article>`).join(''):'<p>No saved records yet. Add a Save to database step and run your flow.</p>';$('#recordsPrevious').disabled=page<=1;$('#recordsNext').disabled=page>=result.last_page;}catch(error){toast(error.message);}
}
$('#recordsPrevious').onclick=()=>loadRecords(recordsPage-1);
$('#recordsNext').onclick=()=>loadRecords(recordsPage+1);
$('#refreshRecords').onclick=()=>loadRecords();
$('#newChannelBtn').onclick=()=>openChannel();
$('#cancelChannel').onclick=()=>$('#channelForm').classList.add('hidden');
$('#channelProvider').onchange=()=>{$('#channelDestination').value='';channelFields();};
$('#channelForm').onsubmit=async event=>{
  event.preventDefault();$('#saveChannel').disabled=true;
  try {
    const channel=await api(editingChannel?'/api/channels/'+editingChannel:'/api/channels',{method:editingChannel?'PUT':'POST',body:JSON.stringify({name:$('#channelName').value.trim(),provider:$('#channelProvider').value,destination:$('#channelDestination').value.trim()})});
    channels=channels.filter(item=>item.id!==channel.id);channels.push(channel);channels.sort((a,b)=>a.name.localeCompare(b.name));
    $('#channelForm').classList.add('hidden');renderChannels();render();toast('Channel saved');
  }catch(error){$('#channelError').textContent=error.message;$('#channelError').classList.remove('hidden');}finally{$('#saveChannel').disabled=false;}
};
async function boot(){
  try{
    editorConfiguration=await api('/api/editor-configuration');
    configureStepTypes(editorConfiguration.step_types);
    configureNotificationProviders(editorConfiguration.notification_providers);
    icons=Object.fromEntries(Object.entries(stepTypes).map(([key,value])=>[key,value.icon]));
    labels=Object.fromEntries(Object.entries(stepTypes).map(([key,value])=>[key,value.label.toUpperCase()]));
    channelIcons=Object.fromEntries(Object.entries(editorConfiguration.channels).map(([key,value])=>[key,value.icon]));
    triggerLabels=editorConfiguration.triggers;
    $('#interval').innerHTML=editorConfiguration.intervals.map(value=>`<option>${esc(value)}</option>`).join('');
    $('#notifyChannel').innerHTML=Object.entries(editorConfiguration.channels).map(([key,value])=>`<option value="${esc(key)}">${esc(value.label)}</option>`).join('');
    $('#notifyTrigger').innerHTML=Object.entries(triggerLabels).map(([key,value])=>`<option value="${esc(key)}">${esc(value)}</option>`).join('');
$('#stepChoices').innerHTML=stepChoices();
document.querySelectorAll('[data-step-type]').forEach(button=>button.onclick=()=>{
  const type=button.dataset.stepType;
  active().steps.push({type,text:stepTypes[type].text});
  save();render();
  const last=$('#steps').lastElementChild;
  last.querySelector('input')?.focus();
  last.scrollIntoView({block:'nearest'});
});

    channels=await api('/api/channels');
    renderChannels();
    flows=await api('/api/workflows');
    activeId=flows[0]?.id??null;render();
  }catch(e){$('#runBtn').disabled=true;toast(`Could not load database settings: ${e.message}`)}
}
boot();
