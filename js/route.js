'use strict';
// Экран «Маршрут» (аналог renderRouteMap / RouteMapView в Android).
// Версия 1: узлы — задания ребёнка (сделано → ждёт проверки → доступные), вершина с флагом открывается,
// когда все задания выполнены. Нажатие на узел открывает окно задания; награду начисляет только родитель.
// Показываются задания «на сегодня» (todays в app.js): с сегодняшней датой и старые без даты.
// Тропа по цветущей долине (пакет от 29.10.2026): фон 853×1844 уже содержит дорогу, точки заданий лежат на её центральной линии.
// Все координаты — в системе фона (RW×RH); карта — один SVG с этим viewBox, поэтому фон, точки, огонёк и зоны нажатия масштабируются вместе.
const RW=853, RH=1844;
const ROAD=[[450,1545],[385,1490],[300,1420],[215,1345],[155,1260],[145,1190],[180,1170],[260,1110],[360,1065],[470,1035],[555,990],[585,920],[550,850],[480,790],[405,740],[380,690],[400,650],[480,610],[580,570],[690,520],[745,470],[735,420],[690,370],[650,330]];

function routeNodes(k){
  const tt=todays(k);   // на маршруте только задания на сегодня
  const done=tt.filter(t=>t.status==='COMPLETED').slice(-6);
  const wait=tt.filter(t=>t.status==='WAITING_APPROVAL');
  const open=tt.filter(t=>t.status==='AVAILABLE');
  const list=[...done,...wait,...open];
  const curId=(open[0]||{}).id;
  return list.map(t=>({t,state:t.status==='COMPLETED'?'DONE':t.status==='WAITING_APPROVAL'?'WAIT':t.id===curId?'CUR':'OPEN'}));
}

// Гладкая кривая (Catmull-Rom) через опорные точки дороги и накопленная длина — чтобы ставить точки по длине пути, а не равными шагами по высоте
const ROUTE_CURVE=(()=>{
  const P=ROAD,pts=[];
  for(let i=0;i<P.length-1;i++){const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(P.length-1,i+2)];
    for(let s=0;s<20;s++){const t=s/20,t2=t*t,t3=t2*t;
      pts.push([0,1].map(c=>.5*((2*p1[c])+(-p0[c]+p2[c])*t+(2*p0[c]-5*p1[c]+4*p2[c]-p3[c])*t2+(-p0[c]+3*p1[c]-3*p2[c]+p3[c])*t3)))}}
  pts.push(P[P.length-1]);
  const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  return{pts,cum,len:cum[cum.length-1]};
})();
function roadAt(f){   // точка на дороге: f от 0 (старт) до 1 (финиш)
  const {pts,cum,len}=ROUTE_CURVE,s=Math.max(0,Math.min(1,f))*len;let lo=1,hi=cum.length-1;
  while(lo<hi){const m=(lo+hi)>>1;if(cum[m]<s)lo=m+1;else hi=m}
  const f2=(s-cum[lo-1])/((cum[lo]-cum[lo-1])||1),a=pts[lo-1],b=pts[lo];
  return{x:a[0]+(b[0]-a[0])*f2,y:a[1]+(b[1]-a[1])*f2};
}
// Доли пути для n заданий: от начала дороги к финишу, один узел — ближе к началу
const routeFracs=n=>n===1?[.3]:Array.from({length:n},(_,i)=>.09+.74*i/(n-1));

let sparkAt={};   // ребёнок → доля пути, где огонёк был нарисован в прошлый раз (чтобы он «прошёл» путь после подтверждения)
const reduceMotion=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function animateSpark(from,to){
  const el=document.getElementById('rspark');if(!el||reduceMotion()||to<=from)return;
  const T0=performance.now(),D=900;
  const step=now=>{const e=document.getElementById('rspark');if(!e)return;const u=Math.min(1,(now-T0)/D),q=roadAt(from+(to-from)*(u*u*(3-2*u)));
    e.setAttribute('transform','translate('+q.x.toFixed(1)+','+q.y.toFixed(1)+')');if(u<1)requestAnimationFrame(step)};
  requestAnimationFrame(step);
}

function viewRoute(){
  const k=K(),ki=kinfo(),nodes=routeNodes(k),n=nodes.length,look=decoLook(k);
  const allDone=n>0&&nodes.every(x=>x.state==='DONE');
  const doneN=nodes.filter(x=>x.state==='DONE').length;
  let h=`<div class="top"><button class="gear" data-act="switch" title="Сменить ребёнка">‹</button>
    <div class="hello"><b>Мой маршрут</b>${ki.name} · сделано ${doneN} из ${n}</div>
    <div class="wallet"><img src="img/skill_money.png" alt="">${avail(k)}</div></div>`;
  if(!n)return h+`<div class="card"><b>На сегодня заданий пока нет</b><p class="muted" style="margin:4px 0 0">Попроси родителя добавить первое задание.</p></div>
    <button class="btn full" data-act="toparent">Добавить задачу</button>`;
  const fr=routeFracs(n),pos=i=>roadAt(fr[i]),end=roadAt(1);
  const SZ=n<=6?150:n<=9?125:100,FS=n<=6?27:n<=9?24:21;   // размер точки и подписи в единицах фона
  const sprite={DONE:'done',WAIT:'wait',CUR:'cur',OPEN:'open'};
  let svg=`<svg class="route" viewBox="0 0 ${RW} ${RH}" width="100%" role="img" aria-label="Тропа по долине: ${n} заданий"><image href="img/route/route_bg.jpg" width="${RW}" height="${RH}" aria-hidden="true"/>`;
  // финиш: надетый флаг на конце дороги; пока не всё сделано — приглушён
  svg+=`<g opacity="${allDone?1:.75}">${allDone?`<circle cx="${end.x}" cy="${end.y-40}" r="120" fill="#FFE98A" opacity=".45"/>`:''}<image href="${look.flag}" x="${end.x-60}" y="${end.y-215}" width="120" height="240" aria-hidden="true"/></g>`;
  nodes.forEach((x,i)=>{const p=pos(i);
    svg+=`<g class="rnode${x.state==='CUR'?' cur':''}" data-act="rnode" data-id="${x.t.id}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(x.t.title)}">
      ${x.state==='CUR'?`<circle class="pulse" r="${SZ*.62}" fill="#FFE98A" opacity=".55"/>`:''}<circle r="${SZ*.62}" fill="transparent"/>
      <image href="img/route/${sprite[x.state]}.png" x="${-SZ/2}" y="${-SZ/2}" width="${SZ}" height="${SZ}" aria-hidden="true"/>
      <text y="${SZ*.5+FS+6}" text-anchor="middle" font-size="${FS}" font-weight="800" fill="${COL.ink}" stroke="#fff" stroke-width="${FS*.3}" paint-order="stroke">${esc(x.t.title.length>20?x.t.title.slice(0,19)+'…':x.t.title)}</text></g>`});
  // огонёк продвижения: стоит на дороге между последним выполненным заданием и следующим (или у начала дороги), после подтверждения проходит путь до следующего
  const lastDone=nodes.reduce((m,x,i)=>x.state==='DONE'?i:m,-1),sf=lastDone<0?.02:(fr[lastDone]+(fr[lastDone+1]!==undefined?fr[lastDone+1]:1))/2,sp=roadAt(sf);
  const prev=sparkAt[S.cur];sparkAt[S.cur]=sf;
  svg+=`<g id="rspark" transform="translate(${sp.x.toFixed(1)},${sp.y.toFixed(1)})" aria-hidden="true" pointer-events="none"><image href="img/route/spark.png" x="-45" y="-45" width="90" height="90"/></g>`;
  if(prev!==undefined&&prev<sf)setTimeout(()=>animateSpark(prev,sf),60);
  // герой в надетой рамке рядом с текущим узлом
  const ci=nodes.findIndex(x=>x.state==='CUR'); if(ci>=0){const p=pos(ci),side=p.x>RW/2?-1:1,cx=p.x+side*(SZ*.5+80),cy=p.y,R=72;
    svg+=`<g aria-hidden="true" pointer-events="none"><defs><clipPath id="herocl"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath></defs><circle cx="${cx}" cy="${cy}" r="${R}" fill="${COL.white}"/>
      <image href="${ki.img}" x="${cx-R*1.15}" y="${cy-R*1.2}" width="${R*2.3}" height="${R*2.7}" preserveAspectRatio="xMidYMin slice" clip-path="url(#herocl)"/><image href="${look.ring}" x="${cx-R*1.3}" y="${cy-R*1.3}" width="${R*2.6}" height="${R*2.6}"/></g>`}
  svg+='</svg>';
  return h+`<div class="routewrap">${svg}</div>
    ${allDone?'<div class="card c2"><b>Все задания выполнены!</b><div class="small">Монеты начислит родитель после проверки.</div></div>':''}
    <button class="btn full" data-act="toparent" style="margin-top:6px">Добавить задачу</button>`;
}

// Окно задания с маршрута: «Я сделал!» только отправляет родителю, награды не начисляет.
function routeTaskDialog(id){
  const t=K().tasks.find(x=>x.id===id); if(!t)return;
  const st=t.status, can=st==='AVAILABLE';
  const m=modal(`<h3>${esc(t.title)}</h3>${t.desc?`<div class="desc" style="margin-bottom:10px">${esc(t.desc)}</div>`:''}<div class="meta row" style="margin-bottom:12px">${rew(t)}</div>
    ${st==='WAITING_APPROVAL'?'<div class="card c2 small"><b>'+ico('hourglass-outline')+' Ждёт проверки родителя</b></div>':st==='COMPLETED'?'<div class="card c2 small"><b>Выполнено ✓</b></div>':''}
    ${can?'<button class="btn full green" id="rt-ok">Я сделал!</button>':''}<button class="btn full soft" id="rt-no" style="margin-top:8px">Закрыть</button>`);
  m.querySelector('#rt-no').onclick=()=>m.remove();
  const ok=m.querySelector('#rt-ok'); if(ok)ok.onclick=()=>{submit(id);m.remove();toast('Отправлено родителю');render()};
}
