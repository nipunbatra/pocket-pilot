/* Lazy local adapter. No API key, inference fetch, or model download at page load. */
(function(root){
  const model={id:'LiquidAI/d1-omni-600M',label:'Liquid 600M · local WebGPU · experimental',vision:true,api_kind:'local decisions',provider:'Liquid AI · on device',available:true};
  let runtime=null,loading=false,lastLoad=null,message='Load once from Hugging Face; decisions then stay on this device.';
  const notify=()=>root.dispatchEvent(new Event('local-model-changed'));
  const api={model,isLocal:id=>id===model.id,get loading(){return loading;},get message(){return message;},get lastLoad(){return lastLoad;},
    ready:image=>!!runtime?.ready(image),
    async load(image){
      if(loading)return;loading=true;message='Opening local runtime…';notify();
      try{runtime ||= await import('./local-runtime/liquid.mjs');lastLoad=await runtime.load({image,progress:s=>{message=s;notify();}});message=`Ready · loaded in ${(lastLoad.load_ms/1000).toFixed(1)} s · experimental accuracy`;}
      catch(e){message='Local model unavailable: '+e.message;throw e;}
      finally{loading=false;notify();}
    },
    async submit(request){
      if(!api.isLocal(request.model))throw new Error('Unsupported local model.');
      const result=await runtime.decide(request);
      if(!root.RoadQuestions.validSavedAnswers({request,response:result.response}))throw new Error('Local model returned an invalid answer schema.');
      result.metadata.model_load_ms=lastLoad?.load_ms??null;
      return result;
    },
    async unload(){loading=true;notify();try{await runtime?.dispose();message='Unloaded from memory. Download cache is kept for next time.';}finally{loading=false;notify();}}
  };
  root.LocalDecisions=api;
})(globalThis);
