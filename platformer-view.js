/* Original canvas artwork; no Nintendo sprites, music or level data. */
(function(root){
  'use strict';
  const E=root.Platformer;
  function draw(canvas,s){
    const g=canvas.getContext('2d'),w=E.WIDTH,h=E.HEIGHT,cam=E.camera(s);
    g.save();g.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);
    g.fillStyle='#e9f0d9';g.fillRect(0,0,w,h);
    g.fillStyle='#fbf9e7';g.beginPath();g.arc(580-cam*0.04,69,34,0,Math.PI*2);g.fill();
    // Mountains move more slowly than the playable foreground.
    for(let layer=0;layer<2;layer++){
      g.fillStyle=layer?'#b8cdb5':'#d0ddc4';
      for(let i=-1;i<9;i++){
        const x=i*240-cam*(layer?0.22:0.1),peak=layer?157:117;
        g.beginPath();g.moveTo(x-80,E.FLOOR);g.lineTo(x+105,peak+(i%3)*22);g.lineTo(x+285,E.FLOOR);g.fill();
      }
    }
    g.save();g.translate(-cam,0);
    for(let x=110;x<E.LEVEL.width;x+=240){
      g.fillStyle='#739b7a';g.fillRect(x,258,7,66);g.beginPath();g.moveTo(x-29,288);g.lineTo(x+3,207);g.lineTo(x+36,288);g.fill();
      g.fillStyle='#91b092';g.beginPath();g.moveTo(x-22,260);g.lineTo(x+3,198);g.lineTo(x+29,260);g.fill();
    }
    for(const [x,end] of E.LEVEL.ground){
      g.fillStyle='#c5b08b';g.fillRect(x,E.FLOOR,end-x,h-E.FLOOR);
      g.fillStyle='#426d53';g.fillRect(x,E.FLOOR,end-x,10);g.fillStyle='#83a374';g.fillRect(x,E.FLOOR,end-x,3);
      g.fillStyle='#b49b74';for(let xx=x+12;xx<end;xx+=34)for(let yy=344;yy<h;yy+=26)g.fillRect(xx+(yy%3)*3,yy,5,3);
    }
    for(const b of E.LEVEL.blocks){
      g.fillStyle='#9d6e46';g.fillRect(b.x,b.y,b.w,b.h);g.strokeStyle='#d4b17b';g.lineWidth=3;g.strokeRect(b.x+4,b.y+4,b.w-8,b.h-8);
      g.beginPath();g.moveTo(b.x+5,b.y+5);g.lineTo(b.x+b.w-5,b.y+b.h-5);g.moveTo(b.x+b.w-5,b.y+5);g.lineTo(b.x+5,b.y+b.h-5);g.stroke();
    }
    for(const c of s.coins)if(!c.collected){
      g.fillStyle='#c38b29';g.beginPath();g.ellipse(c.x,c.y,7,10,0,0,Math.PI*2);g.fill();
      g.strokeStyle='#f7df85';g.lineWidth=2;g.beginPath();g.ellipse(c.x,c.y,4,7,0,0,Math.PI*2);g.stroke();
    }
    for(const e of s.enemies)if(e.alive){
      g.fillStyle='#573a2f';g.fillRect(e.x-3,e.y+19,10,5);g.fillRect(e.x+18,e.y+19,10,5);
      g.fillStyle='#ae5846';g.beginPath();g.ellipse(e.x+13,e.y+13,14,11,0,0,Math.PI*2);g.fill();
      g.fillStyle='#efe7ca';g.fillRect(e.x+4,e.y+9,6,6);g.fillRect(e.x+17,e.y+9,6,6);
      g.fillStyle='#3e362c';g.fillRect(e.x+6,e.y+11,3,3);g.fillRect(e.x+19,e.y+11,3,3);
    }
    g.fillStyle='#776952';g.fillRect(E.LEVEL.goal+12,175,5,149);
    g.fillStyle='#2b7667';g.beginPath();g.moveTo(E.LEVEL.goal+17,175);g.lineTo(E.LEVEL.goal+65,191);g.lineTo(E.LEVEL.goal+17,209);g.fill();
    const p=s.player,x=p.x,y=p.y,walk=p.grounded&&p.vx?Math.sin(s.frame*0.5)*3:0;
    if(s.status!=='lost'||Math.floor(s.frame/4)%2===0){
      // Teal field explorer with a cream helmet, backpack and scarf.
      g.fillStyle='#755c46';g.fillRect(x+(p.facing>0?-5:20),y+12,9,15);
      g.fillStyle='#244b47';g.fillRect(x+4,y+26,6,8+walk);g.fillRect(x+15,y+26,6,8-walk);
      g.fillStyle='#287b6e';g.fillRect(x+2,y+13,22,16);g.fillStyle='#e8c391';g.fillRect(x+6,y+3,16,12);
      g.fillStyle='#f6ebcd';g.fillRect(x+4,y,18,6);g.fillRect(x+(p.facing>0?3:0),y+5,25,4);
      g.fillStyle='#293d36';g.fillRect(x+(p.facing>0?18:7),y+10,3,3);g.fillStyle='#d29349';g.fillRect(x+3,y+15,21,3);
    }
    g.restore();
    // Scene coordinates are deliberately absent from the model image.
    g.restore();
  }
  function capture(s,width=480){const c=document.createElement('canvas');c.width=width;c.height=Math.round(width*E.HEIGHT/E.WIDTH);draw(c,s);return c.toDataURL('image/png');}
  root.PlatformerView={draw,capture};
})(globalThis);
