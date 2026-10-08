import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const here=fileURLToPath(new URL('.',import.meta.url));
const shared=fileURLToPath(new URL('../local-runtime/node_modules/',import.meta.url));
const modules=existsSync(shared)?shared:here+'node_modules/';
const require=createRequire(modules+'package.json'),{build}=require('esbuild');
const dest=process.argv[2]||fileURLToPath(new URL('../static/trained-runtime/',import.meta.url));await mkdir(dest,{recursive:true});
await build({entryPoints:[here+'runtime.mjs'],outfile:dest+'/pilot.mjs',bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',legalComments:'linked',plugins:[{name:'browser-only-preprocessing',setup(b){
  b.onResolve({filter:/^\.\.\/local-runtime\/node_modules\//},a=>({path:modules+a.path.replace('../local-runtime/node_modules/','')}));
  b.onResolve({filter:/^(node:.*|sharp)$|\/onnx-node\.js$/},a=>({path:a.path,namespace:'browser-empty'}));
  b.onLoad({filter:/.*/,namespace:'browser-empty'},()=>({contents:'export default {}; export const Readable=undefined, pipeline=undefined;'}));
}}]});
