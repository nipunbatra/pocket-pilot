/* A dependency-free, read-only JSON explorer. Copy/download always use original data. */
(function(root){
  'use strict';
  const isGroup=v=>v!==null&&typeof v==='object';
  const pathFor=(parent,key,array)=>array?`${parent}[${key}]`:/^[A-Za-z_$][\w$]*$/.test(key)?`${parent}.${key}`:`${parent}[${JSON.stringify(key)}]`;
  const typeOf=v=>v===null?'null':Array.isArray(v)?'array':typeof v;
  function preview(v,full=false){
    if(typeof v==='string'&&!full&&v.startsWith('data:image/'))return `[image data · ${v.length.toLocaleString()} characters · copy/download keeps the original]`;
    if(typeof v==='string'&&!full&&v.length>260)return v.slice(0,180)+`… [${v.length.toLocaleString()} characters]`;
    return v;
  }
  function matches(v,key,query){
    if(!query)return true;
    if(String(key).toLowerCase().includes(query))return true;
    if(isGroup(v))return Object.entries(v).some(([k,value])=>matches(value,k,query));
    return String(preview(v)).toLowerCase().includes(query);
  }
  function displayJSON(value,full){return JSON.stringify(value,(k,v)=>preview(v,full),2);}
  function create(host,notify){
    let value=null,filename='decision.json',available=false,mode='tree',full=false,query='',depth=3;
    const expanded=new Map();
    host.innerHTML=`<div class="json-toolbar"><div class="json-mode" role="group" aria-label="JSON display"><button type="button" data-mode="tree" aria-pressed="true">Tree</button><button type="button" data-mode="raw" aria-pressed="false">Raw</button></div><label class="json-search"><span class="sr-only">Search JSON keys and values</span><input type="search" placeholder="Find a key or value…" aria-label="Search JSON keys and values"></label><button type="button" data-action="copy">Copy JSON</button><button type="button" data-action="download">Download</button></div><div class="json-options"><button type="button" data-action="expand">Expand all</button><button type="button" data-action="collapse">Collapse all</button><label><input type="checkbox" data-option="full"> Full strings</label><label><input type="checkbox" data-option="wrap" checked> Wrap</label><span class="json-search-status" role="status"></span></div><div class="json-surface wrap" tabindex="0" aria-label="JSON document"></div><p class="json-footnote">Read-only. Long strings are shortened on screen. Copy and download preserve the complete original JSON.</p>`;
    const surface=host.querySelector('.json-surface'),search=host.querySelector('input[type=search]'),status=host.querySelector('.json-search-status');
    function text(tag,content,className){const el=document.createElement(tag);el.textContent=content;if(className)el.className=className;return el;}
    async function copy(data,label){try{await navigator.clipboard.writeText(data);notify(label);}catch{notify('Clipboard unavailable. Use Download to keep the complete JSON.');}}
    function leaf(v,key,path){
      const row=text('div','','json-leaf');
      const pathButton=text('button',String(key),'json-key');pathButton.type='button';pathButton.title=`Copy path: ${path}`;pathButton.setAttribute('aria-label',`Copy path ${path}`);
      pathButton.addEventListener('click',()=>copy(path,'Copied '+path));
      row.append(pathButton,text('span',': ','json-punctuation'),text('span',JSON.stringify(preview(v,full)),'json-value json-'+typeOf(v)),text('span',typeOf(v),'json-type'));
      return row;
    }
    function tree(v,key,path,level,force=false){
      if(!isGroup(v))return leaf(v,key,path);
      const details=document.createElement('details'),summary=document.createElement('summary'),entries=Object.entries(v);
      details.className='json-branch';details.open=query?true:expanded.has(path)?expanded.get(path):level<depth;
      summary.append(text('span',String(key),'json-key'),text('span',` ${Array.isArray(v)?'[':'{'}${entries.length}${Array.isArray(v)?']':'}'}`,'json-count'),text('span',typeOf(v),'json-type'));
      details.append(summary);const children=text('div','','json-children');
      const matchedGroup=force||String(key).toLowerCase().includes(query)&&!!query;
      for(const [k,child] of entries){if(query&&!matchedGroup&&!matches(child,k,query))continue;children.append(tree(child,k,pathFor(path,k,Array.isArray(v)),level+1,matchedGroup));}
      if(!entries.length)children.append(text('div',Array.isArray(v)?'Empty array':'Empty object','json-empty'));
      details.append(children);details.addEventListener('toggle',()=>{if(!query&&details.isConnected)expanded.set(path,details.open);});return details;
    }
    function highlight(line){
      const fragment=document.createDocumentFragment();
      const re=/("(?:\\.|[^"\\])*"\s*:?)|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;let previous=0;
      for(const m of line.matchAll(re)){fragment.append(document.createTextNode(line.slice(previous,m.index)));fragment.append(text('span',m[0],m[1]?(m[0].endsWith(':')?'json-key':'json-string'):m[2]==='null'?'json-null':m[2]?'json-boolean':'json-number'));previous=m.index+m[0].length;}
      fragment.append(document.createTextNode(line.slice(previous)));return fragment;
    }
    function render(){
      surface.replaceChildren();host.querySelectorAll('[data-action="copy"],[data-action="download"]').forEach(b=>b.disabled=!available);
      host.querySelectorAll('[data-action="expand"],[data-action="collapse"]').forEach(b=>b.disabled=mode==='raw');
      if(!available){surface.append(text('p','No response yet. Take a decision or open a recorded run.','json-empty'));status.textContent='';return;}
      if(query&&!matches(value,'$',query)){surface.append(text('p','No matching key or value. Clear search to show the complete document.','json-empty'));status.textContent='No matches';return;}
      if(mode==='tree'){surface.append(tree(value,'$','$',0));status.textContent=query?'Filtered tree · clear search for all fields':'Click a field name to copy its path';}
      else{
        const lines=displayJSON(value,full).split('\n');let found=0;
        lines.forEach((line,i)=>{const row=text('div','','json-line'),hit=query&&line.toLowerCase().includes(query);if(hit){row.classList.add('json-match');found++;}row.append(text('span',String(i+1),'json-line-number'));const code=text('code','');code.append(highlight(line));row.append(code);surface.append(row);});
        status.textContent=query?`${found} matching line${found===1?'':'s'}`:`${lines.length} lines`;if(query)surface.querySelector('.json-match')?.scrollIntoView({block:'nearest'});
      }
    }
    host.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.mode){mode=b.dataset.mode;host.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}
      if(b.dataset.action==='copy'&&available)copy(JSON.stringify(value,null,2),'Copied complete JSON');
      if(b.dataset.action==='download'&&available){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
      if(['expand','collapse'].includes(b.dataset.action)){expanded.clear();depth=b.dataset.action==='expand'?Infinity:1;render();}
    });
    search.addEventListener('input',()=>{query=search.value.trim().toLowerCase();render();});
    host.querySelector('[data-option="full"]').addEventListener('change',e=>{full=e.target.checked;render();});
    host.querySelector('[data-option="wrap"]').addEventListener('change',e=>surface.classList.toggle('wrap',e.target.checked));
    return {set(next,name,{reset=false}={}){available=next!==undefined;value=next;filename=name;if(reset){expanded.clear();surface.scrollTop=0;}render();}};
  }
  const api={pathFor,typeOf,preview,matches,displayJSON,create};
  if(typeof module!=='undefined')module.exports=api;else root.JsonExplorer=api;
})(typeof window==='undefined'?this:window);
