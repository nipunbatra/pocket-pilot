/* Lazy local adapters. No API key, inference upload, or download at page load. */
(function(root){
  const models=[
    {id:'Nipun/pocket-pilot-json-decisions-0.8b',label:'Pocket Pilot · trained JSON · local WebGPU',vision:false,api_kind:'local decisions',provider:'Pocket Pilot · on device',available:true,download:'1.4 GB',results:'https://huggingface.co/Nipun/pocket-pilot-json-decisions-0.8b',note:'Trained for this road. JSON input only; image checkpoint is a separate experiment.'},
    {id:'LiquidAI/d1-omni-600M',label:'Liquid 600M · local WebGPU · experimental',vision:true,api_kind:'local decisions',provider:'Liquid AI · on device',available:true,results:'./liquid-local.html',note:'Follow-up image check: 6/18 lanes correct. Compare accuracy as well as speed.'}
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
      loading=true;message='Opening local runtime…';notify();
      try{
        if(active!==id){await runtime?.dispose();runtime=null;active=null;lastLoad=null;}
        runtime ||= await (id===models[0].id?import('./trained-runtime/pilot.mjs'):import('./local-runtime/liquid.mjs'));
        active=id;lastLoad=await runtime.load({image,progress:s=>{message=s;notify();}});
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
