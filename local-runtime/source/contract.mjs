// Liquid d1 prompt protocol, ported from LiquidAI/d1-omni-600M/prompt.py.
export const MODEL = 'LiquidAI/d1-omni-600M';
export const REPO = 'onnx-community/d1-omni-600M-ONNX';
export const REVISION = '4ebc1b97bf1477485371c79d1cf8d5e4e8eebfa0';
export const TYPES = {choice:0, score:1, noul:2};
export const escape = s => String(s).replace(/<\|([A-Za-z0-9_]+)\|>/g, '<¦$1¦>');
export function serialize(x) {
  if (typeof x === 'string') return x;
  // Python json.dumps spacing, without changing punctuation inside strings.
  if (Array.isArray(x)) return '['+x.map(v=>typeof v==='string'?JSON.stringify(v):serialize(v)).join(', ')+']';
  if (x && typeof x==='object') return '{'+Object.entries(x).map(([k,v])=>JSON.stringify(k)+': '+(typeof v==='string'?JSON.stringify(v):serialize(v))).join(', ')+'}';
  return JSON.stringify(x);
}
export function options(q, image=false) {
  if (!(q.type in TYPES) || typeof q.instructions !== 'string') throw new Error('Invalid decision question.');
  if (q.type==='choice') {
    if (!q.criteria || Array.isArray(q.criteria) || Object.keys(q.criteria).length<2) throw new Error('Choice needs at least two named options.');
    return Object.entries(q.criteria).map(([k,v])=>v==null||v===''?k:`${k}: ${serialize(v)}`);
  }
  if (q.type==='score') {
    if (!Array.isArray(q.criteria)||q.criteria.length<2||q.criteria.length>10) throw new Error('Score needs 2–10 ordered levels.');
    return q.criteria.map((v,i)=>`level ${i}: ${serialize(v)}`);
  }
  const c=q.criteria||(image?{false:'no',true:'yes'}:{});
  return ['false: '+(c.false||c.no||'no, the statement does not hold'),'true: '+(c.true||c.yes||'yes, the statement holds')];
}
export function encode(tok,state,q,{image=false,maxLength=image?896:16384}={}) {
  const id=x=>tok.convert_tokens_to_ids(x), text=s=>tok.encode(escape(s),{add_special_tokens:false});
  const opts=options(q,image), budget=Math.max(96,Math.min(opts.length*24+32,Math.floor(maxLength/2))), per=Math.max(2,Math.floor((budget-3*opts.length)/opts.length));
  let question=[id('<|reserved_8|>'),...text(q.instructions)].slice(0,Math.max(16,budget)), markers=[];
  for(const opt of opts){markers.push(question.length+1);question.push(id('<|reserved_9|>'),id('<|mask|>'),...text(' '+opt).slice(0,per),id('<|reserved_10|>'));}
  question.push(id('<|reserved_11|>'));
  const stateTokens=text(serialize(state??'')),room=Math.max(0,maxLength-question.length-2);
  const prefix=[id('<|reserved_7|>'),...stateTokens.slice(0,room)];
  const ids=[tok.bos_token_id,...prefix,...question].slice(0,maxLength);
  markers=markers.map(m=>m+1+prefix.length);
  if(markers.at(-1)>=maxLength||ids.some(v=>!Number.isInteger(v)))throw new Error('Invalid token sequence or options exceed the context.');
  return {ids,markers,truncated:stateTokens.length>room};
}
export function decode(q, logits, temperatures={}, image=false) {
  const k=options(q,image).length;
  const bucket=k<=2?'2':k<=5?'3-5':k<=10?'6-10':'11+';
  const temperature=image?1:(temperatures[`${q.type}:${bucket}`]??temperatures[q.type]??1);
  const z=Array.from(logits).slice(0,k).map(v=>v/temperature),max=Math.max(...z),e=z.map(v=>Math.exp(v-max)),sum=e.reduce((a,b)=>a+b,0),p=e.map(v=>v/sum);
  if(!p.every(Number.isFinite))throw new Error('Non-finite model logits.');
  if(q.type==='noul')return {type:'noul',noul:p[1]};
  const best=p.indexOf(Math.max(...p)),names=q.type==='choice'?Object.keys(q.criteria):p.map((_,i)=>String(i));
  const common={type:q.type,confidence:p[best],probabilities:Object.fromEntries(names.map((n,i)=>[n,p[i]]))};
  return q.type==='choice'?{...common,choice:names[best]}:{...common,score:p.reduce((s,v,i)=>s+i*v,0),legend:Object.fromEntries(q.criteria.map((v,i)=>[i,serialize(v)]))};
}
