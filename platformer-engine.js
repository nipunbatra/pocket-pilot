/* Original Pocket Pilot platformer. Deterministic 60 Hz physics; no model logic. */
(function(root){
  'use strict';
  const WIDTH=720,HEIGHT=405,FLOOR=324,FPS=60,SPEED=180,GRAVITY=1300,JUMP=500;
  const ACTIONS=['wait','left','right','jump','left_jump','right_jump'];
  const LEVEL={id:'meadow-v1',width:2290,goal:2170,
    ground:[[0,520],[605,1060],[1150,1660],[1750,2290]],
    blocks:[{x:330,y:280,w:48,h:44},{x:815,y:272,w:48,h:52},{x:1450,y:280,w:48,h:44}],
    enemies:[{x:1320,y:300,w:26,h:24,vx:-35,min:1230,max:1400,alive:true}],
    coins:[{x:220,y:281},{x:354,y:238},{x:561,y:230},{x:710,y:281},{x:839,y:230},{x:1105,y:230},{x:1474,y:238},{x:1705,y:230},{x:1900,y:281},{x:2020,y:281}]};
  const clone=x=>JSON.parse(JSON.stringify(x));
  const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  function create(){return {version:1,level:LEVEL.id,frame:0,status:'playing',reason:null,player:{x:70,y:FLOOR-34,w:24,h:34,vx:0,vy:0,grounded:true,jumpHeld:false,facing:1},enemies:clone(LEVEL.enemies),coins:LEVEL.coins.map(c=>({...c,collected:false})),events:[]};}
  function camera(s){return Math.max(0,Math.min(LEVEL.width-WIDTH,s.player.x-190));}
  function step(s,action){
    if(!ACTIONS.includes(action))throw new Error('Unknown platformer action.');
    if(s.status!=='playing')return s;
    s.events=[];s.frame++;const p=s.player,dt=1/FPS;
    const dir=action.startsWith('right')?1:action.startsWith('left')?-1:0;
    const jump=action.includes('jump');p.vx=dir*SPEED;if(dir)p.facing=dir;
    if(jump&&!p.jumpHeld&&p.grounded){p.vy=-JUMP;p.grounded=false;s.events.push('jump');}
    p.jumpHeld=jump;
    const solids=[...LEVEL.ground.map(([x,end])=>({x,y:FLOOR,w:end-x,h:HEIGHT})),...LEVEL.blocks];
    p.x=Math.max(0,Math.min(LEVEL.width-p.w,p.x+p.vx*dt));
    for(const b of solids)if(overlap(p,b)){if(dir>0)p.x=b.x-p.w;else if(dir<0)p.x=b.x+b.w;}
    const oldBottom=p.y+p.h;p.vy+=GRAVITY*dt;p.y+=p.vy*dt;p.grounded=false;
    for(const b of solids)if(overlap(p,b)){
      if(p.vy>=0&&oldBottom<=b.y+1){p.y=b.y-p.h;p.vy=0;p.grounded=true;}
      else if(p.vy<0){p.y=b.y+b.h;p.vy=0;}
    }
    for(const e of s.enemies){
      if(!e.alive)continue;e.x+=e.vx*dt;if(e.x<e.min){e.x=e.min;e.vx=Math.abs(e.vx);}if(e.x>e.max){e.x=e.max;e.vx=-Math.abs(e.vx);}
      if(overlap(p,e)){
        if(p.vy>0&&oldBottom<=e.y+6){e.alive=false;p.vy=-300;s.events.push('stomp');}
        else {s.status='lost';s.reason='Touched a beetle from the side';s.events.push('lost');}
      }
    }
    for(const c of s.coins)if(!c.collected&&overlap(p,{x:c.x-9,y:c.y-9,w:18,h:18})){c.collected=true;s.events.push('coin');}
    if(p.y>HEIGHT+50){s.status='lost';s.reason='Fell into a gap';s.events.push('lost');}
    if(s.status==='playing'&&p.x>=LEVEL.goal){s.status='won';s.events.push('won');}
    return s;
  }
  function advance(s,action,frames){if(!Number.isInteger(frames)||frames<1||frames>60)throw new Error('Frame count must be 1–60.');for(let i=0;i<frames&&s.status==='playing';i++)step(s,action);return s;}
  function observe(s,frames=8){
    const p=s.player,left=camera(s),right=left+WIDTH;
    const round=n=>Math.round(n*10)/10;
    const rect=b=>({x:round(b.x),y:round(b.y),width:b.w,height:b.h});
    const gaps=LEVEL.ground.slice(0,-1).map((g,i)=>({start:g[1],end:LEVEL.ground[i+1][0]}));
    const front=p.x+p.w;
    const nextGap=gaps.find(g=>g.end>front&&g.start<=right);
    const nextBlock=LEVEL.blocks.find(b=>b.x+b.w>front&&b.x<=right&&b.y<p.y+p.h);
    const nextEnemy=s.enemies.filter(e=>e.alive&&e.x+e.w>p.x&&e.x<=right).sort((a,b)=>a.x-b.x)[0];
    return {game:'Pocket Pilot platformer',level:LEVEL.id,frame:s.frame,coordinate_system:'World pixels; x increases right, y increases down.',
      action_duration_frames:frames,physics:{fps:FPS,move_speed_px_s:SPEED,gravity_px_s2:GRAVITY,jump_speed_px_s:JUMP,jump_height_px:96,jump_horizontal_range_px:138,jump_rule:'Jump begins on a new press while grounded. Release with right/left/wait before jumping again.'},
      viewport:{left:round(left),right:round(right),width:WIDTH,height:HEIGHT},
      player:{...rect(p),vx:round(p.vx),vy:round(p.vy),grounded:p.grounded,jump_held:p.jumpHeld},
      forward_distances:{note:'Geometry measurements, not recommended actions. Distances are from the player right edge; negative means overlapping.',
        next_gap:nextGap?{distance:round(nextGap.start-front),width:nextGap.end-nextGap.start}:null,
        next_crate:nextBlock?{distance:round(nextBlock.x-front),height_above_feet:round(p.y+p.h-nextBlock.y)}:null,
        next_beetle:nextEnemy?{distance:round(nextEnemy.x-front),vx:nextEnemy.vx}:null},
      ground:LEVEL.ground.filter(([x,end])=>end>=left&&x<=right).map(([x,end])=>({start:x,end,y:FLOOR})),
      gaps:gaps.filter(g=>g.end>=left&&g.start<=right),
      blocks:LEVEL.blocks.filter(b=>b.x+b.w>=left&&b.x<=right).map(rect),
      enemies:s.enemies.filter(e=>e.alive&&e.x+e.w>=left&&e.x<=right).map(e=>({...rect(e),vx:e.vx})),
      coins:s.coins.filter(c=>!c.collected&&c.x>=left&&c.x<=right).map(c=>({x:c.x,y:c.y})),goal:{x:LEVEL.goal,direction:'right'}};
  }
  // An explicitly labelled scripted reference, never substituted for model answers.
  function scripted(s){
    const p=s.player;if(!p.grounded)return 'right';
    const right=p.x+p.w;
    const block=LEVEL.blocks.find(b=>b.x>=right-1&&b.x-right<54&&p.y+p.h>b.y);
    const gap=LEVEL.ground.slice(0,-1).some(([start,end])=>p.x>=start&&right<=end+3&&end-right<31);
    const enemy=s.enemies.some(e=>e.alive&&e.x+e.w>=p.x&&e.x-right<67&&e.x>=p.x);
    return (block||gap||enemy)&&!p.jumpHeld?'right_jump':'right';
  }
  const api={WIDTH,HEIGHT,FLOOR,FPS,SPEED,GRAVITY,JUMP,ACTIONS,LEVEL,create,camera,step,advance,observe,scripted,clone};
  if(typeof module!=='undefined')module.exports=api;else root.Platformer=api;
})(globalThis);
