/* Native PlayMario adapter. Pocket Pilot owns the clock; no iframe or timer loop. */
(function(root){
  'use strict';
  const WIDTH=768,HEIGHT=464,FPS=60;
  const ACTIONS=['wait','left','right','jump','left_jump','right_jump','left_run','right_run','left_run_jump','right_run_jump','run','run_jump','down'];
  const BUTTONS={wait:[],left:['Left'],right:['Right'],jump:['Up'],left_jump:['Left','Up'],right_jump:['Right','Up'],left_run:['Left','Sprint'],right_run:['Right','Sprint'],left_run_jump:['Left','Sprint','Up'],right_run_jump:['Right','Sprint','Up'],run:['Sprint'],run_jump:['Sprint','Up'],down:['Down']};
  const REVISION='51d9c404db8b6f85104c9dff36e92f940b97cce7';
  const round=n=>Number.isFinite(n)?Math.round(n*100)/100:0;
  const clone=s=>JSON.parse(JSON.stringify(s));
  function createAdapter(makeGame){
    let game,held=new Set(),lastPlayer,active=false,enabled=false,volume=.25;
    const api={WIDTH,HEIGHT,FPS,ACTIONS,LEVEL:{name:'1-1',source:'PlayMario/HTML5_Client',revision:REVISION},
      exportName:'pocket-pilot-mario',nativeAudio:true,
      controlsText:'← → / A D: move · ↑ / W: jump · Shift / Space: run or fire · ↓ / S: duck or enter a pipe.',
      keyMap:{ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowUp:'jump',w:'jump',W:'jump',ArrowDown:'down',s:'down',S:'down',Shift:'run',' ':'run'},
      manualAction(keys){const dir=keys.has('right')?'right':keys.has('left')?'left':'';return dir?dir+(keys.has('run')?'_run':'')+(keys.has('jump')?'_jump':''):keys.has('down')?'down':keys.has('run')?(keys.has('jump')?'run_jump':'run'):keys.has('jump')?'jump':'wait';},
      clone,
      progress:s=>Math.round(s.player.world_x)+' px',coinLabel:s=>String(s.hud.coins),
      create(level=api.LEVEL.name){
        if(!/^[1-8]-[1-4]$/.test(level))throw Error('Choose a level from 1-1 to 8-4.');
        if(!game){
          game=makeGame();
          // setLocation calls play(). Replace it before gameStart so it cannot
          // schedule upkeep. runAllGames below executes exactly ONE native tick.
          game.GamesRunner.pause();
          game.GamesRunner.play=function(){this.paused=false;};
          game.GamesRunner.pause=function(){this.paused=true;};
        }
        api.LEVEL={...api.LEVEL,name:level};
        game.AudioPlayer.clearAll();game.AudioPlayer.setMutedOn();
        game.ScenePlayer.stopCutscene();
        for(const [k,v] of Object.entries({power:1,score:0,coins:0,lives:3}))game.ItemsHolder.setItem(k,v);
        held=new Set();game.setMap(level,0);game.GamesRunner.pause();lastPlayer=game.player;
        game.PixelDrawer.refillGlobalCanvas(game.AreaSpawner.getArea().background);
        const state={frame:0,status:'playing',reason:null,events:[],last_action:'wait'};
        refresh(state);api.setAudio({enabled,volume,active:false});return state;
      },
      step(state,action){
        if(state.status!=='playing')return state;
        if(!Object.hasOwn(BUTTONS,action))throw Error('Unknown Mario action: '+action);
        const runner=game.GamesRunner;runner.paused=false;
        try{
          if(game.player!==lastPlayer){held=new Set();lastPlayer=game.player;}
          const desired=new Set(BUTTONS[action]);
          // These are native key transitions, not repeated jump presses. The
          // engine can lock input during pipe/flag animations.
          if(!game.MapScreener.nokeys){
            for(const key of held)if(!desired.has(key))game['keyUp'+key](game);
            for(const key of desired)if(!held.has(key))game['keyDown'+key](game);
            held=desired;
          }
          runner.runAllGames();state.frame++;state.last_action=action;
        }finally{runner.paused=true;}
        refresh(state);
        if(game.player.dead||game.player.dieing){state.status='lost';state.reason='Mario lost a life';}
        else if(['Flagpole','BowserVictory'].includes(game.ScenePlayer.getCutsceneName())){state.status='won';state.reason='Level exit reached';}
        return state;
      },
      observe(state,frames){return {game:'PlayMario HTML5 remake',level:state.level,frame:state.frame,
        coordinates:'Viewport pixels; x increases right, y down. Velocities are pixels per 60 Hz frame. Only visible objects are listed; off-screen geometry and hidden blocks are omitted.',
        viewport:{width:WIDTH,height:HEIGHT,camera_x:state.camera_x},action_frames:frames,last_action:state.last_action,
        buttons_held:state.buttons_held,player:state.player,solids:state.solids,characters:state.characters,
        environment:state.environment,input_locked:state.input_locked,hud:state.hud};},
      setAudio(options){
        ({enabled,volume,active}={enabled,volume,active,...options});
        if(!game)return;
        const audio=game.AudioPlayer;audio.setVolume(volume);enabled?audio.setMutedOff():audio.setMutedOn();
        if(enabled&&active)audio.resumeAll();else audio.pauseAll();
      },
      draw(canvas,state){
        const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
        ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(game.canvas,0,0,canvas.width,canvas.height);
        const scale=canvas.width/WIDTH;ctx.save();ctx.scale(scale,canvas.height/HEIGHT);
        ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(0,0,WIDTH,48);ctx.fillStyle='#fff';ctx.font='12px "Mario Pixel", monospace';ctx.textBaseline='top';
        const entries=[['MARIO',String(state.hud.score).padStart(6,'0')],['COINS',String(state.hud.coins).padStart(2,'0')],['WORLD',state.level],['TIME',String(state.hud.time)],['LIVES',String(state.hud.lives)]];
        entries.forEach(([label,value],i)=>{const x=24+i*150;ctx.fillText(label,x,8);ctx.fillText(value,x,27);});ctx.restore();
        if(canvas.dataset){canvas.dataset.frame=String(state.frame);canvas.dataset.worldX=String(state.player.world_x);canvas.dataset.status=state.status;}
      },
      capture(state,width){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=Math.round(width*HEIGHT/WIDTH);api.draw(canvas,state);return canvas.toDataURL('image/png');}
    };
    function thing(t,clip=false){
      const left=clip?Math.max(0,t.left):t.left,top=clip?Math.max(0,t.top):t.top,right=clip?Math.min(WIDTH,t.right):t.right,bottom=clip?Math.min(HEIGHT,t.bottom):t.bottom;
      return {kind:t.title,x:round(left),y:round(top),width:round(right-left),height:round(bottom-top),vx:round(t.xvel),vy:round(t.yvel),...(t.enemy?{enemy:true}:{}),...(t.used?{used:true}:{}),...(clip&&[left,top,right,bottom].some((v,i)=>v!==[t.left,t.top,t.right,t.bottom][i])?{clipped_to_viewport:true}:{})};
    }
    function visible(t){return !t.hidden&&!t.dead&&t.right>0&&t.left<WIDTH&&t.bottom>0&&t.top<HEIGHT;}
    function refresh(state){
      const p=game.player,screen=game.MapScreener;
      Object.assign(state,{level:game.AreaSpawner.getMapName(),camera_x:round(screen.left),events:[],buttons_held:[...held],
        player:{...thing(p),world_x:round(screen.left+p.left),grounded:!!p.resting,can_jump:!!p.canjump,power:p.power,invincible:!!p.star},
        solids:game.GroupHolder.getGroup('Solid').filter(visible).map(t=>thing(t,true)),
        characters:game.GroupHolder.getGroup('Character').filter(t=>t!==p&&visible(t)).map(t=>thing(t,true)),
        environment:{underwater:!!screen.underwater,setting:game.AreaSpawner.getArea().setting},input_locked:!!screen.nokeys,
        hud:Object.fromEntries(['score','coins','time','lives'].map(k=>[k,game.ItemsHolder.getItem(k)]))});
    }
    return api;
  }
  if(typeof module!=='undefined')module.exports={createAdapter,ACTIONS,BUTTONS};
  else{
    const Native=PlayMarioJas.PlayMarioJas;
    Native.settings.audio.directory='./vendor/playmario/Sounds';Native.settings.audio.fileTypes=['mp3'];
    Native.settings.items.values.muted.valueDefault=true;
    // No independent gamepad input or browser-local state in the experiment.
    Native.settings.runner.games=Native.settings.runner.games.slice(1);
    Native.settings.items.localStorage={};
    // Legacy audio starts preload before the first gesture. Handle its promises
    // without changing browser prototypes or allowing an unhandled rejection.
    AudioPlayr.AudioPlayr.prototype.playSound=function(sound){if(!sound?.play)return false;const result=sound.play();result?.catch(()=>{});return true;};
    root.MarioEngine=createAdapter(()=>new Native({width:WIDTH,height:HEIGHT}));
    root.MarioView={draw:(...args)=>root.MarioEngine.draw(...args),capture:(...args)=>root.MarioEngine.capture(...args)};
  }
})(globalThis);
