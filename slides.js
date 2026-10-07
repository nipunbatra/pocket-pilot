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
  byId('request-view-note').textContent=name==='envelope'?'Input excerpt; the Questions tab shows the other top-level field.':name==='questions'?'Exact question definitions, including the full instructions and criteria.':'Complete request structure; only the image bytes are abbreviated.';
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
requestTab(requestView);responseTab(responseView);showSlide((parseInt(location.hash.slice(1),10)||1)-1,false);
