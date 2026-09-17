import {notificationProviders,parseNotification,formatNotification,notificationTitle} from './step-notification.js';
import {parseWait} from './step-wait.js';
import {moveStep, copyStep, bindStepDragging} from './step-reorder.js';
import {stepTypes, parseScroll, parseStep, parseConditional, formatConditional, defaultConditional} from './step-types.js';
const icons = { navigate: "↗", click: "⌁", check: "✓", enter: "Aa", wait: "◷", review: "◉", instruction:"≡", condition:"⑂", scroll:"↕", notify:"✉" };
const labels = { navigate: "OPEN PAGE", click: "CLICK ELEMENT", check: "VERIFY PAGE", enter: "ENTER INFORMATION", wait: "WAIT", review: "HUMAN REVIEW", instruction:"JUST INSTRUCTION", condition:"IF / ELSE", scroll:"SCROLL", notify:"SEND NOTIFICATION" };
const channelIcons = { email:"@", slack:"#", whatsapp:"◉", webhook:"↗" };
const triggerLabels = { failure:"On failure", availability:"Availability found", complete:"Flow complete", step:"After step" };
const starter = {
  id: crypto.randomUUID(), name: "Düsseldorf driving licence", status: "Draft",
  url: "https://termine.duesseldorf.de/select2?md=3", interval: "Every 5 minutes", pause: true,
  notifications: [], steps: [
    {type:"navigate", text:"Go to the Düsseldorf appointment page"},
    {type:"click", text:"Choose the required driving licence service"},
    {type:"check", text:"Check that the selected concern appears in the summary"},
    {type:"click", text:"Continue and choose an available location"},
    {type:"wait", text:"If no appointment is available, stop and retry later"},
    {type:"review", text:"Pause for review before entering personal data or booking"}
  ]
};
let flows = [];
let activeId = null;
let runTimer;
const $ = s => document.querySelector(s);
const active = () => flows.find(f=>f.id===activeId);
const csrf = document.querySelector('meta[name="csrf-token"]').content;
async function api(path, options={}) {
  const response=await fetch(path,{...options,headers:{'Accept':'application/json','Content-Type':'application/json','X-CSRF-TOKEN':csrf,...options.headers}});
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

function notificationEditor(step,index) {
  const value=parseNotification(step.text);
  if(!value) return `<input class="step-instruction" value="${esc(step.text)}" aria-label="Step ${index+1}"><small class="condition-help">Choose Send notification from Add another step to configure a provider.</small>`;
  const meta=notificationProviders[value.provider];
  return `<div class="notification-step-editor"><label>Provider<select data-notification-field="provider" aria-label="Step ${index+1} provider">${Object.entries(notificationProviders).map(([provider,item])=>`<option value="${provider}" ${provider===value.provider?'selected':''}>${item.label}</option>`).join('')}</select></label><label>${meta.destination}<input data-notification-field="destination" value="${esc(value.destination)}" placeholder="${esc(meta.placeholder)}" aria-label="Step ${index+1} destination" autocomplete="off"></label><label>Message<textarea data-notification-field="message" maxlength="1600" rows="3" aria-label="Step ${index+1} message">${esc(value.message)}</textarea></label><small class="condition-help">${meta.help}</small><small class="condition-help">Test runs preview this message unless you enable delivery beside Test run.</small></div>`;
}
function updateNotificationStep(event) {
  const step=active().steps[+event.target.closest('.step').dataset.index];
  const value=parseNotification(step.text);
  const field=event.target.dataset.notificationField;
  value[field]=event.target.value;
  if(field==='provider') value.destination='';
  step.text=formatNotification(value);save();
  if(field==='provider') render();
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
  const card=event.target.closest('.step');
  const distance=card.querySelector('[data-scroll-field="distance"]');
  if(!distance.checkValidity() || !distance.value) {distance.reportValidity();return;}
  active().steps[+card.dataset.index].text=`Scroll ${card.querySelector('[data-scroll-field="direction"]').value} ${distance.value} pixels`;
  save();
}
function conditionalEditor(step, index) {
  const value=parseConditional(step.text);
  if(!value) return `<input class="step-instruction" value="${esc(step.text)}" aria-label="Step ${index+1}"><small class="condition-help">Use: If "Text" is visible then click: "Click label" else review: "Pause"</small>`;
  const options=selected=>Object.entries(stepTypes).filter(([type])=>type!=='condition').map(([type,meta])=>`<option value="${type}" ${type===selected?'selected':''}>${meta.label}</option>`).join('');
  return `<div class="condition-editor"><label>If this text is visible<input data-condition-field="condition" value="${esc(value.condition)}" aria-label="Step ${index+1} condition"></label>${['then','else'].map(branch=>`<div class="condition-branch"><span>${branch==='then'?'THEN':'ELSE'}</span><select data-condition-field="${branch}.type" aria-label="Step ${index+1} ${branch} action">${options(value[branch].type)}</select><input data-condition-field="${branch}.text" value="${esc(value[branch].text)}" aria-label="Step ${index+1} ${branch} instruction"></div>`).join('')}</div>`;
}
function updateConditional(event) {
  const step=active().steps[+event.target.closest('.step').dataset.index];
  const value=parseConditional(step.text)||defaultConditional();
  const [branch,field]=event.target.dataset.conditionField.split('.');
  if(field) value[branch][field]=event.target.value;
  else value.condition=event.target.value;
  step.text=formatConditional(value);save();
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
function render(){
  const flow=active();
  closeStepPicker();
  flow.notifications ||= [];
  $("#flowList").innerHTML=flows.map(f=>`<button class="flow-item ${f.id===activeId?'active':''}" data-id="${f.id}"><i></i><span>${esc(f.name)}<small>${f.steps.length} steps · ${f.status}</small></span></button>`).join("");
  $("#flowName").value=flow.name; $("#startUrl").value=flow.url; $("#interval").value=flow.interval;
  $("#flowMeta").textContent=`${flow.steps.length} steps · Saved in database`;
  $("#steps").innerHTML=flow.steps.map((s,i)=>`<div class="step" data-index="${i}"><button class="step-number step-drag" aria-label="Move step ${i+1}" aria-describedby="reorderHelp" title="Drag to move · Arrow keys to reorder"><span class="drag-grip" aria-hidden="true">⠿</span><span>${String(i+1).padStart(2,'0')}</span></button><div class="step-card"><div class="step-icon">${icons[s.type]||'•'}</div><div class="step-copy"><strong>${labels[s.type]||'ACTION'}</strong>${s.type==='notify'?notificationEditor(s,i):s.type==='condition'?conditionalEditor(s,i):s.type==='scroll'?scrollEditor(s,i):s.type==='wait'?waitEditor(s,i):`<input class="step-instruction" value="${esc(s.text)}" aria-label="Step ${i+1}">`}</div></div><div class="step-actions"><button class="step-duplicate" title="Copy step" aria-label="Copy step ${i+1}">Copy</button><button class="step-menu" title="Remove step" aria-label="Remove step ${i+1}">×</button></div></div>`).join("");
  $("#flowText").value=flow.steps.map((s,i)=>`${i+1}. ${s.text}`).join("\n");
  $("#pauseToggle").classList.toggle("on",flow.pause);
  $("#notificationList").innerHTML=flow.notifications.length?flow.notifications.map((n,i)=>`<div class="notification-item"><span class="channel-icon">${channelIcons[n.channel]}</span><span><strong>${esc(n.channel)} · ${triggerLabels[n.trigger]}</strong><small>${esc(n.destination)}</small></span><button data-notify-index="${i}" aria-label="Remove notification">×</button></div>`).join(''):`<div class="notification-empty">No alerts yet. Add one for failures, availability, or a specific step.</div>`;
  const score=Math.min(100,55+flow.steps.length*6+(flow.url.startsWith('http')?7:0)); $("#score").textContent=score;
  $("#readinessText").textContent=flow.steps.length&&flow.url?"All steps look valid.":"Add a URL and at least one step.";
  document.querySelectorAll('.flow-item').forEach(b=>b.onclick=()=>{activeId=+b.dataset.id;render()});
  document.querySelectorAll('.step-instruction').forEach(input=>input.oninput=e=>{active().steps[+e.target.closest('.step').dataset.index].text=e.target.value;save()});
  bindStepDragging($('#steps'),reorderStep);
  document.querySelectorAll('[data-notification-field]').forEach(input=>input.oninput=updateNotificationStep);
  document.querySelectorAll('[data-wait-duration]').forEach(input=>input.oninput=()=>{
    if(!input.value || !input.checkValidity()) return;
    active().steps[+input.closest('.step').dataset.index].text=`Wait ${input.value} seconds`;save();
  });
  document.querySelectorAll('[data-scroll-field]').forEach(input=>input.oninput=updateScroll);
  document.querySelectorAll('[data-condition-field]').forEach(input=>input.oninput=updateConditional);
  document.querySelectorAll('.step-duplicate').forEach(button=>button.onclick=()=>{
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

async function newFlow(){try{const f=await api('/api/workflows',{method:'POST',body:JSON.stringify({name:"Untitled booking flow",status:"Draft",url:"",interval:"Manual only",pause:true,notifications:[],steps:[]})});flows.unshift(f);activeId=f.id;render();toast('New flow created')}catch(e){toast(e.message)}}
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
  $("#notifyChannel").value='email'; $("#notifyTrigger").value='failure'; $("#notifyDestination").value='';
  $("#notifyMessage").value='Appointment update for {{flow_name}}: {{status}}';
  updateNotifyFields(); $("#notifyModal").classList.remove('hidden');
}
function updateNotifyFields(){
  const channel=$("#notifyChannel").value;
  const configs={email:['Email address','you@example.com'],slack:['Slack webhook URL','https://hooks.slack.com/services/…'],whatsapp:['WhatsApp number','+49 123 456789'],webhook:['Webhook URL','https://example.com/hooks/…']};
  $("#destinationLabel").textContent=configs[channel][0]; $("#notifyDestination").placeholder=configs[channel][1];
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
$('#stepChoices').innerHTML=Object.entries(stepTypes).map(([type,meta])=>`<button class="step-choice" data-step-type="${type}"><span class="step-icon" aria-hidden="true">${meta.icon}</span><span><strong>${meta.label}</strong><small>${meta.description}</small></span></button>`).join('');
$('#addStepBtn').onclick=()=>{
  const opening=$('#stepPicker').classList.contains('hidden');
  $('#stepPicker').classList.toggle('hidden',!opening);
  $('#addStepBtn').setAttribute('aria-expanded',String(opening));
  if(opening) $('#stepChoices button').focus();
};
$('#closeStepPicker').onclick=()=>{closeStepPicker();$('#addStepBtn').focus();};
document.querySelectorAll('[data-step-type]').forEach(button=>button.onclick=()=>{
  const type=button.dataset.stepType;
  active().steps.push({type,text:stepTypes[type].text});
  save();render();
  const last=$('#steps').lastElementChild;
  last.querySelector('input')?.focus();
  last.scrollIntoView({block:'nearest'});
});
$('#stepPicker').onkeydown=event=>{if(event.key==='Escape'){closeStepPicker();$('#addStepBtn').focus();}};
$("#flowName").onchange=e=>{active().name=e.target.value.trim()||'Untitled flow';save();render()};
$("#startUrl").onchange=e=>{active().url=e.target.value.trim();save();render()};
$("#interval").onchange=e=>{active().interval=e.target.value;save()};
$("#pauseToggle").onclick=()=>{active().pause=!active().pause;save();render()};
$("#applyTextBtn").onclick=()=>{const parsed=$("#flowText").value.split('\n').map(parseStep).filter(Boolean);if(!parsed.length){toast('Write at least one instruction');return}active().steps=parsed;save();render();switchMode('visual');toast(`${parsed.length} steps created`)};
document.querySelectorAll('.mode-switch button').forEach(b=>b.onclick=()=>switchMode(b.dataset.mode));
$("#copyBtn").onclick=async()=>{try{const copy=structuredClone(active());delete copy.id;copy.name=`${copy.name} copy`;const created=await api('/api/workflows',{method:'POST',body:JSON.stringify(copy)});flows.unshift(created);activeId=created.id;render();toast('Flow copied')}catch(e){toast(e.message)}};
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
async function boot(){
  try{
    flows=await api('/api/workflows');
    if(!flows.length){const initial=structuredClone(starter);delete initial.id;flows=[await api('/api/workflows',{method:'POST',body:JSON.stringify(initial)})]}
    activeId=flows[0].id;render();
  }catch(e){toast(`Backend error: ${e.message}`)}
}
boot();
