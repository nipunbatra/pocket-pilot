/* A platformer action contract, deliberately separate from the road lane schema. */
(function(root){
  'use strict';
  const actions=['wait','left','right','jump','left_jump','right_jump'];
  const criteria={wait:'Release all buttons.',left:'Walk left; release jump.',right:'Walk right; release jump.',jump:'Press jump without walking.',left_jump:'Walk left and press jump.',right_jump:'Walk right and press jump.'};
  const context='Control an original side-scrolling platform game. Reach the flag to the right. Avoid gaps and beetles; touching a beetle from the side loses, landing on top defeats it. Coins are optional. The teal explorer is the player, brown crates are solid, gold discs are coins, red beetles are enemies. Move at 180 pixels/s, jump rises about 96 pixels and travels about 138 pixels. Start a jump BEFORE reaching a crate, enemy or gap, allowing time to rise. Jump only starts on a new press while on the ground; choose right, left or wait to release it. Choose an action for the next short interval. The game pauses while you answer; your action is applied exactly, with no corrective controller.';
  function questions(count=1){
    const out={action:{type:'choice',instructions:'Which controller action should we apply now to move safely towards the flag?',criteria:{...criteria}}};
    if(count>=2)out.jump_needed={type:'noul',instructions:'Should a new jump start during the next action interval to avoid an obstacle or gap?'};
    if(count>=3)out.danger={type:'score',instructions:'How immediate is the risk if the player keeps walking right without starting a jump?',criteria:['Clear for now','Hazard approaching','Collision or fall imminent']};
    return out;
  }
  const probability=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1;
  function validSavedAnswers({request,response}){
    const answers=response?.answers;if(!answers||typeof answers!=='object'||Array.isArray(answers))return false;
    return Object.entries(request.questions||{}).length>0&&Object.entries(request.questions).every(([name,q])=>{
      const a=answers[name];if(!a||a.type!==q.type)return false;
      if(q.type==='choice')return Object.hasOwn(q.criteria,a.choice)&&probability(a.confidence)&&a.probabilities&&!Array.isArray(a.probabilities)&&Object.keys(a.probabilities).length===Object.keys(q.criteria).length&&Object.keys(q.criteria).every(k=>probability(a.probabilities[k]))&&Math.abs(Object.values(a.probabilities).reduce((x,y)=>x+y,0)-1)<0.02;
      if(q.type==='noul')return probability(a.noul);
      if(q.type==='score')return typeof a.score==='number'&&Number.isFinite(a.score)&&a.score>=0&&a.score<=q.criteria.length-1&&probability(a.confidence);
      return false;
    });
  }
  const api={actions,criteria,context,questions,validSavedAnswers};
  if(typeof module!=='undefined')module.exports=api;else root.DecisionContract=api;
})(globalThis);
