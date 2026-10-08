import * as ort from '../local-runtime/node_modules/onnxruntime-web/dist/ort.webgpu.min.mjs';
import {PreTrainedTokenizer} from '../local-runtime/node_modules/@huggingface/transformers/src/tokenization_utils.js';
import {MODEL,encode,pools,decode} from './contract.mjs';

ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths=new URL('../local-runtime/',import.meta.url).href;
let tokenizer,config,embedding,halfValues,decoder,heads={},loading,busy=false,base,revision,device;
let headWeights;
const rowCache=new Map();
const round=n=>Math.round(n*100)/100;
async function readFile(name,progress){
  const url=base+name;let cache;
  try{cache=await caches.open('pocket-pilot-trained-'+revision);}catch{}
  let response=await cache?.match(url);
  if(response)progress?.('Cached: '+name);
  else{
    response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok)throw new Error(`Model download failed (${response.status}): ${name}`);
    const total=Number(response.headers.get('content-length')),reader=response.body.getReader(),chunks=[];let received=0,last=0;
    for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.length;if(performance.now()-last>300){progress?.(`${name}: ${Math.round(received/1e6)}${total?'/'+Math.round(total/1e6):''} MB`);last=performance.now();}}
    const bytes=new Uint8Array(received);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    response=new Response(bytes);try{await cache?.put(url,response.clone());}catch{progress?.('Browser cache is full; this download will be used for this tab.');}
  }
  if(name.endsWith('.gz'))response=new Response(response.body.pipeThrough(new DecompressionStream('gzip')));
  return new Uint8Array(await response.arrayBuffer());
}
async function head(count,progress){
  if(heads[count])return heads[count];
  headWeights ||= await readFile('head.onnx_data.gz',progress);
  progress?.(`Preparing ${count}-question decision head`);
  heads[count]=await ort.InferenceSession.create(await readFile(`head_${count}.onnx`,progress),{executionProviders:['webgpu'],externalData:[{path:'head.onnx_data',data:headWeights}],graphOptimizationLevel:'all'});
  return heads[count];
}
export async function load({image=false,questions=3,progress,baseURL,modelRevision}={}){
  if(image)throw new Error('The trained JSON checkpoint accepts structured scenes. Choose JSON input.');
  if(loading)await loading;
  const started=performance.now();
  loading=(async()=>{
    if(!navigator.gpu)throw new Error('WebGPU is unavailable in this browser.');
    if(!base){
      let manifest;
      if(!baseURL)manifest=await (await fetch(new URL('./model-manifest.json',import.meta.url))).json();
      revision=modelRevision||manifest?.revision||'local-test';base=baseURL||`https://huggingface.co/${MODEL}/resolve/${revision}/browser/`;
      const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
      if(!adapter)throw new Error('No WebGPU adapter is available.');
      if(!adapter.features.has('shader-f16'))throw new Error('This model needs a WebGPU device with float16 shader support.');
      device={vendor:adapter.info?.vendor||'unknown',architecture:adapter.info?.architecture||'unknown',description:adapter.info?.description||'',shader_f16:true};
    }
    const json=async name=>JSON.parse(new TextDecoder().decode(await readFile(name,progress)));
    if(!tokenizer){tokenizer=new PreTrainedTokenizer(await json('tokenizer.json'),await json('tokenizer_config.json'));config=await json('unsloth_decision_config.json');}
    if(!embedding){
      const bytes=await readFile('embedding.f16.bin.gz',progress);embedding=new Uint16Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/2);
      halfValues=new Float32Array(65536);
      for(let i=0;i<65536;i++){const sign=i&0x8000?-1:1,exp=(i>>10)&31,mant=i&1023;halfValues[i]=sign*(exp===0?mant*2**-24:exp===31?(mant?NaN:Infinity):(1+mant/1024)*2**(exp-15));}
    }
    if(!decoder){
      const graph=await readFile('decoder_optimized_fp16.onnx',progress),weights=await readFile('decoder_fp16.onnx_data.gz',progress);
      progress?.('Preparing the trained backbone on WebGPU');
      decoder=await ort.InferenceSession.create(graph,{executionProviders:['webgpu'],externalData:[{path:'decoder_fp16.onnx_data',data:weights}],graphOptimizationLevel:'all',preferredOutputLocation:{hidden_states:'gpu-buffer'}});
    }
    for(const count of [questions,...[1,2,3].filter(n=>n!==questions)])await head(count,progress);
  })();
  try{await loading;progress?.('Ready · trained decisions stay on this device');return{load_ms:round(performance.now()-started),device,revision};}finally{loading=null;}
}
function embeddings(ids){
  const data=new Float32Array(ids.length*1024);
  ids.forEach((id,i)=>{
    if(id<0||(id+1)*1024>embedding.length)throw new Error('Token is outside the trained vocabulary.');
    let row=rowCache.get(id);
    if(!row){row=new Float32Array(1024);for(let j=0;j<1024;j++)row[j]=halfValues[embedding[id*1024+j]];if(rowCache.size<4096)rowCache.set(id,row);}
    data.set(row,i*1024);
  });
  return new ort.Tensor('float32',data,[1,ids.length,1024]);
}
const zeros={};
function zero(type,dims){const key=type+':'+dims.join(',');return zeros[key] ||= new ort.Tensor(type,type==='float16'?new Uint16Array(dims.reduce((a,b)=>a*b,1)):new Float32Array(dims.reduce((a,b)=>a*b,1)),dims);}
export async function decide(request){
  if(busy)throw new Error('A local decision is already running.');
  if(!decoder||!tokenizer)throw new Error('Load the trained model first.');
  if(!request.state||typeof request.state!=='object'||Array.isArray(request.state))throw new Error('This checkpoint accepts the structured road JSON, not an image.');
  busy=true;let hidden,emb;
  const started=performance.now();
  try{
    const packed=encode(tokenizer,request.state,request.questions),n=packed.ids.length,count=packed.fields.length;
    const activeHead=await head(count);
    emb=embeddings(packed.ids);
    const positions=BigInt64Array.from({length:3*n},(_,i)=>BigInt(i%n));
    const feed={inputs_embeds:emb,attention_mask:new ort.Tensor('int64',new BigInt64Array(n).fill(1n),[1,n]),position_ids:new ort.Tensor('int64',positions,[3,1,n])};
    for(const name of decoder.inputNames){
      if(name in feed)continue;
      if(name.startsWith('past_key_values'))feed[name]=zero('float16',[1,2,0,256]);
      else if(name.startsWith('past_conv'))feed[name]=zero('float16',[1,6144,3]);
      else if(name.startsWith('past_recurrent'))feed[name]=zero('float16',[1,16,128,128]);
      else throw new Error('Unexpected model input: '+name);
    }
    const preprocess=performance.now()-started,t=performance.now();
    hidden=(await decoder.run(feed,['hidden_states'])).hidden_states;
    const headInputs=Object.fromEntries(Object.entries(pools(packed)).map(([k,v])=>[k,new ort.Tensor(v.type,v.data,v.dims)]));
    const result=await activeHead.run({hidden_states:hidden,inputs_embeds:emb,...headInputs});
    const values=await result.decision_logits.getData();
    const answers=decode(request.questions,packed,values,config),elapsed=performance.now()-started;
    result.decision_logits.dispose();
    return{request,wire_request:{runtime:'ONNX Runtime Web · WebGPU',model:MODEL,revision,state:request.state,questions:request.questions},response:{answers,usage:{input_tokens:n,output_tokens:0}},raw_response:null,error:null,openai_preview:null,
      metadata:{source:'local',timing_origin:'browser-local',provider:'Pocket Pilot · trained on this game',api_kind:'local trained decisions',transport:'in-browser WebGPU; no inference request sent',endpoint:null,http_status:null,provider_processing_ms:null,upstream_round_trip_ms:null,browser_round_trip_ms:round(elapsed),local_inference_ms:round(elapsed),preprocess_ms:round(preprocess),vision_ms:null,decision_ms:round(performance.now()-t),model:MODEL,model_repo:MODEL,model_revision:revision,quantization:'native NF4 backbone + learned LoRA materialized as fp16; trained fp32 head',device,state_truncated:false,
      timing_note:'Measured in this browser, including preprocessing and result readback. Model download and GPU setup excluded. No network inference call.'}};
  }finally{hidden?.dispose();emb?.dispose();busy=false;}
}
export function ready(image=false){return !image&&!!decoder&&!!tokenizer&&Object.keys(heads).length>0;}
export async function dispose(){if(busy||loading)throw new Error('Wait for the current model operation.');await decoder?.release();for(const session of Object.values(heads))await session.release();decoder=null;heads={};embedding=null;headWeights=null;tokenizer=null;rowCache.clear();for(const [k,v] of Object.entries(zeros)){v.dispose();delete zeros[k];}}
