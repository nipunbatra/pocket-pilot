/* Presentation layout: existing game controls retain their IDs and handlers. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),one=s=>document.querySelector(s);
  const el=(tag,cls,content)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(content)n.textContent=content;return n;};
  const button=(text,fn,cls='lab-button')=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
  const shell=one('.race-shell'),header=one('header'),road=one('.road-panel'),inspector=one('.decision-panel'),main=$('main');
  document.body.classList.add('classroom-layout');
  function notify(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.classList.remove('show'),2500);}
  function dialog(title,wide=false){
    const d=el('dialog','lab-dialog'+(wide?' wide':'')),top=el('div','dialog-heading'),h=el('h2','',title);h.id='dialog-'+Math.random().toString(36).slice(2);d.setAttribute('aria-labelledby',h.id);
    top.append(h,button('Close',()=>d.close()));d.append(top);document.body.append(d);
    d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
    return d;
  }
  const compare=dialog('Compare recorded and live decisions',true),historyDialog=dialog('Complete run history',true),help=dialog('How to teach with Pocket Pilot',true);
  compare.id='lab-comparisons';historyDialog.id='lab-history-dialog';help.id='lab-help';
  historyDialog.addEventListener('click',e=>{if(e.target.closest('[data-log]'))historyDialog.close();});
  const intro=one('.race-intro');help.append(intro,one('.how-to'),one('footer'));
  const connection=one('.visitor-connection');
  const modelField=$('model-select').parentElement,questionField=$('question-count').parentElement,modeField=one('.pace-control');
  const inputField=$('input-kind').parentElement,samplingField=$('sampling').parentElement,imageField=$('image-size').parentElement;
  const audio=one('.audio-controls');
  compare.append(one('.chat-comparison'),one('.model-comparison'),one('.question-comparison'));
  const historySection=one('.race-log-section');historySection.id='full-run-history';historyDialog.append(historySection);
  const nav=one('.header-links'),apiStatus=$('api-status');nav.replaceChildren();
  const slides=document.createElement('a');slides.href=connection?'./slides.html':'/slides';slides.textContent='Slides';slides.className='lab-link';
  const present=button('Present',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notify('Full screen is unavailable. The workspace still fits the browser window.');}});present.id='lab-present';
  const demo=button('Recorded demo',()=>$('load-comparison').click());demo.id='lab-recorded-demo';
  nav.append(demo,button('Compare',()=>compare.showModal()),slides,button('Help',()=>help.showModal()),present);
  const controls=el('section','lab-controls');controls.setAttribute('aria-label','All game settings');
  const primary=el('div','control-row primary-settings'),secondary=el('div','control-row secondary-settings');
  primary.append(modelField,inputField,questionField,modeField,one('.speed-control'));
  const connectionField=el('div','connection-field');let privacyNote=null;
  if(connection){
    // Keep the existing credential handlers and IDs; only their placement changes.
    help.append(connection.firstElementChild,connection.querySelector('details'),connection.querySelector('.visitor-key-panel>a'));
    const form=$('key-form'),connected=$('key-connected'),privacy=$('key-privacy');
    help.append(el('p','connection-help',privacy.textContent));
    privacy.textContent='Tab only · sent to OpenRouter · billed to your account.';
    form.querySelector('label').textContent='OpenRouter API key';$('visitor-key').placeholder='Paste your key for live play';
    $('connect-key').textContent='Connect';
    connected.querySelector('strong').textContent='Key connected for this tab';connected.querySelector('p').hidden=true;
    privacyNote=privacy;const remote=el('div');remote.id='remote-key-controls';remote.append(form,connected);connectionField.append(remote);connection.remove();
    apiStatus.className='sr-only';connectionField.append(apiStatus);
  }else{
    connectionField.append(el('span','control-label','Connection'));apiStatus.className='local-connection-state';connectionField.append(apiStatus);
  }
  const local=el('div');local.id='local-model-controls';local.hidden=true;local.innerHTML='<label>Local model · no API key</label><div class="key-entry"><button id="load-local-model" class="primary" type="button">Load model</button><button id="unload-local-model" class="secondary" type="button" disabled>Unload</button></div>';connectionField.append(local);
  const soundField=el('div','sound-field'),soundLabel=el('label','','Sound & volume');soundLabel.htmlFor='volume';soundField.append(soundLabel,audio);
  secondary.append(connectionField,samplingField,imageField,soundField);
  const note=el('div','controls-note');note.append($('model-note'));const localResults=el('a','','Local benchmark ↗');localResults.id='local-results-link';localResults.href='./liquid-local.html';localResults.target='_blank';localResults.rel='noreferrer';localResults.hidden=true;note.append(localResults);if(privacyNote)note.append(privacyNote);
  controls.append(primary,secondary,note);
  header.after(controls);
  one('.race-toolbar').remove();document.querySelectorAll('.sampling-controls').forEach(n=>n.remove());
  // Fit below the measured controls, including inline key errors and wrapped labels.
  function fitWorkspace(){main.style.setProperty('--workspace-offset',Math.ceil(main.getBoundingClientRect().top+window.scrollY)+'px');}
  const sizeObserver=new ResizeObserver(fitWorkspace);sizeObserver.observe(header);sizeObserver.observe(controls);
  window.addEventListener('resize',fitWorkspace);requestAnimationFrame(fitWorkspace);
  const roadDetails=el('details','road-details');roadDetails.append(el('summary','','Timing & sampling'),$('sampling-status'),$('latency-budget'),$('pace-note'));road.append(roadDetails);
  const roadMessage=$('road-message');roadMessage.setAttribute('role','status');
  const roadHeader=road.querySelector('.section-heading');roadHeader.querySelector('h2').textContent='Live road';
  const roadFrame=el('div','road-frame');roadHeader.after(roadFrame);roadFrame.append(one('.canvas-wrap'));
  const requestStatus=one('.request-status');roadMessage.before(requestStatus);
  const facts=el('div','decision-facts');facts.id='decision-facts';inspector.querySelector('.section-heading').after(facts);
  const inspectorHeading=inspector.querySelector('.section-heading'),headingActions=el('div','inspector-heading-actions');headingActions.append($('follow-live'));
  const enlarge=button('Enlarge',()=>{const on=main.classList.toggle('inspector-expanded');enlarge.textContent=on?'Restore layout':'Enlarge';enlarge.setAttribute('aria-pressed',String(on));});enlarge.id='enlarge-inspector';enlarge.setAttribute('aria-pressed','false');headingActions.append(enlarge);inspectorHeading.append(headingActions);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&main.classList.contains('inspector-expanded'))enlarge.click();});
  const scroll=el('div','inspector-scroll');inspector.append(scroll);
  for(const name of ['overview','json','metadata','schema'])scroll.append($('view-'+name));
  const timeline=one('.timeline');timeline.classList.add('inspector-timeline');inspector.append(timeline);
  const history=el('aside','history-panel');history.setAttribute('aria-label','Decision history');history.innerHTML='<div class="section-heading"><h2>History</h2><span id="compact-history-count">0 calls</span></div><p class="history-caption" id="history-caption">Choose a frame to inspect.</p><div id="compact-history" class="compact-history"></div><div class="history-tools"></div>';
  main.append(history);history.querySelector('.history-tools').append(button('Full log',()=>historyDialog.showModal()),button('Export run',()=>$('export-session').click()),button('Open JSON run',()=>$('import-session').click()));
  const originalJSON=el('div','legacy-json');originalJSON.hidden=true;while($('view-json').firstChild)originalJSON.append($('view-json').firstChild);$('view-json').append(originalJSON);
  const jsonSource=el('div','json-source');jsonSource.setAttribute('role','group');jsonSource.setAttribute('aria-label','JSON source');
  const jsonHost=el('div','json-explorer');$('view-json').append(jsonSource,jsonHost);
  let source='request',current=null,selectionToken='',jsonToken='';
  const explorer=JsonExplorer.create(jsonHost,notify);
  for(const [id,label] of [['request','Request'],['response','Response'],['metadata','Metadata + action'],['frame','Full frame']]){const b=button(label,()=>{source=id;renderJSON();},'json-source-button');b.dataset.jsonSource=id;b.setAttribute('aria-pressed',String(id===source));jsonSource.append(b);}
  function renderJSON(){
    if(!current)return;const f=current.frame;
    const data=source==='request'?(f?.wire_request||(RoadChat.isChat(current.request)?RoadChat.build(current.request):current.request)):source==='response'?(f?.raw_response||f?.response||(f?.error?{error:f.error}:undefined)):source==='frame'?f:f?{metadata:f.metadata,application:f.application}:undefined;
    const token=selectionToken+source;explorer.set(data,`frame-${f?.frame_id||'preview'}-${source}.json`,{reset:jsonToken!==token});jsonToken=token;
    jsonSource.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.jsonSource===source)));
  }
  function refreshHistory(frames,selected,following,replay){
    const host=$('compact-history'),prior=host.scrollTop,active=document.activeElement?.dataset?.log;
    host.replaceChildren();$('compact-history-count').textContent=`${frames.length} call${frames.length===1?'':'s'}`;
    $('history-caption').textContent=replay?'Recorded run · controls configure your next live run':following?'Following incoming decisions':'Pinned to history · live road is separate';
    if(!frames.length){const empty=el('div','history-empty');empty.append(el('strong','','Your first decision starts here.'),el('p','','Take one decision, or explore a recorded run without an API key.'),button('Open recorded run',()=>$('load-comparison').click()));host.append(empty);}
    frames.forEach((f,i)=>{const b=button('',()=>{},'history-frame');b.dataset.log=i;b.setAttribute('aria-label',`Inspect decision ${f.frame_id}`);b.setAttribute('aria-pressed',String(i===selected));const top=el('span','history-frame-top'),answer=f.error?'Error':f.response?.answers?.lane?.choice||'Waiting…';top.append(el('b','',`#${String(f.frame_id).padStart(2,'0')}`),el('strong','',answer));const bottom=el('span','history-frame-bottom');bottom.append(el('span','',`${Object.keys(f.request.questions).length}Q · ${f.speed}×`),el('span','',Number.isFinite(RoadQuestions.elapsed(f))?`${Math.round(RoadQuestions.elapsed(f))} ms`:'pending'));b.append(top,bottom,el('span','history-outcome',`${f.request.model.split('/').at(-1)} · ${f.application.status}`));if(f.error||f.application.collision_observed)b.classList.add('has-error');host.append(b);});
    host.scrollTop=following?host.scrollHeight:prior;
    if(active!==undefined)host.querySelector(`[data-log="${active}"]`)?.focus({preventScroll:true});
    history.querySelectorAll('.history-tools button')[1].disabled=!frames.length;
  }
  function refreshSelection(data){
    current=data;const f=data.frame;selectionToken=f?`${f.run_id}:${f.frame_id}`:'preview';
    roadHeader.querySelector('h2').textContent=data.replay?'Recorded scene':'Live road';roadDetails.hidden=data.replay;one('.road-metrics').hidden=data.replay;
    $('selected-label').textContent=f?`Frame ${String(f.frame_id).padStart(2,'0')} · ${data.replay?'Recorded':data.following?'Latest':'Pinned'} · ${f.request.model.split('/').at(-1)}`:'Next frame · not sent';
    const a=f?.response?.answers?.lane;facts.replaceChildren();
    for(const [label,value] of [['Lane choice',f?.error?'Error':a?.choice||'—'],[f?.metadata.source==='local'?'Local compute':'Round trip',Number.isFinite(RoadQuestions.elapsed(f))?`${Math.round(RoadQuestions.elapsed(f))} ms`:'—'],['Questions',String(Object.keys(data.request.questions).length)]]){const item=el('div');item.append(el('span','',label),el('strong','',value));facts.append(item);}
    renderJSON();refreshHistory(data.frames,data.selected,data.following,data.replay);
  }
  $('inspect-chat-history').addEventListener('click',()=>compare.close());
  // Load actions also work from the compact toolbar, then return to the workspace.
  for(const id of ['load-comparison','load-model-benchmark'])$(id).addEventListener('click',()=>compare.close());
  document.addEventListener('fullscreenchange',()=>present.textContent=document.fullscreenElement?'Exit full screen':'Present');
  window.ClassroomUI={refreshSelection,refreshHistory};
})();
