/* Question subsets and paired measurements; diagnostics never steer the car. */
(function(root){
  'use strict';
  const names=['lane','middle_blocked','proximity'];
  function select(all,count){
    if(![1,2,3].includes(count))throw new Error('Unsupported question count.');
    return Object.fromEntries(names.slice(0,count).map(name=>[name,all[name]]));
  }
  function count(frame){return Object.keys(frame.request?.questions||{}).length;}
  function validSavedAnswers(frame){
    const q=frame.request?.questions,n=Object.keys(q||{}).length;
    if(![1,2,3].includes(n)||!names.slice(0,n).every((name,i)=>q[name]?.type===['choice','noul','score'][i])||Object.keys(q).some(name=>!names.slice(0,n).includes(name)))return false;
    const chat=typeof module!=='undefined'?require('./chat-baseline.js'):root.RoadChat;
    if(chat?.isChat(frame.request))return chat.validFrame(frame);
    if(!frame.response||frame.error)return true;
    const a=frame.response.answers;
    if(!a||Object.keys(a).length!==n)return false;
    return names.slice(0,n).every(name=>{
      const v=a[name];if(!v||v.type!==q[name].type)return false;
      if(name==='middle_blocked')return Number.isFinite(v.noul)&&v.noul>=0&&v.noul<=1;
      const p=v.probabilities,keys=name==='lane'?['left','middle','right']:['0','1','2'];
      if(!Number.isFinite(v.confidence)||v.confidence<0||v.confidence>1||!p||Object.keys(p).length!==3||!keys.every(k=>Number.isFinite(p[k])&&p[k]>=0&&p[k]<=1)||Math.abs(Object.values(p).reduce((x,y)=>x+y,0)-1)>.025)return false;
      return name==='lane'?keys.includes(v.choice)&&p[v.choice]+.025>=Math.max(...Object.values(p)):Number.isFinite(v.score)&&v.score>=0&&v.score<=2&&Math.abs(v.score-keys.reduce((s,k)=>s+Number(k)*p[k],0))<=.04;
    });
  }
  function mean(values){const a=values.filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;}
  function median(values){const a=values.filter(Number.isFinite).sort((x,y)=>x-y),n=a.length;return n?(a[Math.floor((n-1)/2)]+a[Math.floor(n/2)])/2:null;}
  function summarize(frames){
    const groups=new Map();
    for(const f of frames)if(f.comparison_id){if(!groups.has(f.comparison_id))groups.set(f.comparison_id,[]);groups.get(f.comparison_id).push(f);}
    const paired=[...groups.values()].filter(g=>g.length===3&&new Set(g.map(count)).size===3&&g.every(f=>[1,2,3].includes(count(f))&&f.application.status!=='pending'&&f.image===g[0].image&&JSON.stringify(f.request.state)===JSON.stringify(g[0].request.state)&&f.request.model===g[0].request.model&&JSON.stringify(f.scene)===JSON.stringify(g[0].scene)));
    return {pairs:paired.length,versions:[1,2,3].map(n=>{
      const set=paired.flat().filter(f=>count(f)===n);
      return {count:n,attempts:set.length,correct:set.filter(f=>!f.error&&['left','middle','right'].indexOf(f.response?.answers?.lane?.choice)>=0&&!f.scene.row.blocked.includes(['left','middle','right'].indexOf(f.response.answers.lane.choice))).length,errors:set.filter(f=>f.error).length,median_ms:median(set.map(f=>f.metadata.upstream_round_trip_ms)),mean_tokens:mean(set.map(f=>f.response?.usage?.input_tokens)),mean_cost:mean(set.map(f=>f.response?.usage?.cost))};
    })};
  }
  const api={names,select,count,validSavedAnswers,summarize};
  if(typeof module!=='undefined')module.exports=api;else root.RoadQuestions=api;
})(typeof window==='undefined'?this:window);
