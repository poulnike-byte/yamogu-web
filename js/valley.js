'use strict';
// Единая долина на всех страницах (ТЗ от 29.10.2026): постоянные слои под содержимым — valley_plain (без дороги), поверх неё valley_route (дорога, видна только в «Маршруте»),
// светлая вуаль для чтения и слой точек маршрута. Все слои — в одном контейнере с одним cover-преобразованием (формула geometry.mjs из пакета), страницы фона не пересоздают.
// Мастера PNG — в design_masters/, в приложении WebP того же размера 853×1844.
const VW=853,VH=1844;
const valley={ready:false,mode:'',pan:0,auto:0,user:0,timer:0};
const vReduce=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function coverTransform(vw,vh,iw=VW,ih=VH,panX=0,panY=0){
  const scale=Math.max(vw/iw,vh/ih);
  return{scale,offsetX:(vw-iw*scale)/2+panX,offsetY:(vh-ih*scale)/2+panY,imageWidth:iw,imageHeight:ih};
}
const valleyScale=()=>coverTransform(innerWidth,innerHeight).scale;
function valleyInit(){
  if(document.getElementById('valley'))return;
  const el=document.createElement('div');el.id='valley';
  el.innerHTML='<div id="vstage"><img class="vplain" src="img/valley_plain.webp" alt="" aria-hidden="true" draggable="false"><img class="vroad" src="img/valley_route.webp" alt="" aria-hidden="true" draggable="false">'
    +'<svg id="routeLayer" viewBox="0 0 '+VW+' '+VH+'" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"></svg></div><div id="vveil" aria-hidden="true"></div>';
  document.body.insertBefore(el,document.body.firstChild);
  // готовы обе картинки — только тогда показываем (пока — спокойный зелёный фон страницы); ошибка загрузки не блокирует приложение
  const imgs=[...el.querySelectorAll('img')];let left=imgs.length;
  imgs.forEach(i=>{const done=()=>{if(--left===0){valley.ready=true;el.classList.add('ready')}};if(i.complete)done();else{i.onload=done;i.onerror=()=>{i.dataset.fail=1;done()}}});
  addEventListener('resize',()=>syncValley(true));
}
// Сдвиг всей карты по вертикали, чтобы текущая точка была в видимой зоне между заголовком и нижними карточками; в пределах, где фон ещё закрывает экран
function valleyPan(){
  const f=routeFocusPoint();if(!f)return 0;
  const vw=innerWidth,vh=innerHeight,t=coverTransform(vw,vh),top=96,bottom=190;
  const y=t.offsetY+f.y*t.scale,zone=[top,vh-bottom],want=Math.min(Math.max(y,zone[0]+40),zone[1]-40);
  const lim=Math.abs(t.offsetY);return Math.max(-lim,Math.min(lim,want-y));
}
// Допустимый сдвиг карты: фон всегда закрывает экран
function clampPan(p){const lim=Math.abs(coverTransform(innerWidth,innerHeight).offsetY);return Math.max(-lim,Math.min(lim,p))}
// Если дорога не помещается, карту можно двигать пальцем по вертикали: фон и точки смещаются вместе одним transform
(function(){
  let y0=null,u0=0,moved=false;const stage=()=>document.getElementById('vstage');
  const skip=t=>t.closest&&t.closest('.btn,.card,.top,nav,.modal,.rnode,button,input,textarea,a');
  addEventListener('pointerdown',e=>{if(valley.mode!=='route'||skip(e.target))return;y0=e.clientY;u0=valley.user;moved=false});
  addEventListener('pointermove',e=>{if(y0===null)return;const dy=e.clientY-y0;if(Math.abs(dy)>4)moved=true;if(!moved)return;
    valley.user=u0+dy;valley.pan=clampPan(valley.auto+valley.user);const s=stage();s.style.transition='none';s.style.transform='translateY('+valley.pan.toFixed(1)+'px)'});
  const end=()=>{if(y0===null)return;y0=null;valley.user=valley.pan-valley.auto;const s=stage();if(s)s.style.transition=''};
  addEventListener('pointerup',end);addEventListener('pointercancel',end);
  addEventListener('wheel',e=>{if(valley.mode!=='route'||skip(e.target))return;valley.user-=e.deltaY;valley.pan=clampPan(valley.auto+valley.user);valley.user=valley.pan-valley.auto;stage().style.transform='translateY('+valley.pan.toFixed(1)+'px)'},{passive:true});
})();
function syncValley(resizeOnly){
  const el=document.getElementById('valley');if(!el||typeof S==='undefined'||!S)return;
  const route=tab==='route'&&!!S.cur&&S.onb&&S.onb.done,parent=tab==='parent'&&unlocked;
  const mode=route?'route':parent?'parent':'page',was=valley.mode;valley.mode=mode;
  document.body.dataset.mode=mode;
  const layer=document.getElementById('routeLayer'),stage=document.getElementById('vstage');
  clearTimeout(valley.timer);
  if(route){
    const html=routeLayerHtml();
    layer.innerHTML='<g class="rl'+(was==='route'?' on':'')+'">'+html+'</g>';
    if(was!=='route')requestAnimationFrame(()=>requestAnimationFrame(()=>{const g=layer.querySelector('.rl');if(g)g.classList.add('on')}));
    if(was!=='route')valley.user=0;
    valley.auto=valleyPan();valley.pan=clampPan(valley.auto+valley.user);
  }else{
    const g=layer.querySelector('.rl');if(g)g.classList.remove('on');
    valley.timer=setTimeout(()=>{if(valley.mode!=='route')layer.innerHTML=''},vReduce()?0:260);
    valley.pan=0;valley.auto=0;valley.user=0;
  }
  stage.style.transform=valley.pan?'translateY('+valley.pan.toFixed(1)+'px)':'';
}
valleyInit();
syncValley();
