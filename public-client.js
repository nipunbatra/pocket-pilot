/* Browser-only transport. The key lives in this closure, never in a saved trace. */
(function(root){
  'use strict';
  const decisionsEndpoint='https://openrouter.ai/api/alpha/decisions';
  let key='',active=null;
  function connect(value){
    if(typeof value!=='string'||value.trim().length<20||value.length>512||/\s/.test(value.trim()))throw new Error('Enter a valid OpenRouter API key.');
    if(active)throw new Error('Wait for the current request before changing the key.');
    key=value.trim();
  }
  function disconnect(){key='';if(active)active.abort();}
  async function submit(request){
    if(!key)throw new Error('Connect your OpenRouter key to make live calls.');
    if(active)throw new Error('A decision is already in progress.');
    const info=root.POCKET_PILOT_PUBLIC.road_models.find(m=>m.id===request.model);
    if(!info)throw new Error('Unsupported model.');
    if(info.vision===false&&Array.isArray(request.state)&&request.state.some(p=>p.type==='image_url'))throw new Error('This model accepts text / JSON only. Select structured scene input.');
    const chat=root.RoadChat?.isChat(request),endpoint=chat?root.RoadChat.endpoint:decisionsEndpoint;
    const pinnedProvider=['cloudflare/clef','cloudflare/clef-flash'].includes(request.model)?'Cloudflare':null;
    const wire_request=chat?root.RoadChat.build(request):pinnedProvider?{...request,provider:{only:['cloudflare'],allow_fallbacks:false}}:request;
    const controller=new AbortController();active=controller;
    const timer=setTimeout(()=>controller.abort(),30000),started=performance.now();
    const metadata={source:'live',endpoint,provider:'OpenRouter',timing_origin:'browser',transport:'browser directly to OpenRouter',
      started_at:new Date().toISOString(),http_status:null,upstream_round_trip_ms:null,provider_processing_ms:null,local_handler_ms:null,
      timing_note:'Measured in this browser, from the outgoing OpenRouter request through its complete response. Network and routing are included. There is no app server hop. Provider-only processing time was not supplied.'};
    metadata.api_kind=chat?'chat completions':'decisions';
    metadata.requested_provider=pinnedProvider;metadata.actual_provider=null;
    let response=null,raw_response=null,error=null;
    try{
      const res=await fetch(endpoint,{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
        body:JSON.stringify(wire_request),signal:controller.signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store'});
      metadata.http_status=res.status;
      if(!res.ok){
        error=`OpenRouter returned HTTP ${res.status}. `+({401:'The key was not accepted.',402:'This key has no available credits.',403:'This key cannot access the selected model.',429:'Rate limited; wait before trying again.'}[res.status]||'No move was applied.');
      }else{
        raw_response=await res.json();
        if(chat){try{response=root.RoadChat.normalize(raw_response,request);}catch(exc){error=exc.message;}}
        else response=raw_response;
        metadata.actual_provider=raw_response?.provider??null;
        if(pinnedProvider&&metadata.actual_provider!==pinnedProvider)error='The requested Cloudflare provider was not confirmed. No move was applied.';
        if(!chat&&(!response||typeof response!=='object'||Array.isArray(response)||!(root.DecisionContract||root.RoadQuestions).validSavedAnswers({request,response})))
          error='The response did not match the requested answer schema. No move was applied.';
      }
    }catch(exc){
      // Never echo arbitrary network/provider text: it could contain request details.
      error=controller.signal.aborted?'Request stopped or timed out. It was not retried; OpenRouter may still charge for an accepted request.':'OpenRouter could not be reached. Check your connection and try again.';
    }finally{
      clearTimeout(timer);active=null;metadata.upstream_round_trip_ms=Number((performance.now()-started).toFixed(2));
    }
    return {request,wire_request,response,raw_response,metadata,error,openai_preview:null};
  }
  const api={config:root.POCKET_PILOT_PUBLIC,get connected(){return !!key;},connect,disconnect,submit};
  root.PublicDecisions=api;
  if(!root.document)return;
  const byId=id=>root.document.getElementById(id);
  function refresh(){
    byId('key-form').hidden=api.connected;byId('key-connected').hidden=!api.connected;
    root.dispatchEvent(new Event('public-connection-changed'));
  }
  byId('key-form').addEventListener('submit',event=>{
    event.preventDefault();const field=byId('visitor-key');
    try{connect(field.value);field.value='';byId('key-error').textContent='';refresh();}
    catch(exc){field.value='';byId('key-error').textContent=exc.message;}
  });
  byId('disconnect-key').addEventListener('click',()=>{disconnect();byId('visitor-key').value='';refresh();});
  byId('visitor-key').disabled=false;byId('connect-key').disabled=false;
  // Clear the key when navigating away, including a back/forward-cache suspension.
  root.addEventListener('pagehide',()=>{disconnect();byId('visitor-key').value='';});
  root.addEventListener('pageshow',refresh);
})(globalThis);
