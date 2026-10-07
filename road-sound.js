/* Synthesized locally; one shared audio graph, silent until a user gesture. */
'use strict';
const RoadSound={
  enabled:true,volume:.35,context:null,played:0,engine:null,master:null,voices:new Set(),lastDrive:null,
  unlock(){
    try{
      if(!this.context){
        const a=this.context=new (window.AudioContext||window.webkitAudioContext)();
        this.master=a.createGain();this.master.gain.value=this.enabled?this.volume:0;this.master.connect(a.destination);
        const noise=a.createBuffer(1,a.sampleRate*2,a.sampleRate),channel=noise.getChannelData(0);
        let brown=0;for(let i=0;i<channel.length;i++){brown=(brown+(Math.random()*2-1)*.025)/1.025;channel[i]=brown*3;}
        this.noise=noise;
        const rumble=a.createOscillator(),harmonic=a.createOscillator(),tone=a.createBiquadFilter(),wind=a.createBufferSource(),windFilter=a.createBiquadFilter(),windGain=a.createGain(),gain=a.createGain();
        rumble.type='triangle';rumble.frequency.value=48;harmonic.type='sine';harmonic.frequency.value=96;
        const harmonicGain=a.createGain();harmonicGain.gain.value=.28;harmonic.connect(harmonicGain).connect(tone);
        tone.type='lowpass';tone.frequency.value=190;rumble.connect(tone).connect(gain);
        wind.buffer=noise;wind.loop=true;windFilter.type='lowpass';windFilter.frequency.value=800;windGain.gain.value=.24;wind.connect(windFilter).connect(windGain).connect(gain);
        gain.gain.value=0;gain.connect(this.master);rumble.start();harmonic.start();wind.start();
        this.engine={rumble,harmonic,tone,wind,windFilter,windGain,gain,driving:false,speed:1};
      }
      if(this.context.state==='suspended')this.context.resume().catch(()=>{});
    }catch{this.enabled=false;}
  },
  setEnabled(value){
    this.enabled=Boolean(value);this.updateVolume();
    if(!this.enabled)this.stopEffects();
  },
  setVolume(value){this.volume=Math.max(0,Math.min(1,value));this.updateVolume();},
  updateVolume(){if(!this.context||!this.master)return;const t=this.context.currentTime;this.master.gain.cancelScheduledValues(t);this.master.gain.setTargetAtTime(this.enabled?this.volume:0,t,.02);},
  drive(driving,speed=1){
    if(!this.engine)return;
    const moving=Boolean(driving)&&!document.hidden,rate=Math.max(1,Math.min(8,speed));
    const signature=`${moving}:${rate}`;if(this.lastDrive===signature)return;this.lastDrive=signature;
    const a=this.context,t=a.currentTime,e=this.engine;e.driving=moving;e.speed=rate;
    e.gain.gain.cancelScheduledValues(t);e.gain.gain.setTargetAtTime(moving?.12:0,t,moving?.1:.025);
    e.rumble.frequency.setTargetAtTime(45+rate*5,t,.2);e.harmonic.frequency.setTargetAtTime(90+rate*10,t,.2);
    e.tone.frequency.setTargetAtTime(150+rate*25,t,.2);e.windFilter.frequency.setTargetAtTime(550+rate*95,t,.2);
  },
  stopEffects(){for(const voice of this.voices){try{voice.stop();}catch{}}this.voices.clear();},
  stop(){this.drive(false);this.stopEffects();},
  tone(frequency,duration,delay=0,pan=0,type='sine'){
    if(!this.enabled||!this.context||this.context.state!=='running')return;
    const a=this.context,t=a.currentTime+delay,o=a.createOscillator(),g=a.createGain(),p=a.createStereoPanner();
    o.type=type;o.frequency.setValueAtTime(frequency,t);o.frequency.exponentialRampToValueAtTime(Math.max(60,frequency*.65),t+duration);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.13,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    p.pan.value=pan;o.connect(g).connect(p).connect(this.master);o.start(t);o.stop(t+duration+.01);this.voices.add(o);
    o.onended=()=>{this.voices.delete(o);o.disconnect();g.disconnect();p.disconnect();};this.played++;
  },
  steer(direction){
    if(direction==='stay'||!this.enabled||this.context?.state!=='running')return;
    const a=this.context,t=a.currentTime,sign=direction==='left'?-1:1;
    const source=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain(),pan=a.createStereoPanner();
    source.buffer=this.noise;filter.type='bandpass';filter.Q.value=.7;filter.frequency.setValueAtTime(350,t);filter.frequency.exponentialRampToValueAtTime(2100,t+.12);filter.frequency.exponentialRampToValueAtTime(450,t+.4);
    gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.7,t+.07);gain.gain.exponentialRampToValueAtTime(.001,t+.42);
    pan.pan.setValueAtTime(0,t);pan.pan.linearRampToValueAtTime(sign*.85,t+.22);pan.pan.linearRampToValueAtTime(sign*.45,t+.42);
    source.connect(filter).connect(gain).connect(pan).connect(this.master);source.start(t);source.stop(t+.44);this.voices.add(source);
    source.onended=()=>{this.voices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();pan.disconnect();};this.played++;
    this.tone(580,.045,0,sign*.5,'triangle');
  },
  pass(){this.tone(660,.08);this.tone(880,.12,.09);},
  collision(){this.drive(false);this.tone(120,.2,0,0,'triangle');this.tone(72,.22,.09,0,'triangle');}
};
window.addEventListener('pagehide',()=>RoadSound.stop());
document.addEventListener('visibilitychange',()=>{if(document.hidden)RoadSound.stop();});
