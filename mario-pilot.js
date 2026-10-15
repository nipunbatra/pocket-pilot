/* Jev-style observed geometry and event-based sampling. Never chooses an action. */
(function(root){
 'use strict';
 const round=n=>Math.round(n*10)/10, right=o=>o.x+o.width,bottom=o=>o.y+o.height;
 function observe(s){
  const p=s.player,front=right(p),feet=bottom(p);
  const solids=s.solids.filter(t=>t.width>0&&t.height>0);
  const floors=solids.filter(t=>t.kind==='Floor').sort((a,b)=>a.x-b.x);
  const pits=[];for(let i=0;i<floors.length-1;i++)if(floors[i+1].x>right(floors[i])+1&&floors[i+1].x>p.x)pits.push({edge_px:round(right(floors[i])-front),far_edge_px:round(floors[i+1].x-p.x),width_px:round(floors[i+1].x-right(floors[i])),bank_top: floors[i+1].y});
  const merged=[];for(const t of [...solids].sort((a,b)=>a.y-b.y||a.x-b.x)){
   const last=merged.at(-1);if(last&&last.y===t.y&&t.x<=right(last)+1){last.width=Math.max(right(last),right(t))-last.x;}else merged.push({...t});
  }
  const support=merged.find(t=>Math.abs(t.y-feet)<2&&t.x<=p.x+p.width/2&&right(t)>p.x+p.width/2);
  const walls=merged.filter(t=>t.kind!=='Floor'&&right(t)>front-2&&t.x>=front-6&&t.y<feet-4&&bottom(t)>p.y+4).map(t=>({kind:t.kind,edge_px:round(t.x-front),height_px:round(feet-t.y),top:t.y})).sort((a,b)=>a.edge_px-b.edge_px);
  const ceilings=solids.filter(t=>t.x<front+180&&right(t)>p.x&&bottom(t)<=p.y+1).map(t=>({start_px:round(t.x-front),end_px:round(right(t)-p.x),headroom_px:round(p.y-bottom(t))}));
  const enemies=s.characters.filter(t=>t.enemy&&right(t)>p.x-24&&t.x<front+360).map(t=>({kind:t.kind,body_gap_px:round(t.x-front),feet_offset_px:round(bottom(t)-feet),closing_speed:round(Math.max(.1,p.vx-t.vx)),contact_frames:round(Math.max(0,t.x-front)/Math.max(.1,p.vx-t.vx)),same_height:Math.abs(bottom(t)-feet)<40,stompable:t.stompable===true})).sort((a,b)=>a.body_gap_px-b.body_gap_px);
  const enemy=enemies.find(t=>t.body_gap_px>=-8&&t.same_height),wall=walls[0]||null,pit=pits[0]||null;
  const lowCeiling=ceilings.some(c=>c.headroom_px<=80&&c.end_px>0&&(!enemy||c.start_px<enemy.body_gap_px+32));
  const phase=p.grounded?'grounded':p.vy<-.1?'rising':p.vy>.1?'falling':'apex';
  return {objective:'Reach the exit to the RIGHT alive. Coins are optional.',coordinates:'HTML5 viewport pixels, y downward. Distances are from Mario body edges, not absolute level positions.',
   player:{vx:p.vx,vy:p.vy,feet_y:round(feet),height:p.height,phase,grounded:p.grounded,jump_held:s.buttons_held.includes('Up'),power:p.power},
   terrain:{wall,pits,ceilings,support:support?{kind:support.kind,edge_px:round(right(support)-front),top:support.y,edge_visible:right(support)<768}:null,
    landing_surfaces:merged.filter(t=>right(t)>p.x&&t.x<front+340&&t.y>=p.y-140).map(t=>({start_px:round(t.x-front),end_px:round(right(t)-p.x),top:t.y}))},
   enemies,control:{clock:'Frozen while choosing. No stale observation.',max_action_frames:64,interrupts:'New observation at takeoff deadline, landing, apex/head bump or blockage. Local code only ends an action; it never substitutes a jump.'},
   timing:{nearest_enemy_contact_frames:enemy?.contact_frames??null,low_ceiling:lowCeiling,
    enemy_takeoff_window:!!enemy&&enemy.body_gap_px<=(lowCeiling?75:115),wall_takeoff_window:!!wall&&wall.edge_px<=Math.max(85,wall.height_px*.9),pit_takeoff_window:!!pit&&pit.edge_px<=90},
   last_action:s.last_action};
 }
 const criteria={right_run:'Run right without jump on clear ground or while falling.',right_run_jump:'Run right and jump now; hold jump while rising to gain height and distance.',right:'Walk right without jump for a precise landing.',right_jump:'Walk right and jump for a precise short advance.',left:'Brake or retreat left to create takeoff room; never brake over a pit.',jump:'Jump vertically only when horizontal movement is blocked and there is room above.',wait:'Release all buttons. Inertia continues; this does not instantly stop Mario.'};
 const instructions='Choose the next buttons to reach the flag. Use the timing facts and geometry. Normally run RIGHT. If grounded and timing.enemy_takeoff_window, wall_takeoff_window, or pit_takeoff_window is true, start right_run_jump NOW; running again may miss the deadline. Ignore enemies behind or far below. Under low ceilings take off closer (body gap 45–75px) rather than an early jump that hits bricks and lands on the enemy. Hold right_run_jump while RISING; release jump with right_run while FALLING. Do not slow down over a pit. On a raised step before a pit, land on a high step and then jump again before leaving its edge. A jump from the bottom cannot cross the whole stair-and-pit sequence. If blocked against a tall wall or step, jump; if too close to rise, retreat to make space. The local loop ends your action on landing/apex/near hazard, then asks again; it never picks safer buttons for you. If grounded on a raised support with its visible edge within 50px and enemies below within 180px, jump before dropping onto them. Distances are HTML5 pixels (twice NES size), not NES coordinates.';
 function questions(count=1){const q={action:{type:'choice',instructions,criteria:{...criteria}}};if(count>=2)q.jump_needed={type:'noul',instructions:'Should a new jump start now from the current ground/support to avoid an observed threat?'};if(count>=3)q.danger={type:'score',instructions:'How urgent is the current threat?',criteria:['Clear movement','Approaching hazard','Immediate takeoff or collision danger']};return q;}
 function boundary(before,now,action,age){
  if(now.status!=='playing')return 'terminal';
  const a=before.player,b=now.player;
  if(!a.grounded&&b.grounded)return 'landed';
  if(a.grounded&&!b.grounded&&!action.includes('jump'))return 'left support';
  if(a.vy<-.1&&b.vy>=-.1)return 'apex or head bump';
  if(age>=4&&action.includes('right')&&Math.abs(b.vx)<.25&&b.grounded)return 'blocked';
  if(b.grounded&&!action.includes('jump')){const x=observe(now);if(x.timing.enemy_takeoff_window||x.timing.wall_takeoff_window||x.timing.pit_takeoff_window)return 'takeoff window';}
  return age>=64?'maximum duration':null;
 }
 const api={observe,questions,boundary,criteria,instructions};if(typeof module!=='undefined')module.exports=api;else root.MarioPilot=api;
})(globalThis);
