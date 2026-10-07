'use strict';
const video=document.getElementById('walkthrough');
document.querySelectorAll('[data-seek]').forEach(button=>button.addEventListener('click',()=>{video.currentTime=Number(button.dataset.seek);video.play().catch(()=>{});video.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});}));
