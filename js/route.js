'use strict';
// Экран «Маршрут» (аналог renderRouteMap / RouteMapView в Android).
// Версия 1: узлы — задания ребёнка (сделано → ждёт проверки → доступные), вершина с флагом открывается,
// когда все задания выполнены. Нажатие на узел открывает окно задания; награду начисляет только родитель.
// Показываются задания «на сегодня» (todays в app.js): с сегодняшней датой и старые без даты.
const ROUTE_W=360, ROUTE_STEP=104, ROUTE_TOP=96, ROUTE_X=[80,180,280,180];   // зигзаг из 4 позиций по горизонтали

function routeNodes(k){
  const tt=todays(k);   // на маршруте только задания на сегодня
  const done=tt.filter(t=>t.status==='COMPLETED').slice(-6);
  const wait=tt.filter(t=>t.status==='WAITING_APPROVAL');
  const open=tt.filter(t=>t.status==='AVAILABLE');
  const list=[...done,...wait,...open];
  const curId=(open[0]||{}).id;
  return list.map(t=>({t,state:t.status==='COMPLETED'?'DONE':t.status==='WAITING_APPROVAL'?'WAIT':t.id===curId?'CUR':'OPEN'}));
}

// Точки вдоль кривой Безье из пути «M… C…»: отрезки по SL единиц, у каждого центр и угол (для дорожки-картинки)
function trailPoints(pts,SL){
  const poly=[];
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],my=(a.y+b.y)/2,c1={x:a.x,y:my},c2={x:b.x,y:my};
    for(let s=(i===1?0:1);s<=40;s++){const t=s/40,u=1-t;
      poly.push({x:u*u*u*a.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*b.y})}}
  const cum=[0];for(let i=1;i<poly.length;i++)cum.push(cum[i-1]+Math.hypot(poly[i].x-poly[i-1].x,poly[i].y-poly[i-1].y));
  const out=[];let j=1;
  for(let s=SL/2;s<cum[cum.length-1];s+=SL){while(j<poly.length-1&&cum[j]<s)j++;
    const f=(s-cum[j-1])/((cum[j]-cum[j-1])||1),a=poly[j-1],b=poly[j];
    out.push({s,x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,ang:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI})}
  return out;
}
// Дорожка: полоса-картинка (бесшовная по длине) режется на короткие кусочки, каждый поворачивается по касательной к пути
function trailSvg(pts,img){
  const SL=9,TL=100,TH=22,NW=512,NH=103,sw=NW*SL*1.08/TL;   // длина кусочка, длина «плитки» полосы, высота дорожки, размер исходной картинки
  return trailPoints(pts,SL).map(p=>{const u=((p.s-SL/2)%TL)/TL*NW;
    return`<g transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${p.ang.toFixed(1)})"><svg x="${-SL*.54}" y="${-TH/2}" width="${SL*1.08}" height="${TH}" viewBox="${u.toFixed(1)} 0 ${sw.toFixed(1)} ${NH}" preserveAspectRatio="none"><image href="${img}" width="${NW}" height="${NH}" preserveAspectRatio="none"/><image href="${img}" x="${NW}" width="${NW}" height="${NH}" preserveAspectRatio="none"/></svg></g>`}).join('');
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
  // координаты: старт внизу, вершина вверху
  const H=ROUTE_TOP*2+ROUTE_STEP*n;
  const pos=i=>({x:ROUTE_X[i%ROUTE_X.length],y:H-ROUTE_TOP-ROUTE_STEP*(i+0.5)});
  const sum={x:180,y:ROUTE_TOP-10};
  const pts=[{x:180,y:H-40},...nodes.map((_,i)=>pos(i)),{x:180,y:sum.y+34}];   // дорожка заканчивается у холмика флага
  let d=`M${pts[0].x},${pts[0].y}`;
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],my=(a.y+b.y)/2;d+=` C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`}
  let svg=`<svg class="route" viewBox="0 0 ${ROUTE_W} ${H}" width="100%" role="img" aria-label="Карта маршрута: ${n} заданий">`;
  // деревья по краям карты (за дорожкой и узлами)
  for(let y=70,i=0;y<H-40;y+=128,i++){const x=i%2?334:26;svg+=`<image href="${look.trees}" x="${x-24}" y="${y-28}" width="48" height="56" aria-hidden="true"/>`}
  svg+=`<path d="${d}" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="30" stroke-linecap="round"/>${trailSvg(pts,look.trail)}`;
  nodes.forEach((x,i)=>{const p=pos(i),c={DONE:COL.green,WAIT:COL.orange,CUR:COL.blue,OPEN:COL.white}[x.state];
    const mark=x.state==='DONE'?`<path d="M-12,0 L-4,8 L13,-9" fill="none" stroke="${COL.white}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`
      :x.state==='WAIT'?`<g transform="translate(-15,-15) scale(.0586)" color="${COL.white}" fill="currentColor">`+ICO['hourglass-outline']+'</g>'
      :`<text y="10" text-anchor="middle" font-size="26" font-weight="800" fill="${x.state==='CUR'?COL.white:COL.ink}">${i+1}</text>`;
    svg+=`<g class="rnode${x.state==='CUR'?' cur':''}" data-act="rnode" data-id="${x.t.id}" transform="translate(${p.x},${p.y})" tabindex="0" role="button" aria-label="${esc(x.t.title)}">
      ${x.state==='CUR'?`<circle r="40" fill="${COL.blue}" opacity=".18"/>`:''}<circle r="32" fill="#0003" cy="4"/><circle r="32" fill="${c}" stroke="${COL.white}" stroke-width="5"/>${mark}
      <text x="${p.x>=280?34:p.x<=80?-34:0}" y="56" text-anchor="${p.x>=280?'end':p.x<=80?'start':'middle'}" font-size="13" font-weight="800" fill="${COL.ink}" stroke="${COL.white}" stroke-width="4" paint-order="stroke">${esc(x.t.title.length>22?x.t.title.slice(0,21)+'…':x.t.title)}</text></g>`});
  // вершина с флагом (надетый флаг; пока не все задания сделаны — приглушён)
  svg+=`<g opacity="${allDone?1:.6}">${allDone?`<circle cx="${sum.x}" cy="${sum.y}" r="44" fill="${COL.goldFlag}" opacity=".4"/>`:''}<image href="${look.flag}" x="${sum.x-26}" y="${sum.y-80}" width="52" height="104" aria-hidden="true"/></g>`;
  // герой в надетой рамке рядом с текущим узлом
  const ci=nodes.findIndex(x=>x.state==='CUR'); if(ci>=0){const p=pos(ci),side=p.x>180?-1:1,cx=side>0?p.x+76:p.x-76,cy=p.y-4;
    svg+=`<g aria-hidden="true"><defs><clipPath id="herocl"><circle cx="${cx}" cy="${cy}" r="31"/></clipPath></defs><circle cx="${cx}" cy="${cy}" r="31" fill="${COL.white}"/>
      <image href="${ki.img}" x="${cx-36}" y="${cy-38}" width="72" height="84" preserveAspectRatio="xMidYMin slice" clip-path="url(#herocl)"/><image href="${look.ring}" x="${cx-41}" y="${cy-41}" width="82" height="82"/></g>`}
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
