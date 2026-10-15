/* Replays an actual successful run. Never calls a model or changes its answers. */
(function(root){
  'use strict';
  let saved;
  function sameState(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  function validate(data,E,C){
    if(data.format!=='mario-jev-replay-v1'||data.level?.name!=='1-1'||data.level.revision!==E.LEVEL.revision||!Array.isArray(data.records)||!data.records.length)throw Error('Unsupported recorded run.');
    for(const [i,r] of data.records.entries()){
      if(!C.validSavedAnswers(r)||r.action!==r.response.answers.action.choice||!E.ACTIONS.includes(r.action)||!Number.isInteger(r.frames_advanced)||r.frames_advanced<1||r.frames_advanced>64||r.after.frame-r.before.frame!==r.frames_advanced||r.before.status!=='playing'||(i&& !sameState(data.records[i-1].after,r.before)))throw Error('Invalid recorded decision '+(i+1));
    }
    if(data.records[0].before.frame!==0||data.records.at(-1).after.status!=='won')throw Error('The recording must span a complete level clear.');
    return data;
  }
  const api={sameState,validate,async load(E,C){
    if(!saved){const response=await fetch('./mario-jev-clear.json');if(!response.ok)throw Error('Could not load the recorded run.');saved=validate(await response.json(),E,C);}
    return saved;
  }};
  if(typeof module!=='undefined')module.exports=api;else root.MarioReplay=api;
})(globalThis);
