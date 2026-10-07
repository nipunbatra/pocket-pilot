/* Standard chat completions: short answers, no invented Decisions probabilities. */
(function(root){
  'use strict';
  const models=['openai/gpt-4.1','openai/gpt-4.1-mini'];
  const comparisonModels=['openai/gpt-6-luna-decisions',...models];
  const endpoint='https://openrouter.ai/api/v1/chat/completions';
  const system='Answer the road questions from the supplied input. Return only the requested JSON. Do not explain your reasoning. Lane is the opening, middle_blocked is a boolean, and proximity is a single level index (0 top, 1 middle, 2 bottom).';
  const isChat=request=>models.includes(request?.model);
  function build(request){
    const properties={};
    for(const [name,q] of Object.entries(request.questions))properties[name]={...(name==='lane'?{type:'string',enum:['left','middle','right']}:name==='middle_blocked'?{type:'boolean'}:{type:'integer',enum:[0,1,2]}),description:q.instructions+(q.criteria?' Criteria: '+JSON.stringify(q.criteria):'')};
    return {model:request.model,messages:[{role:'system',content:system},{role:'user',content:Array.isArray(request.state)?request.state:JSON.stringify(request.state)}],
      response_format:{type:'json_schema',json_schema:{name:'road_answers',strict:true,schema:{type:'object',properties,required:Object.keys(properties),additionalProperties:false}}},
      temperature:0,max_tokens:120,stream:false,provider:{require_parameters:true}};
  }
  function normalize(raw,request){
    const choice=raw?.choices?.[0];
    if(choice?.finish_reason!=='stop'||choice.message?.refusal||typeof choice.message?.content!=='string')throw Error('Chat response was incomplete or refused. No move was applied.');
    let values;try{values=JSON.parse(choice.message.content);}catch{throw Error('Chat response was not valid JSON. No move was applied.');}
    const names=Object.keys(request.questions);
    if(!values||Array.isArray(values)||Object.keys(values).length!==names.length||!names.every(n=>Object.hasOwn(values,n))||
      !['left','middle','right'].includes(values.lane)||('middle_blocked' in values&&typeof values.middle_blocked!=='boolean')||
      ('proximity' in values&&![0,1,2].includes(values.proximity)))throw Error('Chat response did not match the answer schema. No move was applied.');
    const answers={lane:{type:'choice',choice:values.lane,probabilities:null,confidence:null}};
    if('middle_blocked' in values)answers.middle_blocked={type:'boolean',value:values.middle_blocked};
    if('proximity' in values)answers.proximity={type:'level',level:values.proximity};
    const usage=raw.usage||{};
    return {id:raw.id,model:raw.model,provider:raw.provider,answers,usage:{input_tokens:usage.prompt_tokens??null,output_tokens:usage.completion_tokens??null,cost:usage.cost??null},
      answer_origin:'App-parsed chat JSON. No class probabilities or confidence were returned. Inspect raw_response for the untouched provider response.'};
  }
  function validFrame(f){
    if(!isChat(f.request))return false;
    if(!f.response||f.error)return true;
    try{return JSON.stringify(normalize(f.raw_response,f.request).answers)===JSON.stringify(f.response.answers);}catch{return false;}
  }
  function summarize(frames){
    const groups=new Map();
    frames.filter(f=>f.model_comparison_id).forEach(f=>{if(!groups.has(f.model_comparison_id))groups.set(f.model_comparison_id,[]);groups.get(f.model_comparison_id).push(f);});
    const paired=[...groups.values()].filter(g=>g.length===comparisonModels.length&&comparisonModels.every(m=>g.filter(f=>f.request.model===m).length===1)&&g.every(f=>f.application.status!=='pending'&&f.input_kind===g[0].input_kind&&JSON.stringify(f.request.state)===JSON.stringify(g[0].request.state)&&JSON.stringify(f.request.questions)===JSON.stringify(g[0].request.questions)&&JSON.stringify(f.scene)===JSON.stringify(g[0].scene)&&f.metadata.timing_origin===g[0].metadata.timing_origin));
    const buckets=new Map();
    for(const group of paired){const f=group[0],label=`${f.input_kind==='structured'?'JSON':f.image_width+'px image'} · ${Object.keys(f.request.questions).length}Q · ${f.metadata.timing_origin==='browser'?'browser':'local server'}`;if(!buckets.has(label))buckets.set(label,[]);buckets.get(label).push(...group);}
    const median=a=>{a=a.filter(Number.isFinite).sort((x,y)=>x-y);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2:null;};
    return [...buckets].map(([label,all])=>({label,pairs:all.length/3,rows:comparisonModels.map(model=>{const set=all.filter(f=>f.request.model===model),ok=set.filter(f=>!f.error&&['left','middle','right'].includes(f.response?.answers?.lane?.choice));return {model,attempts:set.length,correct:ok.filter(f=>!f.scene.row.blocked.includes(['left','middle','right'].indexOf(f.response.answers.lane.choice))).length,errors:set.length-ok.length,median_ms:median(ok.map(f=>f.metadata.upstream_round_trip_ms)),output_tokens:median(ok.map(f=>f.response.usage?.output_tokens))};})}));
  }
  const api={models,comparisonModels,endpoint,isChat,build,normalize,validFrame,summarize};
  if(typeof module!=='undefined')module.exports=api;else root.RoadChat=api;
})(typeof window==='undefined'?globalThis:window);
