'use strict';
const RoadView={
  draw(canvas,s){
    const c=canvas.getContext('2d'),scale=canvas.width/420;
    c.setTransform(scale,0,0,scale,0,0);
    const box=(x,y,w,h,r,color)=>{c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
    c.fillStyle='#b4bea4';c.fillRect(0,0,420,480);
    c.fillStyle='#a5b396';for(let y=-90;y<500;y+=90){const py=y+s.distance%90;c.fillRect(0,py,47,43);c.fillRect(375,py+25,45,43);}
    // Road shoulders, curb segments and unobtrusive roadside planting.
    c.fillStyle='#8e9988';c.fillRect(43,0,334,480);
    c.fillStyle='#dedbd0';c.fillRect(49,0,322,480);
    for(let y=-48;y<480;y+=48){c.fillStyle='#a4a89d';c.fillRect(49,y+s.distance%48,9,24);c.fillRect(362,y+s.distance%48,9,24);}
    c.fillStyle='#303b39';c.fillRect(59,0,302,480);
    const roadShade=c.createLinearGradient(59,0,361,0);roadShade.addColorStop(0,'#28332f');roadShade.addColorStop(.5,'#39433e');roadShade.addColorStop(1,'#28332f');c.fillStyle=roadShade;c.fillRect(59,0,302,480);
    c.fillStyle='rgba(237,234,214,.035)';for(let y=0;y<480;y+=11){for(let x=66;x<358;x+=19)c.fillRect(x+((y*7)%13),(y+s.distance)%480,.8,.8);}
    c.strokeStyle='#e4dfc5';c.lineWidth=2;c.setLineDash([]);c.beginPath();c.moveTo(63,0);c.lineTo(63,480);c.moveTo(357,0);c.lineTo(357,480);c.stroke();
    c.strokeStyle='#9da697';c.lineWidth=2;c.setLineDash([20,22]);c.lineDashOffset=-s.distance;c.beginPath();c.moveTo(160,0);c.lineTo(160,480);c.moveTo(260,0);c.lineTo(260,480);c.stroke();c.setLineDash([]);
    for(let y=-130;y<490;y+=132){for(const x of [24,397]){const py=y+s.distance%132;box(x-2,py+7,4,17,2,'#7b826d');c.fillStyle='rgba(28,47,34,.15)';c.beginPath();c.ellipse(x+4,py+5,17,10,0,0,Math.PI*2);c.fill();c.fillStyle='#748965';c.beginPath();c.arc(x,py,13,0,Math.PI*2);c.fill();c.fillStyle='#8b9c75';c.beginPath();c.arc(x-3,py-4,9,0,Math.PI*2);c.fill();}}
    for(const l of s.row.blocked){const x=77+l*100,y=s.row.y;
      box(x+3,y+6,66,49,5,'rgba(13,24,20,.35)');box(x,y,66,49,5,'#b96c3b');
      c.save();c.beginPath();c.roundRect(x+3,y+3,60,40,3);c.clip();c.fillStyle='#d79252';c.fillRect(x+3,y+3,60,40);c.strokeStyle='#f7e0a7';c.lineWidth=7;
      for(let j=-40;j<100;j+=20){c.beginPath();c.moveTo(x+j,y+49);c.lineTo(x+j+49,y);c.stroke();}c.restore();
      box(x+3,y+43,60,4,1,'#865635');c.fillStyle='#fff0c7';for(const dx of [5,58]){c.fillRect(x+dx,y+5,3,3);c.fillRect(x+dx,y+36,3,3);}
    }
    const x=84+s.lane*100,y=389;
    box(x+3,y+5,55,70,12,'rgba(12,24,20,.4)');
    for(const dy of [12,48]){box(x-5,y+dy,9,14,3,'#18211d');box(x+48,y+dy,9,14,3,'#18211d');}
    const paint=c.createLinearGradient(x,0,x+52,0);paint.addColorStop(0,'#bdbbaf');paint.addColorStop(.18,'#f1eedb');paint.addColorStop(.75,'#e5e1d1');paint.addColorStop(1,'#aaa99f');
    box(x,y,52,70,12,s.crashed?'#ba785f':paint);box(x+5,y+6,42,11,5,'#e5e0cb');
    box(x+7,y+21,38,18,6,'#324b4b');c.fillStyle='#657c75';c.beginPath();c.moveTo(x+9,y+23);c.lineTo(x+39,y+23);c.lineTo(x+12,y+35);c.fill();
    box(x+9,y+42,34,12,4,'#eae6d6');box(x+9,y+56,34,8,3,'#415751');
    box(x+4,y+5,9,4,1,'#fff7d6');box(x+39,y+5,9,4,1,'#fff7d6');box(x+3,y+63,8,3,1,'#ac6044');box(x+41,y+63,8,3,1,'#ac6044');
    // Labels identify lanes, not the answer. They are present in the sent PNG.
    c.textAlign='center';c.font='600 9px sans-serif';
    ['LEFT','MIDDLE','RIGHT'].forEach((label,i)=>{box(84+i*100,9,52,18,5,'#26342f');c.fillStyle='#d1d8c7';c.fillText(label,110+i*100,21);});
    canvas.setAttribute('aria-label',`Three-lane road. Car in lane ${s.lane.toFixed(2)} (0=left). Barrier ${s.row.id+1}. ${s.crashed?'Collision.':s.holding?'Waiting for a fresh decision.':''}`);
  }
};
