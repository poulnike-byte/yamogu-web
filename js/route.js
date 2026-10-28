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

function viewRoute(){
  const k=K(),ki=kinfo(),nodes=routeNodes(k),n=nodes.length;
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
  const pts=[{x:180,y:H-40},...nodes.map((_,i)=>pos(i)),sum];
  let d=`M${pts[0].x},${pts[0].y}`;
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],my=(a.y+b.y)/2;d+=` C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`}
  let svg=`<svg class="route" viewBox="0 0 ${ROUTE_W} ${H}" width="100%" role="img" aria-label="Карта маршрута: ${n} заданий">
    <path d="${d}" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="16" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="#9CC4FF" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 12"/>`;
  nodes.forEach((x,i)=>{const p=pos(i),c={DONE:'#22C274',WAIT:'#FFB200',CUR:'#1F6BFF',OPEN:'#FFFFFF'}[x.state];
    const mark=x.state==='DONE'?'<path d="M-12,0 L-4,8 L13,-9" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
      :x.state==='WAIT'?'<text y="9" text-anchor="middle" font-size="26">⏳</text>'
      :`<text y="10" text-anchor="middle" font-size="26" font-weight="800" fill="${x.state==='CUR'?'#fff':'#13206B'}">${i+1}</text>`;
    svg+=`<g class="rnode${x.state==='CUR'?' cur':''}" data-act="rnode" data-id="${x.t.id}" transform="translate(${p.x},${p.y})" tabindex="0" role="button" aria-label="${esc(x.t.title)}">
      ${x.state==='CUR'?'<circle r="40" fill="#1F6BFF" opacity=".18"/>':''}<circle r="32" fill="#0003" cy="4"/><circle r="32" fill="${c}" stroke="#fff" stroke-width="5"/>${mark}
      <text x="${p.x>=280?34:p.x<=80?-34:0}" y="56" text-anchor="${p.x>=280?'end':p.x<=80?'start':'middle'}" font-size="13" font-weight="800" fill="#13206B" stroke="#fff" stroke-width="4" paint-order="stroke">${esc(x.t.title.length>22?x.t.title.slice(0,21)+'…':x.t.title)}</text></g>`});
  // вершина с флагом
  svg+=`<g transform="translate(${sum.x},${sum.y})" opacity="${allDone?1:.55}"><circle r="36" fill="${allDone?'#FFD23A':'#E3E8F5'}" stroke="#fff" stroke-width="5"/>
    <path d="M-8,18 V-20" stroke="#13206B" stroke-width="5" stroke-linecap="round"/><path d="M-8,-20 L18,-12 L-8,-4 Z" fill="#F0486B"/></g>`;
  // герой рядом с текущим узлом
  const ci=nodes.findIndex(x=>x.state==='CUR'); if(ci>=0){const p=pos(ci),side=p.x>180?-1:1;
    svg+=`<image href="${ki.img}" x="${side>0?p.x+40:p.x-96}" y="${p.y-56}" width="56" height="84" preserveAspectRatio="xMidYMid meet"/>`}
  svg+='</svg>';
  return h+`<div class="routewrap">${svg}</div>
    ${allDone?'<div class="card c2"><b>Все задания выполнены! 🎉</b><div class="small">Монеты начислит родитель после проверки.</div></div>':''}
    <button class="btn full" data-act="toparent" style="margin-top:6px">Добавить задачу</button>`;
}

// Окно задания с маршрута: «Я сделал!» только отправляет родителю, награды не начисляет.
function routeTaskDialog(id){
  const t=K().tasks.find(x=>x.id===id); if(!t)return;
  const st=t.status, can=st==='AVAILABLE';
  const m=modal(`<h3>${esc(t.title)}</h3>${t.desc?`<div class="desc" style="margin-bottom:10px">${esc(t.desc)}</div>`:''}<div class="meta row" style="margin-bottom:12px">${rew(t)}</div>
    ${st==='WAITING_APPROVAL'?'<div class="card c2 small"><b>Ждёт проверки родителя ⏳</b></div>':st==='COMPLETED'?'<div class="card c2 small"><b>Выполнено ✓</b></div>':''}
    ${can?'<button class="btn full green" id="rt-ok">Я сделал!</button>':''}<button class="btn full soft" id="rt-no" style="margin-top:8px">Закрыть</button>`);
  m.querySelector('#rt-no').onclick=()=>m.remove();
  const ok=m.querySelector('#rt-ok'); if(ok)ok.onclick=()=>{submit(id);m.remove();toast('Отправлено родителю 👍');render()};
}
