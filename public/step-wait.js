export function parseWait(text) {
  if(/^wait(?:\s+for)?\s+(?:a\s+)?few\s+seconds[.!]?$/i.test(text.trim())) return 3;
  const match=text.trim().match(/^wait(?:\s+for)?\s+(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)[.!]?$/i);
  if(!match) return null;
  const seconds=Number(match[1]);
  return seconds>=0.1 && seconds<=30 ? seconds : null;
}

export async function executeWait(text,{assertRunning=()=>{},onTick=()=>{},now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
  const seconds=parseWait(text);
  if(seconds===null) throw new Error('Specify a wait from 0.1 to 30 seconds, for example “Wait 5 seconds”.');
  const end=now()+seconds*1000;
  let lastTick;
  while(now()<end) {
    assertRunning();
    const remaining=Math.ceil((end-now())/1000);
    if(remaining!==lastTick) {onTick(remaining);lastTick=remaining;}
    await sleep(Math.min(100,Math.max(0,end-now())));
  }
  assertRunning();
  return `Waited ${seconds} ${seconds===1?'second':'seconds'}.`;
}
