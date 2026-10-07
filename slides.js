'use strict';
const slides=[...document.querySelectorAll('.slide')],byId=id=>document.getElementById(id),sample=LESSON_DATA;
let index=0,requestView='envelope',responseView='lane';
const shortImages=value=>JSON.parse(JSON.stringify(value,(key,v)=>typeof v==='string'&&v.startsWith('data:image/')?'data:image/png;base64,… [image bytes shortened for display]':v));
const pretty=value=>JSON.stringify(value,null,2);
const image=sample.request.state.find(part=>part.type==='image_url').image_url.url;
document.querySelectorAll('.recorded-frame').forEach(img=>img.src=image);
byId('slide-picker').innerHTML=slides.map((s,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')} · ${s.dataset.title}</option>`).join('');
function showSlide(n,updateHash=true){
  index=Math.max(0,Math.min(slides.length-1,n));slides.forEach((s,i)=>{s.hidden=i!==index;});
  byId('slide-picker').value=index;byId('slide-count').textContent=`${index+1} / ${slides.length}`;
  byId('previous-slide').disabled=index===0;byId('next-slide').disabled=index===slides.length-1;
  byId('deck-progress').style.width=`${100*(index+1)/slides.length}%`;
  document.title=`${index+1}. ${slides[index].dataset.title} · Pocket Pilot`;
  if(updateHash)history.replaceState(null,'',`#${index+1}`);window.scrollTo(0,0);
}
function requestTab(name){
  requestView=name;document.querySelectorAll('[data-request]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.request===name));b.tabIndex=b.dataset.request===name?0:-1;});
  const data=name==='envelope'?{model:sample.request.model,state:sample.request.state}:name==='questions'?{questions:sample.request.questions}:sample.request;
  byId('request-json').textContent=pretty(shortImages(data));
  byId('request-view-note').textContent=name==='envelope'?'This tab shows the input. Open Questions to see exactly what we asked.':name==='questions'?'These are the instructions and answer choices we sent.':'This is the whole request. Only the image bytes are shortened.';
}
function responseTab(name){
  responseView=name;document.querySelectorAll('[data-response]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.response===name));b.tabIndex=b.dataset.response===name?0:-1;});
  byId('response-json').textContent=pretty(name==='full'?sample.response:{[name]:sample.response.answers[name]});
}
function toggleNotes(){const on=document.body.classList.toggle('show-notes');byId('notes-toggle').setAttribute('aria-pressed',String(on));}
let toastTimer;function toast(message){byId('deck-toast').textContent=message;byId('deck-toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>byId('deck-toast').classList.remove('show'),3500);}
byId('previous-slide').addEventListener('click',()=>showSlide(index-1));byId('next-slide').addEventListener('click',()=>showSlide(index+1));
byId('slide-picker').addEventListener('change',e=>showSlide(Number(e.target.value)));byId('notes-toggle').addEventListener('click',toggleNotes);
byId('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Full screen is unavailable here. You can still present with the arrow keys.');}});
document.addEventListener('click',e=>{const req=e.target.closest('[data-request]'),res=e.target.closest('[data-response]');if(req)requestTab(req.dataset.request);if(res)responseTab(res.dataset.response);});
document.querySelectorAll('.code-tabs').forEach(group=>group.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const tabs=[...group.querySelectorAll('button')];let i=tabs.indexOf(document.activeElement);i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;const b=tabs[i];if(b.dataset.request)requestTab(b.dataset.request);else responseTab(b.dataset.response);b.focus();}));
document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)||(e.key===' '&&['BUTTON','A'].includes(document.activeElement.tagName)))return;if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();showSlide(index+1);}else if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();showSlide(index-1);}else if(e.key==='Home'){e.preventDefault();showSlide(0);}else if(e.key==='End'){e.preventDefault();showSlide(slides.length-1);}else if(e.key.toLowerCase()==='n')toggleNotes();});
window.addEventListener('hashchange',()=>showSlide(Math.max(0,(parseInt(location.hash.slice(1),10)||1)-1),false));
byId('download-request').addEventListener('click',()=>{
  const a=document.createElement('a');a.download='pocket-pilot-actual-request.json';
  if(['http:','https:'].includes(location.protocol)&&location.pathname==='/slides')a.href='/lesson-request.json';
  else{a.href=URL.createObjectURL(new Blob([pretty(sample.request)],{type:'application/json'}));setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  a.click();
});
byId('answer-lane').textContent=sample.response.answers.lane.choice;
byId('answer-noul').textContent=sample.response.answers.middle_blocked.noul;
byId('answer-score').textContent=sample.response.answers.proximity.score;
byId('recorded-latency').textContent=(sample.metadata.upstream_round_trip_ms/1000).toFixed(3)+' s';
byId('recorded-tokens').textContent=sample.response.usage.input_tokens.toLocaleString();
byId('recorded-cost').textContent='$'+sample.response.usage.cost.toFixed(7);
// The builder derives these values from recorded calls. Slides make no API calls.
const timings=LESSON_TIMINGS;
const seconds=value=>Number.isFinite(value)?(value/1000).toFixed(2)+' s':'Not available';
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
for(const row of timings.latest){
  const tr=node('tr'),name=node('th',row.label);name.scope='row';name.append(node('span',row.api,'timing-api'));tr.append(name);
  for(const kind of ['image','structured']){
    const cell=node('td'),result=row[kind];
    if(result){cell.append(node('strong',seconds(result.median_ms)),node('span',`${result.attempts} calls · ${result.batch}`,'timing-sample'));}
    else cell.append(node('span',kind==='image'&&row.model==='typesafe/jev-1.13'?'JSON only':'Not measured','timing-missing'));
    tr.append(cell);
  }
  byId('timing-model-rows').append(tr);
}
byId('timing-correct').textContent=`${timings.correct} / ${timings.attempts}`;
const earlier=timings.groups.filter(g=>g.batch==='A'&&g.model==='openai/gpt-6-luna-decisions');
byId('timing-earlier-note').textContent='Earlier Luna medians: '+earlier.map(g=>`${g.input_kind==='structured'?'JSON':g.width+'px image'} ${seconds(g.median_ms)} (${g.attempts} calls)`).join('; ')+'. The smaller-image follow-up ran later, so it does not isolate the effect of resolution.';
const maxLatency=Math.max(...timings.matched_image.map(g=>g.median_ms));
for(const result of timings.matched_image){
  const label=timings.latest.find(row=>row.model===result.model).label;
  const row=node('div',undefined,'latency-row'),heading=node('div',undefined,'latency-row-heading');
  heading.append(node('span',label),node('strong',seconds(result.median_ms)));
  const track=node('div',undefined,'latency-track'),bar=node('div',undefined,'latency-bar'+(result.model==='openai/gpt-6-luna-decisions'?' luna':''));
  bar.style.width=`${result.median_ms/maxLatency*100}%`;track.append(bar);track.setAttribute('aria-hidden','true');row.append(heading,track);byId('timing-bars').append(row);
}
const mini=timings.matched_image.find(g=>g.model==='openai/gpt-4.1-mini'),full=timings.matched_image.find(g=>g.model==='openai/gpt-4.1');
byId('timing-speedup').textContent=mini.relative_to_luna.toFixed(1)+'×';
byId('timing-ratios').textContent=`GPT-4.1 took ${full.relative_to_luna.toFixed(1)}× as long. Both ratios use the medians from this same test.`;
requestTab(requestView);responseTab(responseView);showSlide((parseInt(location.hash.slice(1),10)||1)-1,false);
