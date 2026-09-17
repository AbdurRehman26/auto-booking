export function copyStep(flow, index) {
  if(!Number.isInteger(index) || !flow.steps[index]) return false;
  const copy=structuredClone(flow.steps[index]);
  delete copy.id;
  flow.steps.splice(index+1,0,copy);
  for(const notification of flow.notifications || []) {
    if(notification.trigger==='step' && Number.isInteger(notification.step) && notification.step>index) notification.step++;
  }
  return true;
}

export function moveStep(flow, from, to) {
  if(from===to || from<0 || to<0 || from>=flow.steps.length || to>=flow.steps.length) return false;
  const order=flow.steps.map((_,index)=>index);
  order.splice(to,0,order.splice(from,1)[0]);
  flow.steps=order.map(index=>flow.steps[index]);
  for(const notification of flow.notifications || []) {
    if(notification.trigger==='step' && Number.isInteger(notification.step)) notification.step=order.indexOf(notification.step);
  }
  return true;
}

export function bindStepDragging(list, commit) {
  for(const handle of list.querySelectorAll('.step-drag')) {
    handle.onkeydown=event=>{
      if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const from=Number(handle.closest('.step').dataset.index);
      const to=event.key==='Home'?0:event.key==='End'?list.children.length-1:from+(event.key==='ArrowUp'?-1:1);
      if(to>=0 && to<list.children.length) commit(from,to);
    };
    handle.onpointerdown=event=>{
      if(event.button!==0 || list.children.length<2) return;
      event.preventDefault();
      handle.focus();
      const row=handle.closest('.step');
      const from=Number(row.dataset.index), startY=event.clientY;
      let dragging=false, y=event.clientY, frame;
      handle.setPointerCapture(event.pointerId);
      const reposition=()=>{
        const others=[...list.children].filter(child=>child!==row);
        const target=others.find(child=>{const rect=child.getBoundingClientRect();return y<rect.top+rect.height/2;});
        if(row.nextElementSibling!==(target||null)) {
          list.insertBefore(row,target||null);
          handle.setPointerCapture(event.pointerId);
        }
      };
      const scroll=()=>{
        const edge=70;
        if(y<edge) window.scrollBy(0,-12);
        else if(y>window.innerHeight-edge) window.scrollBy(0,12);
        reposition();
        frame=requestAnimationFrame(scroll);
      };
      handle.onpointermove=move=>{
        y=move.clientY;
        if(!dragging && Math.abs(y-startY)<5) return;
        if(!dragging) {
          dragging=true;row.classList.add('dragging');document.body.classList.add('reordering');
          frame=requestAnimationFrame(scroll);
        }
        reposition();
      };
      const end=cancelled=>{
        cancelAnimationFrame(frame);
        handle.onpointermove=null;handle.onpointerup=null;handle.onpointercancel=null;handle.onlostpointercapture=null;
        row.classList.remove('dragging');document.body.classList.remove('reordering');
        if(handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        const to=[...list.children].indexOf(row);
        if(cancelled) {
          [...list.children].sort((a,b)=>Number(a.dataset.index)-Number(b.dataset.index)).forEach(child=>list.append(child));
        } else if(dragging) commit(from,to);
      };
      handle.onpointerup=()=>end(false);
      handle.onpointercancel=()=>end(true);
      handle.onlostpointercapture=()=>end(true);
    };
  }
}
