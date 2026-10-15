/* Browser controller: frozen observations, bounded actions, inspectable provenance. */
(function(){
  'use strict';
  const E=globalThis.MarioEngine||Platformer,C=DecisionContract,V=globalThis.MarioView||PlatformerView,$=id=>document.getElementById(id);
  const LOCAL='LiquidAI/d1-omni-600M',LIMIT=200;
  let state=E.create(),running=false,busy=false,loading=false,pending=null,epoch=0,attempt=1,runCalls=0;
  let runtime=null,loadInfo=null,lastAction='wait',selected=-1,following=true,history=[],keys=new Set(),lastTick=0,accumulator=0,manualRecord=null;
  let replayData=null,replayIndex=0;
  let soundContext=null,toastTimer=null,phase='Ready',requestQueued=false,inFlightRecord=null;
  const explorer=JsonExplorer.create($('json-explorer'),toast);
  const mode=()=>$('controller').value,frames=()=>eventDriven()||isReplay()?64:Number($('frames').value),isImage=()=>$('input').value==='image';
  const isReplay=()=>!!globalThis.MarioReplay&&mode()==='replay';
  const isModel=()=>!['manual','scripted','replay'].includes(mode());
  const textOnly=()=>['typesafe/jev-1.13','inception/mercury-decide:free'].includes(mode());
  const timing=()=>$('timing')?.value||'classroom';
  const eventDriven=()=>!!globalThis.MarioPilot&&timing()==='events'&&isModel()&&mode()!==LOCAL;
  const continuous=()=>running&&isModel()&&timing()==='realtime';
  const queueDecision=()=>{if(requestQueued)return;requestQueued=true;queueMicrotask(()=>{requestQueued=false;if(running)decide();});};
  const title=a=>({wait:'Wait',left:'Walk left',right:'Walk right',jump:'Jump',left_jump:'Jump left',right_jump:'Jump right',left_run:'Run left',right_run:'Run right',left_run_jump:'Run + jump left',right_run_jump:'Run + jump right',run:'Hold run / fire',run_jump:'Jump + fire',down:'Duck / enter pipe'})[a]||a;
  const elapsed=r=>r?.metadata?.local_inference_ms??r?.metadata?.upstream_round_trip_ms??null;
  function toast(msg){$('toast').textContent=msg;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2500);}
  function message(text){$('game-status').textContent=text;}
  function audioInit(){if(E.nativeAudio){syncAudio();return;}if($('sound').checked){soundContext ||= new (window.AudioContext||window.webkitAudioContext)();soundContext.resume().catch(()=>{});}}
  function sound(event){
    if(E.nativeAudio)return;
    if(!soundContext||!$('sound').checked)return;
    const tunes={jump:[300,610,.12],coin:[820,1260,.1],stomp:[150,80,.09],lost:[180,55,.32],won:[500,1100,.4],step:[95,70,.025]};
    const [a,b,d]=tunes[event]||tunes.step,osc=soundContext.createOscillator(),gain=soundContext.createGain(),t=soundContext.currentTime;
    osc.type=event==='step'?'triangle':'sine';osc.frequency.setValueAtTime(a,t);osc.frequency.exponentialRampToValueAtTime(b,t+d);
    gain.gain.setValueAtTime(Number($('volume').value)/100*(event==='step'?.025:.12),t);gain.gain.exponentialRampToValueAtTime(.0001,t+d);
    osc.connect(gain).connect(soundContext.destination);osc.start(t);osc.stop(t+d);
  }
  function syncAudio(){E.setAudio?.({enabled:$('sound').checked,volume:Number($('volume').value)/100,active:state.status==='playing'&&((running&&mode()==='manual')||continuous()||!!pending)});}
  function ui(){
    syncAudio();
    if(isReplay()){$('timing').value='replay';$('frames').value='64';}
    else if(eventDriven()){$('input').value='structured';$('frames').value='64';}else if($('frames').value==='64')$('frames').value='8';
    if(globalThis.MarioPilot){const adaptive=$('frames').querySelector?.('option[value="64"]');if(adaptive){adaptive.disabled=!eventDriven()&&!isReplay();adaptive.textContent=isReplay()?'Recorded · up to 64 frames':'Adaptive · up to 64 frames';}
      const recorded=$('timing').querySelector?.('option[value="replay"]');if(recorded)recorded.disabled=!isReplay();}
    DecisionModels.constrainImageSelect($('image-size'),mode(),(E.HEIGHT||405)/(E.WIDTH||720));
    const locked=busy||running||!!pending||loading,local=mode()===LOCAL,model=isModel();
    for(const id of ['controller','input','questions','frames','image-size'])$(id).disabled=locked;
    if($('level'))$('level').disabled=locked||isReplay();
    if($('timing'))$('timing').disabled=locked||!isModel();
    $('input').disabled=locked||textOnly()||!model||eventDriven();
    $('frames').disabled=locked||eventDriven()||isReplay();
    $('questions').disabled=locked||!model;$('image-size').disabled=locked||!model||!isImage();
    $('load-local').hidden=!local;$('load-local').disabled=locked;
    $('unload-local').hidden=!runtime;$('unload-local').disabled=locked;
    $('run').disabled=loading||(!running&&busy);
    $('run').textContent=running||pending?'Pause':state.status!=='playing'?'Play again':runCalls>=LIMIT?'New attempt':isReplay()?'Watch recorded clear':mode()==='manual'?'Play':mode()==='scripted'?'Run reference':'Run model';
    $('step').disabled=mode()==='manual'||isReplay()||locked||state.status!=='playing'||runCalls>=LIMIT;
    $('restart').disabled=loading;
    document.querySelector('.manual-controls').hidden=mode()!=='manual';
    $('phase').textContent=phase;
    $('export').disabled=history.length===0;
  }
  function modelNote(){
    const m=mode();
    if(isReplay()){$('model-note').textContent='Recorded Jev 1.14 clear · World 1-1 · 80 decisions. No new inference or API key. Playback restarts from the beginning; the original answers and timings remain inspectable.';return;}
    if(eventDriven()){$('model-note').textContent='Jev-style JSON: observed hazards and jump timing; seven actions. Ask at hazards, landing or apex. The model chooses every action.';return;}
    if(DecisionModels.isVisionJev(m)){$('model-note').textContent=(m===DecisionModels.latest?'Jev latest · follows new releases.':'Jev 1.14 · fixed version.')+' Experimental images + JSON. Exact version is saved in each response. Small images are disabled.';return;}
    if(m==='inception/mercury-decide:free'){$('model-note').textContent='Mercury Decide · structured JSON only. Free, rate-limited OpenRouter endpoint; connect your key.';return;}
    $('model-note').textContent=m==='manual'?(E.controlsText||'No API key needed. Arrow keys / A D to move; Space / ↑ to jump.'):m==='scripted'?'Hand-written jump rules. This is a reference controller, not AI.':m===LOCAL?(runtime?.ready(isImage())?'Liquid ready · original weights, not platformer-fine-tuned.':'Original Liquid · first load ~406 MB JSON / ~595 MB vision. Requires WebGPU.'):m==='typesafe/jev-1.13'?'Jev receives structured JSON. A connected OpenRouter key is required.':'Uses your OpenRouter key. Clef routes are pinned to Cloudflare; no provider fallback.';
  }
  function repaint(){
    V.draw($('game'),state);
    $('progress').textContent=E.progress?E.progress(state):Math.min(100,Math.max(0,Math.round((state.player.x-70)/(E.LEVEL.goal-70)*100)))+'%';
    $('coins').textContent=E.coinLabel?E.coinLabel(state):state.coins.filter(c=>c.collected).length+' / '+state.coins.length;
    $('calls').textContent=history.filter(r=>r.source!=='manual').length;
    $('game-time').textContent=(state.frame/E.FPS).toFixed(1)+' s';
    const times=history.filter(r=>!r.error&&(isReplay()?r.source==='replay':r.source!=='replay'&&r.request?.model===mode()&&r.input_kind===$('input').value&&Object.keys(r.request.questions).length===Number($('questions').value))).map(elapsed).filter(x=>typeof x==='number').sort((a,b)=>a-b),n=times.length;
    const median=n?(n%2?times[n>>1]:(times[n/2-1]+times[n/2])/2):null;
    $('median').textContent=median!==null?Math.round(median)+' ms':'—';
    if($('median-label'))$('median-label').textContent=isReplay()?'Recorded median':'Median wait';
    if($('timing-note'))$('timing-note').textContent=isReplay()?'Recorded actions, replayed by the actual game engine. No API requests or inference waits. The speed control changes playback; timings in the inspector are from the original live run.':eventDriven()?'Fewer waits: hold the model’s action for up to 64 frames, asking again at a hazard, landing, apex or blockage. API waits pause game time. Speed controls playback only.':timing()==='realtime'?`Real time: previous buttons stay active while the next answer is pending. ${median!==null?'At this measured median and '+$('speed').value+'×, roughly '+Math.round(median/1000*E.FPS*Number($('speed').value))+' frames can pass per answer. ':'Start at 1×. '}One decision always uses a frozen single step.`:'Classroom: freeze → answer → advance the selected frames. Higher playback speed shortens only the movement, not the API wait.';
    if(pending){const r=pending.record;r.frames_advanced=state.frame-(r.applied_at_frame??r.before.frame);r.applied=r.frames_advanced>0;if(following&&selected===history.indexOf(r))$('answer-time').textContent=answerSummary(r);}
  }
  function requestFor(before,screenshot,clock=timing()){
    const model=mode(),count=Number($('questions').value),input=isImage(),context=C.contextFor?C.contextFor(clock):C.context;
    if(eventDriven())return {model,state:MarioPilot.observe(before),questions:MarioPilot.questions(count)};
    return {model,state:input?[{type:'text',text:context+` Last applied buttons: ${lastAction}. ${clock==='realtime'?'Minimum capture spacing':'Next action duration'}: ${frames()} frames at 60 fps. This screenshot is a scaled view of a ${E.WIDTH||720} × ${E.HEIGHT||405} game viewport; physics distances use those original viewport pixels.`},{type:'image_url',image_url:{url:screenshot}}]:{context,scene:E.observe(before,frames())},questions:C.questions(count)};
  }
  function createRecord(source,clock=timing()){
    const before=E.clone(state),screenshot=V.capture(before,Number($('image-size').value));
    return {id:history.length+1,attempt,source,action_contract:E.actionContract||'platformer-v1',timing_mode:clock,captured_at:new Date().toISOString(),before,scene:E.observe(before,frames()),screenshot,input_kind:source==='manual'||source==='scripted'?'structured':$('input').value,image_sent:isModel()&&isImage(),request:isModel()?requestFor(before,screenshot,clock):null,response:null,metadata:{source,timing_note:source==='manual'?'Human input; no model inference.':'Scripted reference; no model inference.'},action:null,applied:false,frames_requested:frames(),frames_advanced:0,after:null,error:null};
  }
  function addRecord(r){history.push(r);if(following)selected=history.length-1;renderHistory();if(following)inspect(r);repaint();}
  function finishRecord(r){r.after=E.clone(state);r.frames_advanced=state.frame-(r.applied_at_frame??r.before.frame);r.applied=r.frames_advanced>0;if(following){selected=history.indexOf(r);inspect(r);}renderHistory();}
  function pause(note='Paused. The game clock is stopped.'){
    if(busy&&inFlightRecord&&inFlightRecord.cancelled_at_frame==null){inFlightRecord.cancelled_at_frame=state.frame;inFlightRecord.frames_during_inference=state.frame-inFlightRecord.before.frame;}
    running=false;epoch++;keys.clear();
    if(pending){pending.record.outcome='Paused during action playback';finishRecord(pending.record);pending=null;}
    if(manualRecord){finishRecord(manualRecord);manualRecord=null;}
    E.cancelAction?.(state);
    phase=busy?'Waiting · action cancelled':'Paused';message(note);ui();
  }
  function restart(){
    pause();state=E.create();attempt++;runCalls=0;lastAction='wait';accumulator=0;replayIndex=0;
    phase=busy?'Waiting · old answer will be discarded':'Ready';$('scene-message').hidden=true;
    message('Fresh attempt. Previous decisions remain in the history.');repaint();ui();if(!history.length)preview();
  }
  function terminal(){
    running=false;epoch++;phase=state.status==='won'?'Level complete':'Try again';
    $('scene-message').hidden=false;
    $('scene-message').firstElementChild.textContent=state.status==='won'?'Flag reached. Nicely done.':'A useful mistake.';
    $('scene-message').lastElementChild.textContent=state.status==='won'?'Inspect the decisions, export the run, or play again.':state.reason+'. Inspect the last input or press Play again.';
    message(state.status==='won'?'Level complete. This attempt is saved in the history.':state.reason+'. You can restart immediately.');ui();
  }
  async function replayDecision(){
    const original=replayData?.records[replayIndex];
    if(!original||!MarioReplay.sameState(state,original.before)){
      running=false;phase='Replay stopped';message('Replay stopped: the current scene differs from the recording. Press Restart and watch again.');ui();return;
    }
    const r={...E.clone(original),id:history.length+1,attempt,source:'replay',timing_mode:'replay',input_kind:'structured',image_sent:false,
      recorded_id:original.id,replayed_at:new Date().toISOString(),screenshot:V.capture(state,Number($('image-size').value)),
      metadata:{...original.metadata,source:'replay',timing_note:'Recorded round trip from the original live run. No model request was made during this replay.'},
      frames_requested:original.frames_advanced,frames_advanced:0,after:null,applied:false,error:null,applied_at_frame:state.frame};
    E.beginAction?.(state,r.action);runCalls++;addRecord(r);pending={record:r,remaining:r.frames_requested};accumulator=0;
    phase='Replaying recorded answer';message('Recorded Jev answer '+(replayIndex+1)+' / '+replayData.records.length+' · no API call.');ui();
  }
  async function decide(){
    if(busy||loading||(pending&&!continuous())||state.status!=='playing'||runCalls>=LIMIT)return;
    if(isReplay())return replayDecision();
    const source=mode()==='scripted'?'scripted':mode()===LOCAL?'local':'hosted';
    if(source==='hosted'&&!PublicDecisions.connected){running=false;message('Connect your OpenRouter key first.');ui();return;}
    if(source==='local'&&!runtime?.ready(isImage())){running=false;message('Load Liquid for the selected input first.');ui();return;}
    const ticket=epoch,clock=eventDriven()?'events':continuous()?'realtime':'classroom',r=createRecord(source,clock);inFlightRecord=r;busy=true;phase=source==='scripted'?'Reference step':clock==='realtime'?'Live · waiting for answer':'Waiting · simulation frozen';message(source==='scripted'?'Applying the visible reference rules.':clock==='realtime'?'Game time continues. Previous buttons stay active while we wait.':'Waiting for an answer. No game time is passing.');ui();
    try{
      if(source==='scripted'){
        r.action=E.scripted(state);r.response={source:'scripted-reference',action:r.action,note:'Hand-written rules; no learned probabilities or inference latency.'};
      }else{
        const result=source==='local'?await runtime.decide(r.request):await PublicDecisions.submit(r.request);
        Object.assign(r,result);r.metadata.model_load_ms=source==='local'?loadInfo?.load_ms??null:null;
        if(!r.error&&!C.validSavedAnswers(r))r.error='Answer schema is invalid. No action was applied.';
        r.action=r.error?null:r.response.answers.action.choice;
      }
    }catch(e){r.error=source==='local'?'Local inference failed: '+e.message:'Decision failed. No action was applied.';}
    busy=false;if(inFlightRecord===r)inFlightRecord=null;if(r.attempt===attempt)runCalls++;
    r.received_at_frame=r.attempt===attempt?state.frame:null;
    if(r.cancelled_at_frame==null)r.frames_during_inference=r.received_at_frame===null?null:r.received_at_frame-r.before.frame;
    if(ticket!==epoch){r.outcome='Discarded: the attempt stopped, paused or restarted while waiting';addRecord(r);if(state.status==='playing')phase='Paused';ui();return;}
    if(r.error){if(pending){pending.record.outcome='Stopped after next request failed';finishRecord(pending.record);pending=null;}running=false;addRecord(r);phase='Error';message(r.error);ui();return;}
    if(pending){pending.record.outcome='Held until the next model answer arrived';finishRecord(pending.record);}
    r.applied_at_frame=state.frame;r.application_before=E.clone(state);r.frame_age_at_apply=state.frame-r.before.frame;
    r.action_execution=E.beginAction?.(state,r.action)??null;
    addRecord(r);pending={record:r,remaining:r.frames_requested};if(clock!=='realtime')accumulator=0;phase='Applying '+title(r.action).toLowerCase();
    message(source==='scripted'?'Reference action · no model call.':clock==='realtime'?`Holding ${r.action}. Observation was ${r.frame_age_at_apply} frames old when applied.`:`Applying ${r.action} for up to ${r.frames_requested} frames. No corrective override.${eventDriven()?' Earlier observations are triggered by game events.':''}`);$('scene-message').hidden=true;ui();
  }
  function preview(){
    const r=createRecord(isModel()?'preview':mode());r.id=null;inspect(r);
  }
  function answerSummary(r){const ms=elapsed(r);return r.error||(r.action?`${ms===null?'No inference timing':Math.round(ms)+' ms '+(r.source==='replay'?'recorded round trip · no API call now':r.source==='local'?'local inference':'round trip')} · ${r.timing_mode==='realtime'?r.frames_advanced+' frames held · '+(r.frame_age_at_apply??'—')+' frames old at application':r.frames_advanced+'/'+r.frames_requested+' frames applied'}${r.outcome?' · '+r.outcome:''}`:r.outcome||(E.controlsText?'Choose a model, then try one decision.':'Choose a model or the scripted reference to inspect a step.'));}
  function inspect(r){
    $('selected-call').textContent=r.id?`#${r.id} · attempt ${r.attempt}`:'Preview';
    $('answer-source').textContent=r.id?({scripted:'Scripted reference · not AI',manual:'Human controller',local:'Local Liquid · original weights',hosted:'Live hosted decision',replay:'Recorded Jev decision · replay'})[r.source]||r.source:'Preview · not sent';
    $('action').textContent=r.error?'No action applied':r.action?title(r.action):'What happens next?';
    $('answer-time').textContent=answerSummary(r);
    $('input-image').src=r.screenshot;
    $('input-caption').textContent=r.source==='replay'?'Recorded JSON input. This screenshot is reconstructed during replay; no model call.':r.image_sent?'Exact screenshot sent to the model. Scene coordinates are not included.':r.source==='manual'?'Screenshot for inspection. You controlled this step.':r.source==='scripted'?'Screenshot for inspection. The reference rules read game state.':'Screenshot for inspection only. The model receives the JSON below.';
    $('input-json').textContent=JSON.stringify(r.image_sent?r.request.state.filter(p=>p.type==='text'):r.request?.state??r.scene,null,2);
    const qhost=$('question-list');qhost.replaceChildren();
    for(const [name,q] of Object.entries(r.request?.questions??C.questions(Number($('questions').value)))){
      const box=document.createElement('div');box.className='question';const h=document.createElement('h3');h.textContent=name+' · '+q.type;const p=document.createElement('p');p.textContent=q.instructions;box.append(h,p);
      if(q.criteria){const dl=document.createElement('dl');for(const [key,val]of Object.entries(q.criteria)){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=val;dl.append(dt,dd);}box.append(dl);}qhost.append(box);
    }
    if(!r.request){const p=document.createElement('p');p.className='small';p.textContent='These are example model questions. No questions were sent for manual or scripted play.';qhost.prepend(p);}
    const phost=$('probabilities');phost.replaceChildren();const probs=r.response?.answers?.action?.probabilities;
    if(probs){for(const a of Object.keys(r.request.questions.action.criteria)){const row=document.createElement('div');row.className='prob-row';const label=document.createElement('span'),meter=document.createElement('meter'),value=document.createElement('strong');label.textContent=a;meter.min=0;meter.max=1;meter.value=probs[a];meter.setAttribute('aria-label',a+' probability');value.textContent=(probs[a]*100).toFixed(1)+'%';row.append(label,meter,value);phost.append(row);}}
    else {const p=document.createElement('p');p.textContent=r.response?'This controller supplies an action, without model probabilities.':'No answer yet.';phost.append(p);}
    const a=r.response?.answers;const extras=[];if(a?.action?.confidence!=null)extras.push('Confidence: '+a.action.confidence.toFixed(3));if(a?.jump_needed)extras.push('P(jump needed): '+a.jump_needed.noul.toFixed(3));if(a?.danger)extras.push('Danger score: '+a.danger.score.toFixed(3)+' / 2');$('extra-answers').textContent=extras.join(' · ');
    explorer.set(r,(E.exportName||'platformer')+'-decision-'+(r.id||'preview')+'.json');
  }
  function renderHistory(){
    const list=$('history-list');list.replaceChildren();
    const start=Math.max(0,selected-9),end=Math.min(history.length,start+12);
    for(let i=start;i<end;i++){const r=history[i],b=document.createElement('button'),small=document.createElement('small');b.textContent='#'+r.id+' '+(r.action||'error');small.textContent=r.error?'Not applied':r.source==='scripted'?'Reference':r.source==='manual'?'Human':elapsed(r)===null?'—':Math.round(elapsed(r))+' ms';b.append(small);b.setAttribute('aria-pressed',String(i===selected));b.addEventListener('click',()=>select(i));list.append(b);}
    $('timeline').disabled=!history.length;$('timeline').max=Math.max(0,history.length-1);$('timeline').value=Math.max(0,selected);
    $('previous').disabled=selected<=0;$('next').disabled=selected>=history.length-1;
    $('history-label').textContent=history.length?`${selected+1} / ${history.length}`:'No decisions yet';$('export').disabled=!history.length;
  }
  function select(i){if(!history[i])return;following=false;pause('Paused to inspect a saved decision. The scene above stays at the current game position.');selected=i;inspect(history[i]);renderHistory();}
  function tick(now){
    const delta=Math.min((now-lastTick)/1000||0,.05);lastTick=now;
    if((running&&mode()==='manual')||pending||continuous()){
      accumulator+=delta*Number($('speed').value);let iterations=0;
      while(accumulator>=1/E.FPS&&iterations++<60&&state.status==='playing'){
        accumulator-=1/E.FPS;
        let action;
        if(pending)action=pending.record.action;
        else if(continuous())action='wait'; // before the first response
        else if(running&&mode()==='manual'){
          const dir=keys.has('right')?'right':keys.has('left')?'left':'wait';action=E.manualAction?E.manualAction(keys):keys.has('jump')?(dir==='wait'?'jump':dir+'_jump'):dir;
          if(!manualRecord||manualRecord.action!==action||state.frame-manualRecord.before.frame>=frames()){
            if(manualRecord)finishRecord(manualRecord);
            manualRecord=createRecord('manual');manualRecord.action=action;manualRecord.response={source:'human',action};addRecord(manualRecord);
          }
        }else break;
        const beforeStep=eventDriven()?E.clone(state):null;
        E.step(state,action);lastAction=action;for(const event of state.events)sound(event);
        if(state.player.grounded&&state.player.vx&&state.frame%15===0)sound('step');
        if(pending){pending.remaining=Math.max(0,pending.remaining-1);
          if(isReplay()&&(pending.remaining===0||state.status!=='playing')){
            if(!MarioReplay.sameState(state,replayData.records[replayIndex].after)){
              const r=pending.record;r.error='Replay diverged from the recorded scene. Playback stopped.';pending=null;running=false;finishRecord(r);phase='Replay stopped';message(r.error);ui();break;
            }
            replayIndex++;
          }
          const boundary=eventDriven()?MarioPilot.boundary(beforeStep,state,action,state.frame-pending.record.applied_at_frame):null;
          if(boundary){pending.remaining=0;pending.record.observation_trigger=boundary;}
          if(state.status!=='playing'||(pending.remaining===0&&(!continuous()||runCalls>=LIMIT))){
            const r=pending.record;pending=null;r.outcome=state.status==='playing'?(r.observation_trigger?'Model action ended at '+r.observation_trigger:'Applied exactly as returned'):state.status==='won'?'Reached the flag':state.reason;finishRecord(r);
            if(state.status!=='playing')terminal();
            else if(running&&runCalls<LIMIT){queueDecision();}
            else{running=false;phase='Paused';message(runCalls>=LIMIT?'Stopped at 200 decisions for this attempt. Export the run, then start a new attempt.':'One decision complete. Inspect the input and answer.');ui();}
            break;
          }
          if(continuous()&&pending.remaining===0&&!busy)queueDecision();
        }
        if(state.status!=='playing'){if(manualRecord){finishRecord(manualRecord);manualRecord=null;}terminal();break;}
      }
      repaint();
    }else accumulator=0;
    requestAnimationFrame(tick);
  }
  $('run').addEventListener('click',async()=>{
    audioInit();if(running||pending){pause();return;}
    if(isReplay()){
      restart();const ticket=epoch;loading=true;phase='Loading recording';ui();
      try{replayData=await MarioReplay.load(E,C);}catch(e){message(e.message);phase='Replay unavailable';return;}
      finally{loading=false;ui();}
      if(ticket!==epoch)return;
    }
    if(state.status!=='playing'||runCalls>=LIMIT)restart();running=true;following=true;phase=mode()==='manual'?'Playing':'Starting';$('scene-message').hidden=true;ui();
    if(mode()==='manual'){message(E.controlsText||'Arrow keys / A D to move; Space / ↑ to jump.');$('game').focus();}else decide();
  });
  $('step').addEventListener('click',()=>{audioInit();following=true;decide();});$('restart').addEventListener('click',restart);
  $('controller').addEventListener('change',()=>{if(!isReplay()&&timing()==='replay')$('timing').value='events';if(isReplay()){$('level').value='1-1';$('level-title').textContent='World 1-1';E.LEVEL={...E.LEVEL,name:'1-1'};$('input').value='structured';restart();}if(mode()===LOCAL&&timing()==='events')$('timing').value='classroom';pause();if(textOnly())$('input').value='structured';else if(eventDriven())$('input').value='structured';else if(DecisionModels.isVisionJev(mode()))$('input').value='image';modelNote();ui();repaint();preview();});
  if($('timing'))$('timing').addEventListener('change',()=>{pause();if(timing()==='realtime')$('speed').value='1';if(eventDriven())$('input').value='structured';message(timing()==='realtime'?'Real time selected at 1×. The game will keep moving while answers are pending.':eventDriven()?'Jev-style JSON selected. Observations follow game events; API waits freeze the world.':'Classroom selected. The world freezes while waiting for each answer.');ui();modelNote();repaint();preview();});
  $('speed').addEventListener('change',repaint);
  for(const id of ['input','questions','frames','image-size'])$(id).addEventListener('change',()=>{modelNote();ui();repaint();preview();});
  $('load-local').addEventListener('click',async()=>{
    loading=true;phase='Loading Liquid';ui();message('Loading the original Liquid model; simulation is paused.');
    try{runtime ||= await import('./local-runtime/liquid.mjs?v=liquid-finetuned-1');loadInfo=await runtime.load({image:isImage(),model:LOCAL,progress:t=>$('model-note').textContent=t});phase='Ready';message('Liquid is ready. Try one decision first.');modelNote();}
    catch(e){phase='Load failed';message(e.message);$('model-note').textContent='Local loading failed. Check WebGPU support and free memory.';}
    finally{loading=false;ui();}
  });
  $('unload-local').addEventListener('click',async()=>{try{await runtime?.dispose();runtime=null;loadInfo=null;modelNote();ui();message('Local weights unloaded from GPU memory.');}catch(e){message(e.message);}});
  $('latest').addEventListener('click',()=>{following=true;selected=history.length-1;if(selected>=0)inspect(history[selected]);renderHistory();});
  $('timeline').addEventListener('input',e=>select(Number(e.target.value)));$('previous').addEventListener('click',()=>select(selected-1));$('next').addEventListener('click',()=>select(selected+1));
  $('export').addEventListener('click',()=>{
    const data={format:(E.exportName||'pocket-pilot-platformer')+'-v'+(E.exportVersion||1),exported_at:new Date().toISOString(),level:E.LEVEL,physics:{fps:E.FPS,speed:E.SPEED,gravity:E.GRAVITY,jump:E.JUMP},note:'Local game snapshots are inspection data. Only request.state is sent for model inference. Human and scripted traces are explicitly labelled.',records:history};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=(E.exportName||'pocket-pilot-platformer')+'-run.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-tab]').forEach(x=>{const active=x===b;x.setAttribute('aria-selected',String(active));$('panel-'+x.dataset.tab).hidden=!active;});}));
  const keyMap=E.keyMap||{ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowUp:'jump',w:'jump',W:'jump',' ':'jump'};
  if($('level'))$('level').addEventListener('change',()=>{E.LEVEL={...E.LEVEL,name:$('level').value};restart();$('level-title').textContent='World '+$('level').value;});
  for(const id of ['sound','volume'])$(id).addEventListener('input',syncAudio);
  window.addEventListener('keydown',e=>{if(E.controlsText&&/^[pP]$/.test(e.key)&&!/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)){e.preventDefault();if(!e.repeat)$('run').click();return;}if(!running||mode()!=='manual'||/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;const k=keyMap[e.key];if(k){e.preventDefault();keys.add(k);}});
  window.addEventListener('keyup',e=>{const k=keyMap[e.key];if(k){keys.delete(k);if(running&&mode()==='manual')e.preventDefault();}});
  document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{if(!running||mode()!=='manual')return;e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.key));});
  if(E.controlsText)$('game').addEventListener('contextmenu',e=>{e.preventDefault();$('run').click();});
  window.addEventListener('blur',()=>keys.clear());
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&(running||pending||busy))pause('Paused because this tab was hidden.');});
  window.addEventListener('public-connection-changed',()=>{if(!PublicDecisions.connected&&busy&&mode()!==LOCAL)pause('Disconnected. The pending answer will not move the player.');});
  window.addEventListener('pagehide',()=>pause());
  if(globalThis.MarioReplay&&new URLSearchParams(location.search).get('demo')==='jev'){$('controller').value='replay';$('input').value='structured';$('speed').value='16';}
  modelNote();ui();repaint();preview();requestAnimationFrame(tick);
})();
