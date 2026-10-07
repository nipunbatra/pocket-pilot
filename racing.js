'use strict';
const PUBLIC_SITE=typeof PublicDecisions!=='undefined';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty=v=>JSON.stringify(v,null,2), pct=v=>Number.isFinite(v)?`${Math.round(v*100)}%`:'—';
const ms=v=>Number.isFinite(v)?`${Math.round(v)} ms`:'—';
const time=v=>new Date(v).toLocaleTimeString([],{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
const canvas=$('road');
const inputCanvas=document.createElement('canvas');
inputCanvas.width=420;inputCanvas.height=480;
let sampling='adaptive',questionCount=1,comparing=false,selectedModel='openai/gpt-6-luna-decisions',inputKind='image';
function captureImage(){RoadView.draw(inputCanvas,game);return inputCanvas.toDataURL('image/png');}
let game=RoadEngine.create(),driveMode='paced',lastHud=0;
function syncGame(){lane=game.lane;row=game.row;distance=game.distance;passed=game.passed;crashed=game.crashed;elapsed=game.simulationMs;}
let config, speed=1, running=false, inFlight=false, crashed=false, epoch=0, passed=0, lane=1;
let row={id:0,y:35,blocked:[1,2]}, lastTick=performance.now(), distance=0, requestStarted=0, nextCall=0;
let frames=[],selected=-1,following=true,replay=false,runId=newRunId(), activeRequest=null;
let events=[], elapsed=0,previousRun=null;
function runData(){return {format:'pocket-pilot-road-v2',run_id:runId,model:selectedModel,input_kind:inputKind,exported_at:new Date().toISOString(),events,frames};}
const MAX_CALLS=30;
function newRunId(){return 'road-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+Math.random().toString(36).slice(2,7);}
function modelInfo(){return config?.road_models?.find(m=>m.id===selectedModel);}
function modelAvailable(){return !!modelInfo()?.available&&(!PUBLIC_SITE||PublicDecisions.connected);}
function recentLatency(){
  const samples=frames.filter(f=>f.request.model===selectedModel&&(f.input_kind||'image')===inputKind&&RoadQuestions.count(f)===questionCount&&(inputKind==='structured'||f.image_width===inputCanvas.width)&&Number.isFinite(f.metadata?.browser_round_trip_ms)).slice(-5);
  return samples.length?Math.max(...samples.map(f=>f.metadata.browser_round_trip_ms)):null;
}
function syncModelControls(){
  const info=modelInfo();
  if(info&&!info.vision)inputKind='structured';
  $('input-kind').value=inputKind;$('input-kind').disabled=!info?.vision||inFlight||comparing||running;
  $('image-size').disabled=inputKind==='structured'||comparing||inFlight;
  $('api-status').textContent=modelAvailable()?`${info.label} ready`:PUBLIC_SITE?'Connect your key · or explore recordings':'OpenRouter key missing';
  $('model-note').textContent=!info?.available?'Set OPENROUTER_API_KEY in the local .env to make live calls.':inputKind==='structured'?'Structured input exposes obstacle lanes and coordinates. No image is sent. Use the same input for both models to compare latency fairly.':'Vision input: the model receives only the road PNG and questions. No obstacle coordinates are sent.';
}
function draw(){
  const f=replay?frames[selected]:null;
  RoadView.draw(canvas,f?{...game,lane:f.scene.lane,row:f.scene.row,distance:f.distance_at_capture||0,crashed:false,holding:false}:game);
}
function updateHud(){
  const held=(running&&game.holding)||comparing;
  $('canvas-caption').textContent=`${inputKind==='image'?'One image':'Structured scene'}. ${questionCount} question${questionCount===1?'':'s'}. One lane choice.`;
  $('road-overlay').hidden=!held&&!crashed;
  $('retry-run').hidden=!crashed;
  $('retry-run').disabled=inFlight||comparing;
  $('retry-run').textContent=inFlight?'Finishing request…':'Play again';
  $('overlay-kicker').textContent=crashed?'RUN STOPPED':'LIVE API · ROAD HELD';
  $('overlay-title').textContent=crashed?'Let’s inspect that collision.':'Waiting for the next decision';
  $('overlay-detail').textContent=crashed?'The cause and exact frame are in the inspector.':'Game time is paused. Only the API wait timer is running.';
  const recorded=replay?frames[selected]:null;
  $('sim-clock').textContent=((recorded?.elapsed_at_capture_ms??elapsed)/1000).toFixed(1)+' s';
  $('hud-speed').textContent=`${recorded?.speed??speed}×`;
  $('hud-mode').textContent=recorded?'Recorded':driveMode==='paced'?'Classroom':'Real time';
  const checkpoint=RoadEngine.nextCaptureY(game,sampling),contact=Math.max(0,(340-row.y)/(RoadEngine.BASE_SPEED*speed));
  $('sampling-status').textContent=`${checkpoint===null?'Next image: next barrier':`Next image in ${Math.max(0,(checkpoint-row.y)/(RoadEngine.BASE_SPEED*speed)).toFixed(1)} driving s`} · barrier reaches car in ${contact.toFixed(1)} driving s`;
  const budget=RoadEngine.timingBudget(game,speed,recentLatency());
  $('latency-budget').classList.toggle('tight',budget.required_ms!==null&&budget.required_ms>budget.initial_ms);
  $('latency-budget').textContent=`${speed}× gives ${ms(budget.initial_ms)} from first sight to contact. `+(budget.required_ms===null?'Make a call to measure the decision budget.':`Recent API wait ${ms(budget.latency_ms)} + turn / margin ${ms(budget.steering_ms+budget.margin_ms)}. ${budget.suggested_speed?`Measured budget fits up to ${budget.suggested_speed}×`:'Use Classroom for this measured delay'}; delays vary.`);
  $('request-status').textContent=recorded?'Recorded snapshot · no API calls':inFlight?(held?'Road held · waiting for API':'Sending image · awaiting answer'):running?'Driving on the latest lane choice':'Ready when you are';
  $('request-clock').textContent=inFlight?ms(performance.now()-requestStarted):'';
  $('run-state').textContent=crashed?'COLLISION':held?'WAITING FOR AI':running?'LIVE':replay?'REPLAY':'PAUSED';
  $('run-state').className='run-state'+(running?' running':'')+(held?' held':'');
  document.querySelector('.request-status').classList.toggle('pending',inFlight);
}
function event(type,details={}){events.push({type,at:new Date().toISOString(),elapsed_ms:Math.round(elapsed),...details});}
function updateControls(){
  $('start').textContent=running?'Pause run':crashed||frames.length>=MAX_CALLS&&!replay?'Play again':'Start live';$('start').disabled=comparing||loadingRecording||!modelAvailable()||(!running&&inFlight);
  $('previous-run').disabled=!previousRun||running||inFlight||comparing;
  $('step').disabled=comparing||loadingRecording||!modelAvailable()||running||inFlight||crashed||frames.length>=MAX_CALLS||replay;
  $('new-run').disabled=inFlight||comparing||loadingRecording;
  $('compare-questions').disabled=!modelAvailable()||inFlight||comparing||replay||frames.length>MAX_CALLS-3;
  $('load-comparison').disabled=inFlight||comparing||loadingRecording;$('load-model-benchmark').disabled=inFlight||comparing||loadingRecording;
  for(const id of ['question-count','sampling','drive-mode'])$(id).disabled=comparing;
  $('model-select').disabled=inFlight||comparing||running;syncModelControls();
  $('run-state').textContent=crashed?'COLLISION':running?'● LIVE':replay?'REPLAY':'PAUSED';$('run-state').className='run-state'+(running?' running':'');
  $('passed').textContent=passed;$('call-count').textContent=`${frames.length} / ${MAX_CALLS}`;
  $('export-session').disabled=!frames.length;
  $('follow-live').setAttribute('aria-pressed',String(following));$('follow-live').textContent=replay?'Latest recorded':following?'● Following live':'↗ Return to latest';
  $('timeline').disabled=!frames.length;$('timeline').max=Math.max(0,frames.length-1);$('timeline').value=Math.max(0,selected);
  $('timeline-label').textContent=frames[selected]?`Decision ${selected+1} of ${frames.length}`:'Waiting for the first frame';
  $('previous').disabled=selected<=0;$('next').disabled=selected>=frames.length-1;
  $('request-status').textContent=inFlight?'Live API request in flight':running?'Ready for the next frame':'No request in flight';
  updateHud();
}
function pause(reason='Paused. Inspect the log or resume when ready.'){
  running=false;RoadSound.drive(false);epoch++;event('pause',{reason});$('road-message').textContent=reason;updateControls();
}
function reset(){
  if(inFlight||comparing)return;
  if(frames.length)previousRun=runData();
  running=false;RoadSound.stop();epoch++;game=RoadEngine.create();syncGame();elapsed=0;
  frames=[];events=[];selected=-1;following=true;replay=false;runId=newRunId();draw();renderLog();renderSelection();updateControls();
  $('road-message').textContent='Fresh road. Start live or take one decision with the road paused.';$('last-latency').textContent='—';
}
function tick(now){
  const dt=Math.min((now-lastTick)/1000,.1);lastTick=now;
  if(running){
    const wasHolding=game.holding;
    const changes=RoadEngine.advance(game,dt,speed,driveMode,inFlight,sampling);syncGame();
    if(game.holding!==wasHolding)event(game.holding?'hold_started':'hold_ended',{row_id:row.id,held_ms:Math.round(game.heldMs)});
    for(const change of changes){
      if(change.type==='collision'){
        const diagnosis=RoadEngine.diagnose(game),related=frames.find(f=>f.frame_id===diagnosis.related_frame_id);
        if(related){related.application.collision_observed=true;related.application.diagnosis=diagnosis;related.application.collision_at=new Date().toISOString();}
        // An unanswered current-row request is relevant; the preceding row's decision is not.
        else if(activeRequest&&activeRequest.scene.row.id===row.id)activeRequest.application.diagnosis=diagnosis;
        event('collision',diagnosis);RoadSound.collision();
        const reason=diagnosis.cause==='no_current_decision'?'No answer for this barrier arrived before impact.':diagnosis.cause==='model_chose_blocked_lane'?`The model chose ${diagnosis.model_target}; the opening was ${diagnosis.actual_open_lane}.`:'The answer arrived too late to finish steering.';
        pause(`Collision. ${reason} Inspect its frame for the full trace.`);
        renderLog();if(selected>=0)renderSelection();
      }else{
        const f=frames.find(f=>f.frame_id===change.frameId);
        if(f){f.application.barrier_passed=true;f.application.passed_at=new Date().toISOString();}
        event('passed',{passed,row_id:change.rowId,frame_id:change.frameId});RoadSound.pass();renderLog();updateControls();
      }
    }
    if(running&&!inFlight&&RoadEngine.captureDue(game,sampling)&&now>=nextCall&&frames.length<MAX_CALLS){
      const budget=RoadEngine.timingBudget(game,speed,recentLatency());
      if(RoadEngine.skipLateRecheck(game,speed,driveMode,sampling,recentLatency()))event('recheck_skipped',{row_id:row.id,reason:'Insufficient time for API plus steering',...budget});
      else requestDecision(false);
    }
  }
  RoadSound.drive(running&&!crashed&&!game.holding&&!(driveMode==='paced'&&inFlight),speed);
  draw();
  if(now-lastHud>100){updateHud();lastHud=now;}
  requestAnimationFrame(tick);
}
function structuredState(scene){return {input_kind:'structured scene, no image',lane_order:RoadEngine.lanes,canvas_height:480,car_lane_index:Number(scene.lane.toFixed(3)),obstacles:scene.row.blocked.map(i=>({lane:RoadEngine.lanes[i],y:Number(scene.row.y.toFixed(2)),height:49}))};}
function requestBody(image,count=questionCount,scene={lane,row}){
  const state=inputKind==='structured'?structuredState(scene):[{type:'text',text:config.road_context},{type:'image_url',image_url:{url:image}}];
  const questions=RoadQuestions.select(inputKind==='structured'?config.road_text_questions:config.road_questions,count);
  
  return {model:selectedModel,state,questions};
}
function nativePreview(request){
  if(request.model!=='openai/gpt-6-luna-decisions')return {note:'This OpenAI example applies only to Luna. Inspect Full JSON for the selected provider’s exact request.'};
  return {model:'gpt-6-luna',input:Array.isArray(request.state)?[{role:'user',content:request.state.map(p=>p.type==='text'?{type:'input_text',text:p.text}:{type:'input_image',image_url:p.image_url.url})}]:JSON.stringify(request.state),questions:Object.entries(request.questions).map(([name,q])=>({type:q.type==='noul'?'predicate':q.type,name,instructions:q.instructions,...(q.type==='choice'?{choices:Object.entries(q.criteria).map(([value,description])=>({value,description}))}:q.type==='score'?{levels:q.criteria.map((description,i)=>({label:String(i),description}))}:{})}))};
}
async function requestDecision(single,comparison=null){
  if(inFlight||!config||!modelAvailable()||frames.length>=MAX_CALLS)return;
  inFlight=true;requestStarted=performance.now();const capturedEpoch=epoch;draw();
  const image=comparison?.image||captureImage(),count=comparison?.count||questionCount;
  const f={frame_id:frames.length+1,run_id:runId,captured_at:comparison?.captured_at||new Date().toISOString(),question_count:count,input_kind:inputKind,comparison_id:comparison?.id||null,speed,driving_mode:driveMode,sampling,checkpoint:row.y<135?'far':row.y<295?'middle':'near',mode:comparison?'same-image comparison, road paused':single?'single decision, road paused':`live continuous · ${driveMode}`,image,image_width:comparison?.width||inputCanvas.width,image_height:comparison?.height||inputCanvas.height,held_at_capture_ms:game.heldMs,scene:comparison?.scene||{lane,row:structuredClone(row)},request:requestBody(image,count,comparison?.scene||{lane,row}),response:null,metadata:{},error:null,application:{status:'pending',reason:null,timing_budget:RoadEngine.timingBudget(game,speed,recentLatency())},distance_at_capture:distance,elapsed_at_capture_ms:Math.round(elapsed)};
  frames.push(f);activeRequest=f;if(following)selected=frames.length-1;renderLog();if(following)renderSelection();updateControls();
  try{
    let result;
    if(PUBLIC_SITE){result=await PublicDecisions.submit(f.request);}
    else{
      const res=await fetch('/api/road',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({run_id:runId,frame_id:f.frame_id,image,question_count:count,model:selectedModel,input_kind:f.input_kind,...(f.input_kind==='structured'?{scene:f.scene}:{})}),signal:AbortSignal.timeout(30000)});
      result=await res.json();
      if(!result.request)throw new Error(result.error||`Local server returned HTTP ${res.status}.`);
    }
    Object.assign(f,{request:result.request,response:result.response,metadata:result.metadata,error:result.error,openai_preview:result.openai_preview,raw_response:result.raw_response});
  }catch(e){f.error=e.name==='TimeoutError'?'The API request timed out.':e.message;}
  f.received_at=new Date().toISOString();f.metadata.browser_round_trip_ms=Number((performance.now()-requestStarted).toFixed(2));
  f.application.received_scene={lane,row:structuredClone(row)};
  const a=f.response?.answers;
  if(f.error){f.application.status='error';f.application.reason=f.error;pause('API call failed. Its error and timing are in the log.');}
  else if(comparison){
    f.application.status='compared';f.application.reason='Same-image comparison only; no steering applied.';
    f.application.local_scene_check={actual_open_lane:RoadEngine.lanes[[0,1,2].find(l=>!f.scene.row.blocked.includes(l))],model_matches_scene:!f.scene.row.blocked.includes(RoadEngine.lanes.indexOf(a.lane.choice)),note:'Local evaluation only; no answer label supplied and no comparison steering.'};
  }
  else if(capturedEpoch!==epoch||crashed){f.application.status='skipped';f.application.reason=crashed?'Arrived after collision.':'Run paused or changed while the request was in flight.';}
  else if(f.scene.row.id!==row.id){f.application.status='stale';f.application.reason='The pictured obstacle row has already passed.';}
  else{
    const targetLane=RoadEngine.lanes.indexOf(a.lane.choice),from=lane;
    const delta=Math.sign(targetLane-lane),direction=delta<0?'left':delta>0?'right':'stay';
    f.application.status=RoadEngine.apply(game,a.lane.choice,f.scene.row.id,f.frame_id,f.scene.row.y);
    if(f.application.status==='applied'){
      f.application.reason=direction==='stay'?'Kept the current lane.':`Steering ${direction} to the ${a.lane.choice} lane.`;
      f.application.steering=direction;f.application.target_lane=a.lane.choice;f.application.from_lane=from;f.application.to_lane=targetLane;
      f.application.local_scene_check={actual_open_lane:RoadEngine.lanes[[0,1,2].find(l=>!row.blocked.includes(l))],model_matches_scene:!row.blocked.includes(targetLane),note:'Local correctness check; does not repair the answer. Structured mode explicitly sends obstacle coordinates; image mode does not.'};
      if(single)game.lane=game.target;
      RoadSound.steer(direction);syncGame();
    }else f.application.reason='Invalid or outdated steering decision.';
    f.application.applied_at=new Date().toISOString();
  }
  f.application.simulation_held_ms=Number((game.heldMs-f.held_at_capture_ms).toFixed(1));
  f.application.road_pixels_moved=Number((distance-f.distance_at_capture).toFixed(1));
  event('decision',{frame_id:f.frame_id,status:f.application.status});
  inFlight=false;activeRequest=null;nextCall=performance.now();
  $('last-latency').textContent=ms(f.metadata.upstream_round_trip_ms);
  if(frames.length>=MAX_CALLS)pause('30-call teaching run complete. Export or rewind this run; reset the road for a new one.');
  else if(single&&!f.error)$('road-message').textContent=`Open lane: ${a.lane.choice}. ${f.application.reason} Road remains paused.`;
  else if(running)$('road-message').textContent=`Frame ${f.frame_id}: ${a?.lane.choice??'error'} · ${f.application.reason}`;
  if(following)selected=frames.length-1;
  draw();renderLog();if(following||frames[selected]===f)renderSelection();updateControls();
  return f;
}
async function compareQuestions(){
  if(inFlight||comparing||replay||frames.length>MAX_CALLS-3)return;
  comparing=true;pause('Comparing three question sets on the same image. The road remains paused.');
  const snapshot={id:runId+'-pair-'+(frames.length+1),image:captureImage(),scene:{lane,row:structuredClone(row)},captured_at:new Date().toISOString(),width:inputCanvas.width,height:inputCanvas.height};
  const offset=Math.floor(frames.filter(f=>f.comparison_id).length/3)%3;
  try{for(let i=0;i<3;i++)await requestDecision(true,{...snapshot,count:(i+offset)%3+1});}
  finally{comparing=false;$('road-message').textContent=frames.length>=MAX_CALLS?'30-call run complete. Compare the results below, export, or reset.':'Comparison complete. Review the measured results below; Start live resumes driving.';updateControls();}
}
function renderComparison(){
  const comparisonModel=replay?frames[0]?.request.model:selectedModel,comparisonKind=replay?(frames[0]?.input_kind||'image'):inputKind;
  const stats=RoadQuestions.summarize(frames.filter(f=>f.request.model===comparisonModel&&(f.input_kind||'image')===comparisonKind));
  $('comparison-note').textContent=`${replay?'Recorded run':'This run'} · ${comparisonModel} · ${comparisonKind} · ${stats.pairs} complete matched comparisons. Lane correctness is checked locally; no answer label is sent to the model. These small samples do not establish equal accuracy or faster inference.`;
  $('comparison-rows').innerHTML=stats.versions.map(v=>`<tr><th>${v.count} · ${['Lane only','+ middle blocked','+ position score'][v.count-1]}</th><td>${v.attempts?`${v.correct} / ${v.attempts} (${Math.round(100*v.correct/v.attempts)}%)`:'—'}</td><td>${v.errors}</td><td>${ms(v.median_ms)}</td><td>${v.mean_tokens===null?'—':Math.round(v.mean_tokens)}</td><td>${v.mean_cost===null?'—':'$'+v.mean_cost.toFixed(6)}</td></tr>`).join('');
}
function shortImage(value){return JSON.parse(JSON.stringify(value,(k,v)=>typeof v==='string'&&v.startsWith('data:image/')?v.slice(0,43)+`… [${v.length} characters; full image in Copy / Export]`:v));}
function setJSON(id,value,shorten=false){$(id).dataset.raw=pretty(value);$(id).textContent=pretty(shorten?shortImage(value):value);}
function bars(entries,active){return `<div class="probabilities">${entries.map(([name,p])=>`<div class="prob-item ${name===active?'selected':''}"><label>${esc(name)} <span>${pct(p)}</span></label><meter value="${Number.isFinite(p)?p:0}" min="0" max="1" aria-label="${esc(name)} probability">${pct(p)}</meter></div>`).join('')}</div>`;}
function renderSelection(){
  if(!config)return;
  const f=frames[selected],image=f?.image||captureImage(),request=f?.request||requestBody(image);
  const structured=(f?(f.input_kind||'image'):inputKind)==='structured';
  $('input-heading').textContent=structured?'SCENE PREVIEW · NOT SENT':'THE INPUT IMAGE';
  $('structured-input-panel').hidden=!structured;if(structured)setJSON('structured-input',request.state);
  $('input-frame').alt=structured?'Local scene preview, not sent to the model':'Exact PNG frame sent to the Decisions API';
  $('input-frame').onload=()=>{$('image-caption').textContent=`${$('input-frame').naturalWidth} × ${$('input-frame').naturalHeight} PNG · ${(image.length*.75/1024).toFixed(1)} KB${structured?' · local preview, not sent':f?' · exact sent image':' · preview'}`;};
  $('input-frame').src=image;$('download-image').href=image;$('download-image').download=`road-frame-${f?.frame_id||'preview'}.png`;
  $('image-caption').textContent=`${f?.image_width||$('input-frame').naturalWidth||canvas.width} × ${f?.image_height||$('input-frame').naturalHeight||canvas.height} PNG · ${(image.length*.75/1024).toFixed(1)} KB${structured?' · local preview, not sent':f?' · exact sent image':' · preview'}`;
  $('selected-label').textContent=f?`FRAME ${String(f.frame_id).padStart(3,'0')} · ${f.speed}× · ${RoadQuestions.count(f)}Q · ${f.request.model} · ${f.input_kind||'image'} · ${replay?'SAVED RUN':following?'LIVE LOG':'HISTORY'}`:'NEXT FRAME · PREVIEW';
  $('selected-time').textContent=f?`${time(f.captured_at)} captured`:'Not sent yet';
  $('timeline-label').textContent=f?`Decision ${selected+1} of ${frames.length}`:'Waiting for the first frame';
  const a=f&&!f.error?f.response?.answers:null;
  $('action-title').textContent=f?.error?'Request failed':a?`Open lane: ${a.lane.choice}.`:f?'Reading the road…':'Find the open lane.';
  $('action-detail').textContent=f?(f.application.reason||'This exact image is being evaluated. Classroom mode pauses the game clock until the answer arrives.'):`${inputKind==='image'?'One image':'Structured road JSON'} goes in with ${questionCount} question${questionCount===1?'':'s'}. Only the lane choice steers. Extra questions describe the scene and are optional.`;
  const diagnostic=f?.application.diagnosis,check=f?.application.local_scene_check;
  $('decision-diagnosis').hidden=!diagnostic&&check?.model_matches_scene!==false;
  $('decision-diagnosis').textContent=diagnostic?`Collision diagnosis: ${diagnostic.cause.replaceAll('_',' ')}. Opening: ${diagnostic.actual_open_lane}. Target: ${diagnostic.model_target??'no current answer'}.`:check?.model_matches_scene===false?`Scene mismatch: the model chose ${a?.lane.choice}; the actual gap is ${check.actual_open_lane}. This is a local check, not a corrected answer.`:'';
  const titles={lane:'Which lane is the gap in the barrier?',middle_blocked:'Is the middle lane blocked?',proximity:'Where is the barrier: top, middle or bottom?'};
  $('race-questions').innerHTML=Object.entries(request.questions).map(([name,q])=>{
    const answer=a?.[name],value=!answer?'—':q.type==='choice'?answer.choice:q.type==='noul'?pct(answer.noul):`${answer.score.toFixed(2)} / 2`;
    const probs=!answer?'':q.type==='noul'?bars([['no',1-answer.noul],['yes',answer.noul]]):bars(Object.entries(answer.probabilities).map(([k,v])=>[q.type==='score'?['0 top','1 middle','2 bottom'][Number(k)]:k,v]),answer.choice);
    const criteria=q.type==='choice'?Object.entries(q.criteria):q.type==='score'?q.criteria.map((v,i)=>[i,v]):[];
    return `<article class="race-question"><div class="race-question-head"><div><span class="question-type">${q.type} / ${name}</span><h3>${titles[name]}</h3></div><strong>${esc(value)}</strong></div><p>${esc(q.instructions)}</p>${probs}${answer?`<div class="confidence-line">${q.type==='noul'?'Probability of yes · no separate confidence field':`confidence ${answer.confidence.toFixed(2)}${q.type==='score'?' · score = '+Object.entries(answer.probabilities).map(([k,v])=>`${k}×${v}`).join(' + '):''}`}</div>`:''}${criteria.length?`<details><summary>Allowed ${q.type==='choice'?'choices':'score levels'} (${criteria.length})</summary><ul class="criteria-list">${criteria.map(([k,v])=>`<li><code>${esc(k)}</code> — ${esc(v)}</li>`).join('')}</ul></details>`:''}</article>`;
  }).join('');
  setJSON('road-request',request,!$('expand-image').checked);
  $('road-request-title').textContent=f?`ACTUAL REQUEST · ${f.metadata.provider||'OpenRouter'} · ${f.request.model}`:'REQUEST PREVIEW · NOT SENT';
  $('road-response-title').textContent=f?.response?`ACTUAL RESPONSE · ${f.metadata.provider||'OpenRouter'}`:f?.error?'REQUEST ERROR':'RESPONSE · WAITING';
  if(f?.response)setJSON('road-response',f.raw_response||f.response);else if(f?.error)setJSON('road-response',{error:f.error});else{$('road-response').textContent=f?'Request in flight…':'Start a run to receive an actual response.';delete $('road-response').dataset.raw;}
  setJSON('road-native',f?.openai_preview||nativePreview(request),true);
  $('export-call').disabled=!f;
  renderMetadata(f);updateControls();
  window.ClassroomUI?.refreshSelection({frame:f,request,frames,selected,following,replay});
}
function renderMetadata(f){
  if(!f){$('race-metadata').innerHTML='<p class="metadata-explanation">Make a live call to inspect its timing, usage and provenance.</p>';return;}
  const m=f.metadata||{},r=f.response||{},u=r.usage||{};
  const item=(label,value)=>`<dt>${esc(label)}</dt><dd>${esc(value===undefined?'not supplied':value===null?'null':value)}</dd>`;
  $('race-metadata').innerHTML=`<div class="selected-outcome">${esc(f.application.status)} · ${esc(f.application.reason||'Waiting for the API')}</div><span class="question-type">API ROUND TRIP · NETWORK INCLUDED</span><strong class="latency-value">${ms(m.upstream_round_trip_ms)}</strong><p class="metadata-explanation">${RoadQuestions.count(f)} question${RoadQuestions.count(f)===1?'':'s'} in this request; one shared duration. Speed ${f.speed}× changes the simulation, not the reported API time. Provider-only processing time is <code>null</code> because no such timing was returned. ${m.timing_origin==='browser'?'This live call went directly from your browser to OpenRouter; no app server was used.':'This recorded/local measurement includes the server-to-provider round trip.'}</p><div class="race-metadata-grid"><dl>${item('Model returned',r.model)}${item('Provider',r.provider||m.provider)}${item('Input mode',f.input_kind||'image')}${item('Connection reused',m.connection_reused)}${item('Connection setup (ms)',m.connection_setup_ms)}${item('Request ID',r.id)}${item('Captured at',f.captured_at)}${item('Response received at',f.received_at)}${item('HTTP status',m.http_status)}${item('Question count',RoadQuestions.count(f))}${item('Decision mode',f.mode)}${item('Capture point',f.checkpoint)}${item('Sampling policy',f.sampling)}${item('Image size',f.image_width+' × '+f.image_height)}</dl><dl>${item('Input tokens',u.input_tokens)}${item('Output tokens',u.output_tokens)}${item('Cost (USD)',u.cost)}${item('Browser round trip (ms)',m.browser_round_trip_ms)}${item('Provider processing (ms)',m.provider_processing_ms)}${item('Road pixels moved during call',f.application.road_pixels_moved)}${item('Simulation held during call (ms)',f.application.simulation_held_ms)}${item('Driving mode',f.driving_mode)}${item('Game time at capture (ms)',f.elapsed_at_capture_ms)}${item('Application / schema error',f.error)}</dl></div><details><summary>Local metadata + action JSON</summary><div class="code-panel"><pre id="race-local-meta" tabindex="0"></pre></div></details>`;
  setJSON('race-local-meta',{metadata:m,application:f.application});
}
function renderLog(){
  renderComparison();
  window.ClassroomUI?.refreshHistory(frames,selected,following,replay);
  $('log-count').textContent=`${frames.length} decisions`;
  if(!frames.length){$('log-rows').innerHTML='<tr><td colspan="8" class="empty-log">Your first decision starts the story. Try “One decision” or start a live run.</td></tr>';return;}
  $('log-rows').innerHTML=frames.map((f,i)=>{const a=f.response?.answers;return `<tr data-log="${i}" aria-selected="${i===selected}"><td><button aria-label="Inspect decision ${f.frame_id}">#${String(f.frame_id).padStart(3,'0')}<span class="time">${time(f.captured_at)}${f.checkpoint?' · '+esc(f.checkpoint):''}</span></button></td><td>${RoadQuestions.count(f)}Q</td><td>${f.speed}×</td><td>${esc(a?.lane?.choice??'…')}</td><td>${f.request.questions.middle_blocked?pct(a?.middle_blocked?.noul):'not asked'}</td><td>${!f.request.questions.proximity?'not asked':Number.isFinite(a?.proximity?.score)?a.proximity.score.toFixed(2):'—'}</td><td>${ms(f.metadata?.upstream_round_trip_ms)}</td><td class="${['error','stale','blocked','skipped'].includes(f.application.status)?'outcome-bad':f.application.status==='applied'?'outcome-good':''}">${esc(f.application.status)}${f.application.steering?' · '+esc(f.application.steering):''}${f.application.collision_observed?' · collision':f.application.barrier_passed?' · passed':''}</td></tr>`;}).join('');
  const cost=frames.reduce((n,f)=>n+(f.response?.usage?.cost||0),0);
  $('run-summary').textContent=`Run ${runId} · reported API cost $${cost.toFixed(6)} · ${PUBLIC_SITE?'history stays in this tab; export before refreshing. Your key is never exported.':'raw image requests saved locally; Export run also includes action outcomes and speed-change events.'}`;
  if(following)document.querySelector('.log-scroll').scrollTop=100000;
}
function inspect(i){if(i<0||i>=frames.length)return;selected=i;following=false;renderLog();renderSelection();}
function switchView(view){document.querySelectorAll('[data-view]').forEach(b=>{const yes=b.dataset.view===view;b.setAttribute('aria-selected',yes);b.tabIndex=yes?0:-1;$('view-'+b.dataset.view).hidden=!yes;});}
function save(data,name){const url=URL.createObjectURL(new Blob([pretty(data)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
let toastTimer;function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2500);}
$('start').addEventListener('click',()=>{RoadSound.unlock();if(running){pause();return;}if(replay||crashed||frames.length>=MAX_CALLS)reset();running=true;epoch++;lastTick=performance.now();nextCall=0;event('start',{speed});$('road-message').textContent=driveMode==='paced'?'Live: game time pauses for each decision, then resumes from the same position.':'Live: road speed follows wall time. Late decisions can cause collisions.';updateControls();});
$('retry-run').addEventListener('click',()=>$('start').click());
$('previous-run').addEventListener('click',()=>{if(!previousRun||running||inFlight||comparing)return;const prior=previousRun;previousRun=frames.length?runData():null;openRun(prior);});
$('step').addEventListener('click',()=>{RoadSound.unlock();requestDecision(true);});$('new-run').addEventListener('click',reset);
$('follow-live').addEventListener('click',()=>{following=true;selected=frames.length-1;renderLog();renderSelection();});
$('previous').addEventListener('click',()=>inspect(selected-1));$('next').addEventListener('click',()=>inspect(selected+1));$('timeline').addEventListener('input',()=>inspect(Number($('timeline').value)));
$('expand-image').addEventListener('change',renderSelection);
$('export-call').addEventListener('click',()=>{if(frames[selected])save(frames[selected],`road-frame-${frames[selected].frame_id}.json`);});
$('export-session').addEventListener('click',()=>save(runData(),`${runId}.json`));
$('import-session').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  if(inFlight||comparing){toast('Pause and wait for the current request before opening a saved run.');e.target.value='';return;}
  try{if(file.size>150000000)throw new Error('Run is too large.');const data=JSON.parse(await file.text());
    openRun(data);
  }catch(err){toast(err.message||'Could not open this run.');}e.target.value='';
});
function openRun(data){
  if(data.format!=='pocket-pilot-road-v2'||!Array.isArray(data.frames)||!data.frames.length||data.frames.length>MAX_CALLS)throw new Error('Not a Pocket Pilot run.');
    for(const f of data.frames){if(!f.scene||!Number.isFinite(f.scene.lane)||f.scene.lane<0||f.scene.lane>2||!Number.isFinite(f.scene.row?.y)||!Array.isArray(f.scene.row?.blocked)||f.scene.row.blocked.length!==2||new Set(f.scene.row.blocked).size!==2||!f.scene.row.blocked.every(l=>[0,1,2].includes(l)))throw new Error('Missing replay scene.');
      if(!f.request?.questions?.lane||(typeof f.request.state!=='object'&&typeof f.request.state!=='string')||!RoadQuestions.validSavedAnswers(f))throw new Error('Unsupported question schema.');
      if(!f.image?.startsWith('data:image/png;base64,')||f.image.length>2000000||!f.request?.questions||!f.application||!Number.isFinite(Date.parse(f.captured_at))||!Number.isInteger(f.frame_id)||!f.metadata)throw new Error('Invalid frame record.');}
    pause();if(frames.length&&frames!==data.frames)previousRun=runData();frames=data.frames;game=RoadEngine.create();game.lane=frames[0].scene.lane;game.target=game.lane;game.row={...structuredClone(frames[0].scene.row),decision:null};syncGame();draw();events=Array.isArray(data.events)?data.events:[];runId=String(data.run_id);selected=0;following=false;replay=true;renderLog();renderSelection();$('road-message').textContent='Saved run opened for inspection. Start live begins a fresh road.';
}
document.addEventListener('click',async e=>{
  const s=e.target.closest('[data-speed]');if(s){speed=Number(s.dataset.speed);document.querySelectorAll('[data-speed]').forEach(b=>b.setAttribute('aria-pressed',b===s));event('speed',{speed});}
  const v=e.target.closest('[data-view]');if(v)switchView(v.dataset.view);
  const rowElement=e.target.closest('[data-log]');if(rowElement)inspect(Number(rowElement.dataset.log));
  const copy=e.target.closest('[data-copy]');if(copy){try{await navigator.clipboard.writeText($(copy.dataset.copy).dataset.raw||$(copy.dataset.copy).textContent);toast('Copied complete JSON');}catch{toast('Select and copy the JSON manually.');}}
});
document.querySelector('.decision-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...document.querySelectorAll('[data-view]')];let i=tabs.indexOf(document.activeElement);i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;switchView(tabs[i].dataset.view);tabs[i].focus();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pause('Paused because this browser tab became hidden.');});
$('drive-mode').addEventListener('change',()=>{driveMode=$('drive-mode').value;event('driving_mode',{mode:driveMode});$('pace-note').textContent=driveMode==='paced'?'Game time pauses during each API request. The API wait timer shows real elapsed time.':'Real-time mode never holds the road for the API. Higher speeds can outrun a response.';updateHud();});
$('sound-toggle').addEventListener('click',()=>{RoadSound.unlock();RoadSound.setEnabled(!RoadSound.enabled);$('sound-toggle').textContent=RoadSound.enabled?'Sound on':'Sound off';$('sound-toggle').setAttribute('aria-pressed',RoadSound.enabled);if(RoadSound.enabled)RoadSound.steer('right');});
$('compare-questions').addEventListener('click',compareQuestions);
$('model-select').addEventListener('change',()=>{selectedModel=$('model-select').value;syncModelControls();event('model',{model:selectedModel,input_kind:inputKind});if(!frames.length)renderSelection();updateControls();renderComparison();});
$('input-kind').addEventListener('change',()=>{inputKind=$('input-kind').value;syncModelControls();event('input_kind',{input_kind:inputKind});if(!frames.length)renderSelection();updateControls();renderComparison();});
$('question-count').addEventListener('change',()=>{questionCount=Number($('question-count').value);event('question_count',{count:questionCount});if(!frames.length)renderSelection();updateHud();});
let loadingRecording=false;
async function loadRecording(url){
  if(inFlight||comparing||loadingRecording)return;
  loadingRecording=true;pause('Loading the recorded run…');
  const demo=$('lab-recorded-demo');if(demo){demo.disabled=true;demo.textContent='Loading recording…';}
  $('load-comparison').disabled=true;$('load-model-benchmark').disabled=true;
  try{const r=await fetch(url);if(!r.ok)throw new Error('The recorded run could not be loaded. Try again.');openRun(await r.json());}
  catch(e){toast(e.message);$('road-message').textContent='Could not load the recording. Your current run is still available.';}
  finally{loadingRecording=false;if(demo){demo.disabled=false;demo.textContent='Recorded demo';}updateControls();}
}
$('load-comparison').addEventListener('click',()=>loadRecording('./comparison-run.json'));
$('load-model-benchmark').addEventListener('click',()=>loadRecording('./model-benchmark-run.json'));
$('volume').addEventListener('input',()=>{RoadSound.setVolume(Number($('volume').value)/100);});
$('sampling').addEventListener('change',()=>{sampling=$('sampling').value;event('sampling',{sampling});updateHud();});
$('image-size').addEventListener('change',()=>{inputCanvas.width=Number($('image-size').value);inputCanvas.height=inputCanvas.width*8/7;event('image_size',{width:inputCanvas.width,height:inputCanvas.height});if(!frames.length)renderSelection();});
async function renderModelBenchmark(){
  try{const r=await fetch('./model-benchmark-summary.json');if(!r.ok)throw new Error();const data=await r.json();
    $('model-benchmark-rows').innerHTML=data.summary.map(v=>`<tr><th>${esc(v.model.split('/').at(-1))}</th><td>${esc(v.input_kind==='image'?`${v.width}px image`:'Structured JSON')}</td><td>${v.correct} / ${v.attempts}${v.errors?` · ${v.errors} errors`:''}</td><td>${ms(v.median_ms)}</td><td>${ms(v.max_ms)}</td></tr>`).join('');
    $('model-benchmark-note').textContent=`Recorded ${new Date(data.measured_at).toLocaleString()}. Timings include network and routing. Smaller-image follow-up was measured later, so timing differences are exploratory.`;
  }catch{$('model-benchmark-rows').innerHTML='<tr><td colspan="5">No recorded model measurements yet. Live calls still appear in Run history.</td></tr>';}
}
if(PUBLIC_SITE)window.addEventListener('public-connection-changed',()=>{
  if(!config)return;
  if(!PublicDecisions.connected&&(running||inFlight))pause('Disconnected. The key was cleared and new calls have stopped.');
  updateControls();
  if(PublicDecisions.connected&&!frames.length)$('road-message').textContent='Connected for this tab. One decision sends your first live request to OpenRouter.';
});
async function init(){
  renderModelBenchmark();draw();requestAnimationFrame(tick);switchView('overview');
  try{
    if(PUBLIC_SITE)config=PublicDecisions.config;
    else{const r=await fetch('/api/config');if(!r.ok)throw new Error();config=await r.json();}
    $('model-select').innerHTML=config.road_models.map(m=>`<option value="${esc(m.id)}">${esc(m.label)}${m.available?'':' · needs setup'}</option>`).join('');
    syncModelControls();renderSelection();renderComparison();updateControls();
    if(PUBLIC_SITE)$('road-message').textContent='Open Recorded demo, or Connect key for live play.';
    else if(!config.live_available)$('road-message').textContent='Set OPENROUTER_API_KEY on the local server to run live.';
  }catch{
    $('api-status').textContent=PUBLIC_SITE?'Could not load the game':'Local server unavailable';
    $('road-message').textContent=PUBLIC_SITE?'Reload the page to try again.':'Start server.py, then reload this page.';
  }
}
init();
