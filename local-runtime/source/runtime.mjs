import * as ort from 'onnxruntime-web/webgpu';
// Import only the pinned preprocessing modules, not the full model registry.
import {PreTrainedTokenizer} from './node_modules/@huggingface/transformers/src/tokenization_utils.js';
import {Lfm2VlImageProcessor} from './node_modules/@huggingface/transformers/src/models/lfm2_vl/image_processing_lfm2_vl.js';
import {RawImage} from './node_modules/@huggingface/transformers/src/utils/image.js';
import {env} from './node_modules/@huggingface/transformers/src/env.js';
import {MODEL, REPO, REVISION, TYPES, encode, decode} from './contract.mjs';
import {CHECKPOINTS} from './checkpoints.mjs';
const original={model:MODEL,repo:REPO,revision:REVISION,trained:false};
let checkpoint=original,baseOverride=null;
const sharedPaths=new Set(['onnx/embed_tokens_quantized.onnx','onnx/embed_tokens_quantized.onnx_data','onnx/vision_encoder_fp16.onnx','onnx/vision_encoder_fp16.onnx_data','preprocessor_config.json']);
function assetSource(path){
  const shared=checkpoint.trained&&sharedPaths.has(path);
  const repo=shared?REPO:checkpoint.repo,revision=shared?REVISION:checkpoint.revision;
  return {url:(!shared&&baseOverride?baseOverride:`https://huggingface.co/${repo}/resolve/${revision}/${checkpoint.trained&&!shared?'browser/':''}`)+path,cache:shared||!checkpoint.trained?'pocket-pilot-liquid-'+revision:'pocket-pilot-liquid-'+repo+'-'+revision};
}
const sessions={};let tokenizer,processor,config,deviceInfo,loading,busy=false;
const round=v=>Math.round(v*100)/100;
ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths=new URL('./',import.meta.url).href;
env.allowLocalModels=false;
async function file(path, progress) {
  const source=assetSource(path);let cache;try{cache=(!baseOverride||sharedPaths.has(path))?await caches.open(source.cache):null;}catch{}
  const url=source.url, cached=await cache?.match(url);
  if(cached){progress?.(`Cached: ${path}`);return new Uint8Array(await cached.arrayBuffer());}
  const r=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer'});
  if(!r.ok)throw new Error(`Model download failed (HTTP ${r.status}).`);
  const total=Number(r.headers.get('Content-Length'))||0,reader=r.body.getReader(),chunks=[];let size=0,last=0;
  for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;if(performance.now()-last>250){progress?.(`${path}: ${Math.round(size/1e6)}${total?'/'+Math.round(total/1e6):''} MB`);last=performance.now();}}
  const data=new Uint8Array(size);let off=0;for(const c of chunks){data.set(c,off);off+=c.length;}
  try{await cache?.put(url,new Response(data,{headers:{'Content-Type':'application/octet-stream'}}));}catch{progress?.('Browser storage is full; model will work for this tab only.');}
  return data;
}
async function session(name, progress) {
  if(sessions[name])return sessions[name];
  const filename=name+'.onnx';
  const graph=await file('onnx/'+filename,progress),weights=await file('onnx/'+filename+'_data',progress);
  progress?.('Preparing WebGPU: '+name);
  sessions[name]=await ort.InferenceSession.create(graph,{executionProviders:['webgpu'],externalData:[{path:filename+'_data',data:weights}],graphOptimizationLevel:'all'});
  return sessions[name];
}
export async function load({image=false,progress,model=MODEL,baseURL=null,modelRevision=null}={}) {
  if(loading)await loading;
  const selected=model===MODEL?original:CHECKPOINTS[model];
  if(!selected)throw new Error('Unknown Liquid checkpoint.');
  if(selected.input==='structured'&&image)throw new Error('This Liquid fine-tune requires structured JSON.');
  if(selected.input==='image'&&!image)throw new Error('This Liquid fine-tune requires a road image.');
  const next={...selected,revision:modelRevision||selected.revision};
  if(next.model!==checkpoint.model||next.revision!==checkpoint.revision||baseURL!==baseOverride){await dispose();checkpoint=next;baseOverride=baseURL;}

  const start=performance.now();
  loading=(async()=>{
    if(!navigator.gpu)throw new Error('WebGPU is not available. Use a recent Chrome or Edge browser with graphics acceleration.');
    if(!deviceInfo){const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('No WebGPU adapter is available.');deviceInfo={vendor:adapter.info?.vendor||'unknown',architecture:adapter.info?.architecture||'unknown',description:adapter.info?.description||'',shader_f16:adapter.features.has('shader-f16')};}
    if(!tokenizer){const read=async name=>JSON.parse(new TextDecoder().decode(await file(name,progress)));config=await read('config.json');tokenizer=new PreTrainedTokenizer(await read('tokenizer.json'),await read('tokenizer_config.json'));processor=new Lfm2VlImageProcessor({...await read('preprocessor_config.json'),do_resize:false});}
    await session('embed_tokens_quantized',progress);
    await session('decision_quantized',progress);
    if(image)await session('vision_encoder_fp16',progress);
  })();
  try{await loading;progress?.('Ready · decisions stay on this device');return {load_ms:round(performance.now()-start),device:deviceInfo};}finally{loading=null;}
}
const i64=(values,dims)=>new ort.Tensor('int64',BigInt64Array.from(values,BigInt),dims);
export async function decide(request) {
  if(busy)throw new Error('A local decision is already running.');
  const parts=Array.isArray(request.state)?request.state:null,imagePart=parts?.find(x=>x.type==='image_url');
  if(request.model&&request.model!==checkpoint.model)throw new Error('Loaded Liquid weights do not match the requested model.');
  if(checkpoint.input&&((!!imagePart)!==(checkpoint.input==='image')))throw new Error('Input modality does not match this Liquid fine-tune.');
  if(!tokenizer||!sessions.decision_quantized||(imagePart&&!sessions.vision_encoder_fp16))throw new Error('Load the local model before starting.');
  busy=true;const started=performance.now();
  try{
    let prefix=null,prefixLength=0;let visionMs=0,preprocessMs=0;
    const state=imagePart?parts.filter(x=>x.type==='text').map(x=>x.text).join('\n'):request.state;
    if(imagePart){
      const url=imagePart.image_url?.url;
      if(!url?.startsWith('data:image/png;base64,'))throw new Error('Local vision accepts a captured PNG only.');
      let t=performance.now();const img=new Image();img.src=url;await img.decode();
      const canvas=new OffscreenCanvas(img.width,img.height);canvas.getContext('2d').drawImage(img,0,0);
      const processed=await processor(RawImage.fromCanvas(canvas));
      const feed=Object.fromEntries(['pixel_values','pixel_attention_mask','spatial_shapes'].map(k=>[k,new ort.Tensor(processed[k].type,processed[k].data,processed[k].dims)]));
      preprocessMs=performance.now()-t;t=performance.now();
      const out=await sessions.vision_encoder_fp16.run(feed);prefix=Object.values(out)[0];prefixLength=prefix.data.length/1024;visionMs=performance.now()-t;
    }
    const answers={},rows=[];let inputTokens=0,truncated=false,decisionMs=0;
    for(const [name,q] of Object.entries(request.questions)){
      const t=performance.now(),packed=encode(tokenizer,state,q,{image:!!imagePart}),n=packed.ids.length,k=packed.markers.length;
      const emb=Object.values(await sessions.embed_tokens_quantized.run({input_ids:i64(packed.ids,[1,n])}))[0];
      const data=new Float32Array((prefixLength+n)*1024);if(prefix)data.set(prefix.data);data.set(emb.data,prefixLength*1024);
      const logits=Object.values(await sessions.decision_quantized.run({inputs_embeds:new ort.Tensor('float32',data,[1,prefixLength+n,1024]),attention_mask:i64(new Array(prefixLength+n).fill(1),[1,prefixLength+n]),prefix_len:i64([prefixLength],[1]),marker_pos:i64(packed.markers,[1,k]),marker_mask:i64(new Array(k).fill(1),[1,k]),qtype:i64([TYPES[q.type]],[1])}))[0];
      answers[name]=decode(q,logits.data,config.temperatures,!!imagePart);inputTokens+=prefixLength+n;truncated||=packed.truncated;
      const ms=performance.now()-t;decisionMs+=ms;rows.push({name,text_tokens:n,image_tokens:prefixLength,elapsed_ms:round(ms)});
    }
    const elapsed=round(performance.now()-started);
    return {request,wire_request:{runtime:'ONNX Runtime Web · WebGPU',model:checkpoint.model,revision:checkpoint.revision,state:request.state,questions:request.questions},response:{answers,usage:{input_tokens:inputTokens,output_tokens:0}},raw_response:null,error:null,metadata:{source:'local',timing_origin:'browser-local',provider:'Liquid AI · on device',api_kind:'local decisions',transport:'in-browser WebGPU; no inference request sent',endpoint:null,http_status:null,provider_processing_ms:null,started_at:new Date(Date.now()-elapsed).toISOString(),upstream_round_trip_ms:null,browser_round_trip_ms:elapsed,local_inference_ms:elapsed,preprocess_ms:round(preprocessMs),vision_ms:round(visionMs),decision_ms:round(decisionMs),questions:rows,model:checkpoint.model,model_repo:checkpoint.repo,model_revision:checkpoint.revision,fine_tuned:checkpoint.trained,training_input:checkpoint.input||null,shared_model_repo:REPO,shared_model_revision:REVISION,quantization:'q8 decision + q4 embedding + fp16 vision',device:deviceInfo,state_truncated:truncated,timing_note:'Local wall-clock time: preprocessing, WebGPU/WASM operators and result readback. Model download and session preparation are excluded. No network round trip or API fee.'},openai_preview:null};
  }finally{busy=false;}
}
export async function dispose(){if(busy||loading)throw new Error('Wait for local work to finish.');for(const s of Object.values(sessions))await s.release();for(const k of Object.keys(sessions))delete sessions[k];tokenizer=null;processor=null;config=null;}
export function ready(image=false){return !!sessions.decision_quantized&&(!image||!!sessions.vision_encoder_fp16);}
