// Cloudflare Clef schema encoding, matching the pinned Unsloth training encoder.
export const MODEL='Nipun/pocket-pilot-json-decisions-0.8b';
export const TYPES={noul:0,choice:1,score:2};
const SYSTEM='Read the complete state and schema. Decide every field jointly. Each answer must be exactly one of that field\'s allowed options.';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const render=v=>typeof v==='string'?v:JSON.stringify(canonical(v));
export function options(q){
  if(q.type==='noul')return Object.entries({true:'The proposition is true or the answer is yes.',false:'The proposition is false or the answer is no.',...(q.criteria||{})});
  if(q.type==='choice')return Object.keys(q.criteria).sort().map(k=>[k,q.criteria[k]]);
  if(q.type==='score')return q.criteria.map((v,i)=>[String(i),v]);
  throw new Error('Unsupported decision type.');
}
export function encode(tokenizer,state,questions){
  const text=s=>tokenizer.encode(s,{add_special_tokens:false}),schema=[...text('\n\nSCHEMA FIELDS:\n')],fields=[];
  const entries=Object.entries(questions);
  if(entries.length<1||entries.length>3)throw new Error('This browser export supports one to three questions.');
  for(const [index,[id,q]] of entries.entries()){
    if(!(q.type in TYPES))throw new Error('Unsupported decision type.');
    schema.push(...text(`\nFIELD ${index+1}\nID: ${id}\nTYPE: ${q.type}\nINSTRUCTION: `));
    const start=schema.length;schema.push(...text(render(q.instructions||id)));const end=schema.length;
    schema.push(...text('\nALLOWED OPTIONS:\n'));
    const spans=[],ids=[];
    for(const [i,[key,description]] of options(q).entries()){
      schema.push(...text(`OPTION ${i+1}: `));const begin=schema.length;
      schema.push(...text(render({option_id:key,...(description==null?{}:{description})})));
      spans.push([begin,schema.length]);ids.push(key);schema.push(...text('\n'));
    }
    if(q.type!==['choice','noul','score'][index]||ids.length!==[3,2,3][index])throw new Error('Use the road schema: lane choice, then middle-blocked probability, then vertical score.');
    schema.push(...text('END FIELD\n'));fields.push({id,type:TYPES[q.type],span:[start,end],options:ids,option_spans:spans});
  }
  const prefix=text(`<|im_start|>system\n${SYSTEM}<|im_end|>\n<|im_start|>user\nSTATE:\n`),stateIds=text(render(state));
  const suffix=text('\n<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\nJOINT SCHEMA DECISIONS:');
  const offset=prefix.length+stateIds.length;
  const ids=[...prefix,...stateIds,...schema,...suffix];
  if(ids.length>1024)throw new Error('Input exceeds the trained 1,024-token limit; no truncation was applied.');
  for(const q of fields){q.span=q.span.map(x=>x+offset);q.option_spans=q.option_spans.map(p=>p.map(x=>x+offset));}
  return {ids,fields};
}
export function pools(packed){
  const n=packed.ids.length,q=packed.fields.length,p=packed.fields.reduce((s,f)=>s+f.options.length,0);
  const question_pool=new Float32Array(q*n),option_pool=new Float32Array(p*n),owner=[],types=[],option_index=new BigInt64Array(q*3),option_valid=new Uint8Array(q*3);let cursor=0;
  packed.fields.forEach((f,i)=>{
    const [start,end]=f.span;question_pool.fill(1/(end-start),i*n+start,i*n+end);types.push(BigInt(f.type));
    f.option_spans.forEach(([start,end],j)=>{option_pool.fill(1/(end-start),cursor*n+start,cursor*n+end);owner.push(BigInt(i));option_index[i*3+j]=BigInt(cursor++);option_valid[i*3+j]=1;});
  });
  return {question_pool:{data:question_pool,dims:[q,n],type:'float32'},option_pool:{data:option_pool,dims:[p,n],type:'float32'},owner:{data:BigInt64Array.from(owner),dims:[p],type:'int64'},types:{data:BigInt64Array.from(types),dims:[q],type:'int64'},option_index:{data:option_index,dims:[q,3],type:'int64'},option_valid:{data:option_valid,dims:[q,3],type:'bool'}};
}
export function decode(questions,packed,logits,config){
  const answers={};const typeIndex={choice:0,score:1,noul:2};
  packed.fields.forEach((field,i)=>{
    const q=questions[field.id],temperature=config.temperature[typeIndex[q.type]]||1;
    const z=Array.from(logits.slice(i*3,i*3+field.options.length)).map(x=>x/temperature),max=Math.max(...z),e=z.map(x=>Math.exp(x-max)),sum=e.reduce((a,b)=>a+b,0),p=e.map(x=>x/sum);
    if(!p.every(Number.isFinite))throw new Error('Non-finite decision scores.');
    const best=p.indexOf(Math.max(...p)),probabilities=Object.fromEntries(field.options.map((k,j)=>[k,p[j]]));
    if(q.type==='noul')answers[field.id]={type:'noul',noul:probabilities.true};
    else if(q.type==='choice')answers[field.id]={type:'choice',choice:field.options[best],confidence:p[best],probabilities};
    else answers[field.id]={type:'score',score:p.reduce((s,x,j)=>s+x*j,0),confidence:p[best],probabilities,legend:Object.fromEntries(q.criteria.map((x,j)=>[j,render(x)]))};
  });
  return answers;
}
