/* Pure simulation: API transport and rendering never decide the safe lane. */
(function(root){
  'use strict';
  const BASE_SPEED=36, HOLD_Y=250, CAR_Y=389, CAR_H=70, BLOCK_H=49;
  const lanes=['left','middle','right'];
  const checkpoints={adaptive:[35,310],teaching:[35,180,310],once:[35]};
  function nextCaptureY(s,policy='adaptive'){
    if(s.row.decision===null)return 35;
    return (checkpoints[policy]||checkpoints.adaptive).find(y=>y>Math.max(s.row.observedY??35,s.row.skippedThroughY??0)+.001)??null;
  }
  function captureDue(s,policy){const y=nextCaptureY(s,policy);return y!==null&&s.row.y>=y-.001;}
  function contactMs(s,speed){return Math.max(0,(CAR_Y-BLOCK_H-s.row.y)/(BASE_SPEED*speed)*1000);}
  function timingBudget(s,speed,latencyMs){
    // Reserve a full two-lane turn, without consulting which lane is open.
    const steeringMs=2/7*1000,marginMs=100;
    const requiredMs=latencyMs===null?null:latencyMs+steeringMs+marginMs;
    const initialMs=(CAR_Y-BLOCK_H-35)/(BASE_SPEED*speed)*1000;
    const suggestedSpeed=requiredMs===null?null:[16,8,4,2,1].find(v=>(CAR_Y-BLOCK_H-35)/(BASE_SPEED*v)*1000>=requiredMs)??null;
    return {contact_ms:contactMs(s,speed),initial_ms:initialMs,latency_ms:latencyMs,steering_ms:steeringMs,margin_ms:marginMs,required_ms:requiredMs,suggested_speed:suggestedSpeed};
  }
  function skipLateRecheck(s,speed,mode,policy,latencyMs){
    if(mode!=='realtime'||s.row.decision===null||!captureDue(s,policy))return false;
    const budget=timingBudget(s,speed,latencyMs);
    if(budget.contact_ms>=(budget.required_ms??budget.steering_ms+budget.margin_ms))return false;
    s.row.skippedThroughY=nextCaptureY(s,policy);
    return true;
  }
  function create(){return {lane:1,target:1,row:{id:0,y:35,blocked:[1,2],decision:null},distance:0,passed:0,crashed:false,holding:false,heldMs:0,simulationMs:0};}
  function apply(s,choice,rowId,frameId,capturedY=s.row.y){
    if(s.crashed)return 'skipped';
    if(s.row.id!==rowId)return 'stale';
    const target=lanes.indexOf(choice);
    if(target<0)return 'blocked';
    s.target=target;s.row.decision=frameId;s.row.observedY=Math.max(s.row.observedY??-1,capturedY);return 'applied';
  }
  function advance(s,seconds,speed,mode,awaitingDecision=false,sampling=null){
    const notifications=[];
    if(mode==='paced'&&awaitingDecision&&!s.crashed){s.holding=true;s.heldMs+=seconds*1000;return notifications;}
    // Small physics steps make collisions independent of render frame rate.
    while(seconds>1e-8&&!s.crashed){
      const dt=Math.min(seconds,1/120);seconds-=dt;
      const delta=s.target-s.lane;
      s.lane+=Math.sign(delta)*Math.min(Math.abs(delta),dt*7);
      const dy=BASE_SPEED*speed*dt;
      // The hold uses only freshness and steering completion, never the correct gap.
      const needsDecision=s.row.decision===null||Math.abs(s.target-s.lane)>.001;
      let move=mode==='paced'&&needsDecision?Math.max(0,Math.min(dy,HOLD_Y-s.row.y)):dy;
      // Stop exactly at a sampling checkpoint, even when a fast render step crosses it.
      // Checkpoints depend on distance only; no hidden lane information is used.
      const checkpoint=sampling?nextCaptureY(s,sampling):null;
      if(mode==='paced'&&checkpoint!==null)move=Math.max(0,Math.min(move,checkpoint-s.row.y));
      s.holding=move<dy-1e-8;
      if(s.holding)s.heldMs+=dt*1000;
      s.row.y+=move;s.distance+=move;s.simulationMs+=move/(BASE_SPEED*speed)*1000;
      const carX=84+100*s.lane;
      const overlaps=s.row.y+BLOCK_H>CAR_Y&&s.row.y<CAR_Y+CAR_H&&s.row.blocked.some(l=>carX<77+100*l+66&&carX+52>77+100*l);
      if(overlaps){s.crashed=true;s.holding=false;notifications.push({type:'collision',rowId:s.row.id,frameId:s.row.decision});break;}
      if(s.row.y>484){
        notifications.push({type:'passed',rowId:s.row.id,frameId:s.row.decision});s.passed++;
        const gap=[1,2,0,2,1,0][(s.passed-1)%6];
        s.row={id:s.row.id+1,y:35,blocked:[0,1,2].filter(l=>l!==gap),decision:null};
      }
    }
    return notifications;
  }
  function diagnose(s){
    const gap=lanes[[0,1,2].find(l=>!s.row.blocked.includes(l))];
    return {cause:s.row.decision===null?'no_current_decision':lanes[s.target]!==gap?'model_chose_blocked_lane':'steering_arrived_too_late',row_id:s.row.id,related_frame_id:s.row.decision,actual_open_lane:gap,model_target:s.row.decision===null?null:lanes[s.target]};
  }
  const api={create,apply,advance,diagnose,nextCaptureY,captureDue,contactMs,timingBudget,skipLateRecheck,checkpoints,BASE_SPEED,HOLD_Y,lanes};
  if(typeof module!=='undefined')module.exports=api;else root.RoadEngine=api;
})(typeof window==='undefined'?this:window);
