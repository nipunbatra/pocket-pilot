import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
const dest=process.argv[2]||'../static/local-runtime';await mkdir(dest,{recursive:true});
await build({entryPoints:['runtime.mjs'],outfile:dest+'/liquid.mjs',bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',legalComments:'linked',plugins:[{name:'browser-only-preprocessing',setup(b){
  // Transformers.js source shares Node I/O helpers; exclude those in the browser build.
  b.onResolve({filter:/^(node:.*|sharp)$|\/onnx-node\.js$/},a=>({path:a.path,namespace:'browser-empty'}));
  b.onLoad({filter:/.*/,namespace:'browser-empty'},()=>({contents:'export default {}; export const Readable=undefined, pipeline=undefined;'}));
}}]});
for(const name of ['ort-wasm-simd-threaded.asyncify.mjs','ort-wasm-simd-threaded.asyncify.wasm'])await copyFile('node_modules/onnxruntime-web/dist/'+name,dest+'/'+name);
