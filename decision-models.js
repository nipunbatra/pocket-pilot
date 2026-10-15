/* Model-specific transport and image limits; no credentials or gameplay rules. */
(function(root){
  'use strict';
  const latest='~typesafe/jev-latest',pinned='typesafe/jev-1.14';
  const isVisionJev=model=>model===latest||model===pinned;
  function imageSizeAllowed(model,width,height){
    return !isVisionJev(model)||(width>=256&&height>=256&&width<=1568&&height<=1568&&width*height>=78400&&width*height<=2458624);
  }
  function constrainImageSelect(select,model,ratio){
    const options=Array.from(select.options||[]);
    for(const option of options)option.disabled=!imageSizeAllowed(model,Number(option.value),Math.round(Number(option.value)*ratio));
    if(options.some(o=>o.value===select.value&&o.disabled))select.value=options.find(o=>!o.disabled)?.value||select.value;
    return Number(select.value);
  }
  function wireRequest(request){
    if(!isVisionJev(request.model)||!Array.isArray(request.state))return request;
    // OpenRouter's Decisions image schema uses plain strings for text parts.
    return {...request,state:request.state.map(p=>p?.type==='text'?p.text:p)};
  }
  const api={latest,pinned,isVisionJev,imageSizeAllowed,constrainImageSelect,wireRequest};
  if(typeof module!=='undefined')module.exports=api;else root.DecisionModels=api;
})(globalThis);
