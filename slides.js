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
// All statistics come from saved attempts; opening a slide makes no API calls.
const timings=LESSON_TIMINGS;
const seconds=value=>Number.isFinite(value)?(value/1000).toFixed(2)+' s':'Not supplied';
const fixed=(value,digits=0)=>Number.isFinite(value)?value.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'Not supplied';
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
const modelInfo=id=>timings.models.find(m=>m.model===id);
function metricRow(group,label,subtitle){
  const tr=node('tr'),name=node('th',label);name.scope='row';if(subtitle)name.append(node('span',subtitle,'timing-sample'));tr.append(name);
  if(!group){const cell=node('td','Not measured in this recording','benchmark-missing');cell.colSpan=7;tr.append(cell);return tr;}
  const accuracy=node('td',`${group.correct}/${group.attempts}`,group.correct<group.attempts?'metric-problem':'');accuracy.append(node('span',fixed(100*group.correct/group.attempts)+'%','timing-sample'));tr.append(accuracy,node('td',String(group.errors),group.errors?'metric-problem':''));
  const median=node('td',group.timed?fixed(group.median_ms):'No valid reply','benchmark-median');tr.append(median,node('td',fixed(group.mean_ms)),node('td',`${fixed(group.min_ms)} to ${fixed(group.max_ms)}`));
  const tokens=node('td',`${fixed(group.mean_input_tokens,1)} / ${fixed(group.mean_output_tokens,1)}`);tokens.title=`Reported on ${group.input_tokens_reported}/${group.successful} input and ${group.output_tokens_reported}/${group.successful} output records.`;tr.append(tokens);
  const cost=node('td',Number.isFinite(group.mean_cost_usd)?'$'+fixed(group.mean_cost_usd*1000,4):'Not supplied');cost.title=`Mean reported cost per call: ${group.mean_cost_usd===null?'not supplied':'$'+group.mean_cost_usd}; ${group.cost_usd_reported}/${group.successful} records.`;tr.append(cost);
  return tr;
}
function groupFor(batch,model,kind,width,questions){return timings.groups.find(g=>g.batch===batch&&g.model===model&&g.input_kind===kind&&(kind==='structured'||g.width===width)&&g.questions===questions);}
function renderModels(kind){
  const prefix=kind==='image'?'image':'json',batch=byId(prefix+'-run').value,questions=Number(byId(prefix+'-questions').value),width=kind==='image'?Number(byId('image-width').value):null;
  const rows=byId('benchmark-'+prefix+'-rows');rows.replaceChildren();let selected=[];
  for(const info of timings.models){if(kind==='image'&&info.model==='typesafe/jev-1.13')continue;const g=groupFor(batch,info.model,kind,width,questions);if(g)selected.push(g);rows.append(metricRow(g,info.label,batch+' · '+info.api));}
  const attempts=selected.reduce((n,g)=>n+g.attempts,0),correct=selected.reduce((n,g)=>n+g.correct,0),errors=selected.reduce((n,g)=>n+g.errors,0);
  byId(prefix+'-reading').textContent=attempts?`${correct}/${attempts} lane choices correct · ${errors} errors · ${selected.length} measured models in this view. Timing and usage statistics use successful calls.`:'This combination was not measured in this recording. Run D covers every supported setting.';
}
for(const prefix of ['image','json']){byId(prefix+'-run').value=timings.primary_batch;for(const suffix of ['run','questions'])byId(prefix+'-'+suffix).addEventListener('change',()=>renderModels(prefix==='image'?'image':'structured'));}
byId('image-width').addEventListener('change',()=>renderModels('image'));
for(const info of timings.models){const option=node('option',info.label);option.value=info.model;byId('variant-model').append(option);}
function renderVariants(){
  const model=byId('variant-model').value,kindValue=byId('variant-input').value;
  const sizeRows=byId('benchmark-size-rows'),questionRows=byId('benchmark-question-rows');sizeRows.replaceChildren();questionRows.replaceChildren();
  if(model==='typesafe/jev-1.13'){const row=node('tr'),cell=node('td','Jev accepts JSON, so there is no image-size comparison.','benchmark-missing');cell.colSpan=8;row.append(cell);sizeRows.append(row);byId('variant-input').value='structured';}
  else for(const width of [210,420,840])sizeRows.append(metricRow(groupFor('D',model,'image',width,1),`${width} × ${width*480/420}`));
  const kind=byId('variant-input').value==='structured'?'structured':'image',width=kind==='image'?Number(byId('variant-input').value):null;
  for(const count of [1,2,3])questionRows.append(metricRow(groupFor('D',model,kind,width,count),`${count} question${count>1?'s':''}`));
  byId('question-reading').textContent='Compare the whole request, not time per question. More questions may increase tokens and cost without a steady increase in latency.';
}
byId('variant-model').addEventListener('change',renderVariants);byId('variant-input').addEventListener('change',renderVariants);
const maxLatency=Math.max(...[...timings.matched_image,...timings.matched_structured].map(g=>g.median_ms).filter(Number.isFinite));
function renderBars(kind,id){
  for(const info of timings.models){const g=timings['matched_'+kind].find(g=>g.model===info.model);if(!g)continue;
    const row=node('div',undefined,'latency-row'),heading=node('div',undefined,'latency-row-heading');heading.append(node('span',info.label),node('strong',seconds(g.median_ms)));
    const track=node('div',undefined,'latency-track'),bar=node('div',undefined,'latency-bar'+(info.model==='openai/gpt-6-luna-decisions'?' luna':''));bar.style.width=Number.isFinite(g.median_ms)?`${g.median_ms/maxLatency*100}%`:'0';track.append(bar);track.setAttribute('aria-hidden','true');row.append(heading,track);byId(id).append(row);
  }
  const ranked=timings['matched_'+kind].filter(g=>Number.isFinite(g.median_ms)).sort((a,b)=>a.median_ms-b.median_ms);
  byId(kind==='image'?'image-ratios':'json-ratios').textContent=ranked.length?`Lowest recorded median: ${modelInfo(ranked[0].model).label}, ${seconds(ranked[0].median_ms)}.`:'No completed measurements.';
}
renderBars('image','timing-image-bars');renderBars('structured','timing-json-bars');
const primary=timings.groups.filter(g=>g.batch===timings.primary_batch),attempts=primary.reduce((n,g)=>n+g.attempts,0),correct=primary.reduce((n,g)=>n+g.correct,0);
byId('timing-correct').textContent=`${correct} / ${attempts} correct`;
byId('timing-coverage').textContent=`Across ${primary.length} settings in run ${timings.primary_batch}. ${primary.reduce((n,g)=>n+g.errors,0)} request errors and ${attempts-correct-primary.reduce((n,g)=>n+g.errors,0)} wrong lane choices. All ${timings.attempts} attempts across the four recordings are available in the exports.`;
function downloadData(name,text,type){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Download prepared: '+name);}
function toCSV(rows){const fields=[...new Set(rows.flatMap(Object.keys))],escape=value=>value===null||value===undefined?'':`"${String(value).replaceAll('"','""')}"`;return [fields.map(escape).join(','),...rows.map(row=>fields.map(key=>escape(row[key])).join(','))].join('\r\n');}
document.querySelectorAll('[data-timing-export]').forEach(button=>button.addEventListener('click',()=>{const view=button.dataset.timingExport;if(view==='json')downloadData('pocket-pilot-all-measurements.json',pretty(timings),'application/json');else downloadData(`pocket-pilot-${view}.csv`,toCSV(timings[view]),'text/csv;charset=utf-8');}));
renderModels('image');renderModels('structured');renderVariants();
requestTab(requestView);responseTab(responseView);showSlide((parseInt(location.hash.slice(1),10)||1)-1,false);
