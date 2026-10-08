/* Lazy local adapters. No API key, inference upload, or download at page load. */
(function(root){
  const models=[
    {id:'Nipun/pocket-pilot-json-decisions-0.8b',label:'Pocket Pilot · trained JSON · local WebGPU',vision:false,api_kind:'local decisions',provider:'Pocket Pilot · on device',available:true,download:'1.4 GB',results:'https://huggingface.co/Nipun/pocket-pilot-json-decisions-0.8b',note:'Trained for this road. JSON input only; image checkpoint is a separate experiment.'},
    {id:'LiquidAI/d1-omni-600M',label:'Liquid 600M · original · not fine-tuned',vision:true,api_kind:'local decisions',provider:'Liquid AI · on device',available:true,results:'./liquid-local.html',note:'Original Liquid checkpoint, not fine-tuned for this road. Both image and JSON inputs are available.'},
    {id:'Nipun/pocket-pilot-liquid-600m-json',label:'Liquid 600M · fine-tuned JSON · WebGPU',vision:false,input_kind:'structured',api_kind:'local decisions',provider:'Liquid fine-tune · on device',available:true,download:'410 MB',results:'./liquid-finetuned.html',note:'Fine-tuned for road JSON. Separate weights from the image model; no image is sent.'},
    {id:'Nipun/pocket-pilot-liquid-600m-image',label:'Liquid 600M · fine-tuned image · WebGPU',vision:true,input_kind:'image',api_kind:'local decisions',provider:'Liquid fine-tune · on device',available:true,download:'600 MB',results:'./liquid-finetuned.html',note:'Fine-tuned on road screenshots. Reads pixels; no obstacle coordinates or corrected answers.'}
  ];
  let runtime=null,active=null,loading=false,lastLoad=null,message='Load once from Hugging Face; decisions then stay on this device.';
  const notify=()=>root.dispatchEvent(new Event('local-model-changed'));
  const info=id=>models.find(m=>m.id===id);
  const api={models,model:models[1],info,isLocal:id=>!!info(id),get loading(){return loading;},get message(){return message;},get lastLoad(){return lastLoad;},
    ready:(image,id=active)=>active===id&&!!runtime?.ready(image),
    async load(image,id=models[1].id){
      if(loading)throw new Error('A local model operation is already running.');
      const selected=info(id);if(!selected)throw new Error('Unsupported local model.');
      if(image&&!selected.vision)throw new Error('Choose structured JSON for this trained checkpoint.');
      if(selected.input_kind==='image'&&!image)throw new Error('Choose image input for this Liquid fine-tune.');
      loading=true;message='Opening local runtime…';notify();
      try{
        if(active!==id){await runtime?.dispose();runtime=null;active=null;lastLoad=null;}
        runtime ||= await (id===models[0].id?import('./trained-runtime/pilot.mjs'):import('./local-runtime/liquid.mjs?v=liquid-finetuned-1'));
        active=id;lastLoad=await runtime.load({image,model:id,progress:s=>{message=s;notify();}});
        message=`Ready · loaded in ${(lastLoad.load_ms/1000).toFixed(1)} s · decisions stay here`;
      }catch(e){message='Local model unavailable: '+e.message;throw e;}
      finally{loading=false;notify();}
    },
    async submit(request){
      if(!api.isLocal(request.model)||active!==request.model||!runtime)throw new Error('Load the selected local model first.');
      const result=await runtime.decide(request);
      if(!root.RoadQuestions.validSavedAnswers({request,response:result.response}))throw new Error('Local model returned an invalid answer schema.');
      result.metadata.model_load_ms=lastLoad?.load_ms??null;
      return result;
    },
    async unload(){
      if(loading)throw new Error('Wait for the current model operation.');
      loading=true;notify();
      try{await runtime?.dispose();runtime=null;active=null;lastLoad=null;message='Unloaded from memory. Download cache is kept for next time.';}
      finally{loading=false;notify();}
    }
  };
  root.LocalDecisions=api;
})(globalThis);
