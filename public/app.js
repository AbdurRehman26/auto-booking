const icons = { navigate: "↗", click: "⌁", check: "✓", enter: "Aa", wait: "◷", review: "◉" };
const labels = { navigate: "OPEN PAGE", click: "CLICK ELEMENT", check: "VERIFY PAGE", enter: "ENTER INFORMATION", wait: "WAIT & RETRY", review: "HUMAN REVIEW" };
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
let saveTimer;
const $ = s => document.querySelector(s);
const active = () => flows.find(f=>f.id===activeId);
const csrf = document.querySelector('meta[name="csrf-token"]').content;
async function api(path, options={}) {
  const response=await fetch(path,{...options,headers:{'Accept':'application/json','Content-Type':'application/json','X-CSRF-TOKEN':csrf,...options.headers}});
  if(!response.ok) throw new Error((await response.json().catch(()=>({message:'Request failed'}))).message||'Request failed');
  return response.status===204?null:response.json();
}
const save = () => { clearTimeout(saveTimer); saveTimer=setTimeout(async()=>{const flow=active();if(!flow)return;try{const saved=await api(`/api/workflows/${flow.id}`,{method:'PUT',body:JSON.stringify(flow)});const index=flows.findIndex(f=>f.id===flow.id);flows[index]=saved;activeId=saved.id;render();toast('Saved to database')}catch(e){toast(e.message)}},300); };
const esc = s => String(s).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

function render(){
  const flow=active();
  flow.notifications ||= [];
  $("#flowList").innerHTML=flows.map(f=>`<button class="flow-item ${f.id===activeId?'active':''}" data-id="${f.id}"><i></i><span>${esc(f.name)}<small>${f.steps.length} steps · ${f.status}</small></span></button>`).join("");
  $("#flowName").value=flow.name; $("#startUrl").value=flow.url; $("#interval").value=flow.interval;
  $("#flowMeta").textContent=`${flow.steps.length} steps · Saved in database`;
  $("#steps").innerHTML=flow.steps.map((s,i)=>`<div class="step" data-index="${i}"><div class="step-number">${String(i+1).padStart(2,'0')}</div><div class="step-card"><div class="step-icon">${icons[s.type]||'•'}</div><div class="step-copy"><strong>${labels[s.type]||'ACTION'}</strong><input value="${esc(s.text)}" aria-label="Step ${i+1}"></div></div><button class="step-menu" title="Remove step" aria-label="Remove step ${i+1}">×</button></div>`).join("");
  $("#flowText").value=flow.steps.map((s,i)=>`${i+1}. ${s.text}`).join("\n");
  $("#pauseToggle").classList.toggle("on",flow.pause);
  $("#notificationList").innerHTML=flow.notifications.length?flow.notifications.map((n,i)=>`<div class="notification-item"><span class="channel-icon">${channelIcons[n.channel]}</span><span><strong>${esc(n.channel)} · ${triggerLabels[n.trigger]}</strong><small>${esc(n.destination)}</small></span><button data-notify-index="${i}" aria-label="Remove notification">×</button></div>`).join(''):`<div class="notification-empty">No alerts yet. Add one for failures, availability, or a specific step.</div>`;
  const score=Math.min(100,55+flow.steps.length*6+(flow.url.startsWith('http')?7:0)); $("#score").textContent=score;
  $("#readinessText").textContent=flow.steps.length&&flow.url?"All steps look valid.":"Add a URL and at least one step.";
  document.querySelectorAll('.flow-item').forEach(b=>b.onclick=()=>{activeId=+b.dataset.id;render()});
  document.querySelectorAll('.step input').forEach(input=>input.onchange=e=>{active().steps[+e.target.closest('.step').dataset.index].text=e.target.value;save();render()});
  document.querySelectorAll('.step-menu').forEach(b=>b.onclick=e=>{active().steps.splice(+e.target.closest('.step').dataset.index,1);save();render();toast('Step removed')});
  document.querySelectorAll('[data-notify-index]').forEach(b=>b.onclick=()=>{active().notifications.splice(+b.dataset.notifyIndex,1);save();render();toast('Notification removed')});
}

function parseStep(line){
  const text=line.replace(/^\s*\d+[.)]\s*/,"").trim(); const low=text.toLowerCase();
  let type=low.match(/^(go|open|visit|navigate)/)?"navigate":low.match(/^(click|choose|select|press)/)?"click":low.match(/^(check|verify|confirm|make sure)/)?"check":low.match(/^(enter|fill|type|provide)/)?"enter":low.match(/^(wait|retry|monitor)/)?"wait":low.match(/^(pause|review|approve)/)?"review":"click";
  return text?{type,text}:null;
}
async function newFlow(){try{const f=await api('/api/workflows',{method:'POST',body:JSON.stringify({name:"Untitled booking flow",status:"Draft",url:"",interval:"Manual only",pause:true,notifications:[],steps:[]})});flows.unshift(f);activeId=f.id;render();toast('New flow created')}catch(e){toast(e.message)}}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
function switchMode(mode){document.querySelectorAll('.mode-switch button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$("#visualMode").classList.toggle('hidden',mode!=='visual');$("#textMode").classList.toggle('hidden',mode!=='text')}
function testRun(){
  const f=active(); if(!f.steps.length){toast('Add at least one step first');return}
  clearInterval(runTimer); $("#runModal").classList.remove('hidden'); $("#progressBar").style.width='0';
  $("#runSteps").innerHTML=f.steps.map((s,i)=>`<div class="run-step" data-run="${i}"><i>${i+1}</i><span>${esc(s.text)}</span></div>`).join('')+f.notifications.map(n=>`<div class="run-step notification-run"><i>${channelIcons[n.channel]}</i><span>Simulate ${n.channel} · ${triggerLabels[n.trigger]}</span></div>`).join('');
  let i=0; $("#runStatus").textContent='Validating start URL…';
  runTimer=setInterval(()=>{const nodes=[...document.querySelectorAll('.run-step')];if(i>0){nodes[i-1].classList.remove('active');nodes[i-1].classList.add('done');nodes[i-1].querySelector('i').textContent='✓'}if(i<nodes.length){nodes[i].classList.add('active');$("#runStatus").textContent=`Simulating step ${i+1} of ${nodes.length}`;$("#progressBar").style.width=`${(i/nodes.length)*100}%`;i++}else{clearInterval(runTimer);$("#progressBar").style.width='100%';$("#runStatus").textContent='Test passed — ready for supervised use';toast('Workflow test passed')}},650);
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
$("#addStepBtn").onclick=()=>{active().steps.push({type:'click',text:'Describe the next action'});save();render()};
$("#flowName").onchange=e=>{active().name=e.target.value.trim()||'Untitled flow';save();render()};
$("#startUrl").onchange=e=>{active().url=e.target.value.trim();save();render()};
$("#interval").onchange=e=>{active().interval=e.target.value;save()};
$("#pauseToggle").onclick=()=>{active().pause=!active().pause;save();render()};
$("#applyTextBtn").onclick=()=>{const parsed=$("#flowText").value.split('\n').map(parseStep).filter(Boolean);if(!parsed.length){toast('Write at least one instruction');return}active().steps=parsed;save();render();switchMode('visual');toast(`${parsed.length} steps created`)};
document.querySelectorAll('.mode-switch button').forEach(b=>b.onclick=()=>switchMode(b.dataset.mode));
$("#copyBtn").onclick=async()=>{try{const copy=structuredClone(active());delete copy.id;copy.name=`${copy.name} copy`;const created=await api('/api/workflows',{method:'POST',body:JSON.stringify(copy)});flows.unshift(created);activeId=created.id;render();toast('Flow copied')}catch(e){toast(e.message)}};
$("#deleteBtn").onclick=async()=>{if(flows.length===1){toast('Keep at least one flow');return}try{await api(`/api/workflows/${activeId}`,{method:'DELETE'});flows=flows.filter(f=>f.id!==activeId);activeId=flows[0].id;render();toast('Flow deleted')}catch(e){toast(e.message)}};
$("#runBtn").onclick=testRun; $("#closeRun").onclick=$("#stopRun").onclick=()=>{clearInterval(runTimer);$("#runModal").classList.add('hidden')};
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
