'use strict';
// Кабинет родителя (порт renderParentHub / настроек из Android): «Моя семья» — дети карточками, затем разделы-плитки.
// Разделы: На проверке, Задания, Прогресс и помощь, Цели, Желания, Знакомство, Настройки. PIN вводится один раз при входе в кабинет.
let parentPage='hub';   // hub | review | tasks | report | goals | wishes | settings
const PAGE_T={review:'На проверке',tasks:'Задания',report:'Прогресс и помощь',goals:'Цели',wishes:'Желания',settings:'Настройки'};
const ageT=a=>a+' '+plural(a,'год','года','лет');
const tile=(page,img,title,note,i)=>`<div class="task c${i%5}" data-act="pp" data-id="${page}" role="button" tabindex="0" aria-label="${title}${note?'. '+note:''}" style="cursor:pointer"><img class="ic" src="img/${img}.png" alt=""><div class="tx"><h3>${title}</h3>${note?`<div class="small">${note}</div>`:''}</div><span style="font-size:26px;font-weight:800;color:#1F6BFF" aria-hidden="true">›</span></div>`;

function viewParent(){
  if(!unlocked){
    return `<div class="top"><div class="hello"><b>Кабинет родителя</b></div></div><div class="card"><p style="margin-top:0">${S.pin?'Введите PIN, чтобы продолжить.':'Придумайте PIN из 4–6 цифр. Он защитит проверку заданий и кабинет родителя.'}</p>
    <input id="pin" class="pin" type="password" inputmode="numeric" maxlength="6" placeholder="••••" autocomplete="off">
    <button class="btn full" data-act="${S.pin?'unlock':'newpin'}">${S.pin?'Войти':'Установить PIN'}</button>${S.pin?'<button class="btn sm soft" data-act="forgot" style="margin-top:12px">Забыли PIN?</button>':''}</div>`;
  }
  if(introOpen)return introView();
  const k=K();
  if(parentPage==='hub')return parentHub(k);
  const back='<button class="btn sm soft" data-act="pp" data-id="hub" style="margin-bottom:8px" aria-label="Назад в кабинет родителя">‹ Кабинет родителя</button>';
  return `${back}<div class="top"><div class="hello"><b>${PAGE_T[parentPage]}</b>${kinfo().name}</div></div>`+({review:pageReview,tasks:pageTasks,report:pageReport,goals:pageGoals,wishes:pageWishes,settings:pageSettings}[parentPage]||pageReview)(k);
}
function parentHub(k){
  const wa=k.tasks.filter(t=>t.status==='WAITING_APPROVAL').length,pd=k.purchases.filter(isOpenP),late=pd.filter(p=>waitDays(p)>=OVERDUE_DAYS).length;
  let h=`<div class="top"><div class="hello">Кабинет родителя<b>Моя семья</b></div></div>
  <div class="kids">${KIDS.map(x=>{const a=S.kids[x.id].age;return`<button class="kid ${x.id===S.cur?'on':''}" data-act="who" data-id="${x.id}" data-stay="1" aria-label="${x.name}${a?', '+ageT(a):''}${x.id===S.cur?', выбрано':''}"><img src="${x.img}" alt="">${x.name}${a?`<span class="small" style="display:block;font-weight:400">${ageT(a)}</span>`:''}</button>`}).join('')}</div>`;
  h+=tile('review','ref_stat_check','На проверке',wa?'ждут проверки: '+wa:'',0)+tile('tasks','ref_task_bag','Задания','назначить, расписание и повторы',1)
    +tile('report','ref_nav_bars','Прогресс и помощь','отчёты по неделям, навыки',2)+tile('goals','ref_stat_target','Цели','недельные цели',3)
    +tile('wishes','ref_stat_star','Желания',pd.length?(late?`ждут выдачи: ${pd.length}, давно: ${late}`:'ждут выдачи: '+pd.length):'награды, которые ребёнок копит',4)
    +`<div class="task c0" data-act="i_open" role="button" tabindex="0" style="cursor:pointer"><img class="ic" src="img/ref_skill_book.png" alt=""><div class="tx"><h3>${S.intro.done?'Знакомство: пройти заново':'Знакомство с семьёй'}</h3><div class="small">о семье, как мы благодарим, желания ребёнка</div></div><span style="font-size:26px;font-weight:800;color:#1F6BFF" aria-hidden="true">›</span></div>`
    +tile('settings','ref_nav_menu','Настройки','профиль, PIN, звук, помощь, данные',1)
    +'<button class="btn full soft" data-act="lock" style="margin-top:6px">Выйти из кабинета</button>';
  return h;
}
function pageReview(k){
  const wa=k.tasks.filter(t=>t.status==='WAITING_APPROVAL');
  let h='<div class="sec"><h2>Ожидают проверки</h2><span class="cnt">'+wa.length+'</span></div>';
  if(!wa.length)h+='<div class="empty">Нечего проверять</div>';
  wa.forEach(t=>h+=`<div class="task c1"><img class="ic" src="${iconFor(t.title)}" alt=""><div class="tx"><h3>${esc(t.title)}</h3><div class="meta">${rew(t)}</div></div>
    <button class="go" style="background:#22C274;color:#fff" data-act="review" data-id="${t.id}" aria-label="Проверить">✓</button><button class="go" style="background:#F0486B;color:#fff" data-act="reject" data-id="${t.id}" aria-label="Вернуть на доработку">✕</button></div>`);
  return h+parentPendingBlock(k);
}
function pageTasks(k){
  let h=`<div class="row" style="margin-bottom:12px"><button class="btn sm" data-act="addtask">+ Своё</button><button class="btn sm soft" data-act="catalog">Из каталога</button></div><div class="sec"><h2>На сегодня</h2></div>`;
  const av=todays(k).filter(t=>t.status==='AVAILABLE');
  if(!av.length)h+='<div class="empty">На сегодня заданий нет</div>';
  av.forEach((t,i)=>h+=`<div class="task c${i%5}"><img class="ic" src="${iconFor(t.title)}" alt=""><div class="tx"><h3>${esc(t.title)}</h3><div class="meta">${rew(t)}</div></div><button class="go" data-act="del" data-id="${t.id}" aria-label="Удалить задание">${ico('trash-outline')}</button></div>`);
  const tps=k.templates.filter(x=>x.active);
  if(tps.length){h+=`<div class="sec"><h2>Повторяются</h2><span class="cnt">${tps.length}</span></div>`;
    tps.forEach(x=>h+=`<div class="task c3"><img class="ic" src="${iconFor(x.title)}" alt=""><div class="tx"><h3>${esc(x.title)}</h3><div class="meta"><span>${x.rec==='daily'?'каждый день':'по будням'}</span><span>${I.coin} ${x.coins}</span></div></div><button class="go" data-act="deltpl" data-id="${x.id}" aria-label="Остановить повтор">${ico('trash-outline')}</button></div>`)}
  return h;
}
const pageReport=k=>reportBlock(k)+parentSkillsBlock(k);
function pageGoals(k){
  let h='<button class="btn sm soft" data-act="addgoal">+ Цель</button><div style="height:10px"></div>';
  const act=k.goals.filter(g=>g.status==='ACTIVE');
  if(!act.length)h+='<div class="empty">Целей пока нет</div>';
  act.forEach(g=>{const p=goalProgress(k,g),sk=g.skill&&skillById(k,g.skill);
    h+=`<div class="task c1"><div class="tx"><h3>${esc(g.title)}</h3><div class="meta"><span>${Math.min(p.done,g.target)} из ${g.target} на этой неделе</span>${sk?`<span>Навык: ${esc(sk.title)}</span>`:'<span>Любые задания</span>'}</div></div><button class="go" data-act="delgoal" data-id="${g.id}" aria-label="Убрать цель">${ico('trash-outline')}</button></div>`});
  return h;
}
const pageWishes=k=>parentPendingBlock(k)+parentWishesBlock(k);
function pageSettings(k){
  const a=k.age;
  return `<div class="task c0" data-act="editkid" role="button" tabindex="0" style="cursor:pointer"><div class="tx"><h3>Профиль ребёнка</h3><div class="small">${kinfo().name}${a?' · '+ageT(a):''}</div></div><span style="font-size:26px;font-weight:800;color:#1F6BFF" aria-hidden="true">›</span></div>
  <div class="task c1" data-act="chpin" role="button" tabindex="0" style="cursor:pointer"><div class="tx"><h3>Родительский PIN</h3><div class="small">сменить PIN входа в кабинет</div></div><span style="font-size:26px;font-weight:800;color:#1F6BFF" aria-hidden="true">›</span></div>
  <div class="task c2" data-act="sound" role="button" tabindex="0" style="cursor:pointer"><div class="tx"><h3>Звук наград</h3><div class="small">${S.sound===false?'выключен':'включён'}: нажмите, чтобы ${S.sound===false?'включить':'выключить'}</div></div></div>
  <div class="task c3" data-act="help" role="button" tabindex="0" style="cursor:pointer"><div class="tx"><h3>Помощь</h3><div class="small">как устроены задания, награды и PIN</div></div><span style="font-size:26px;font-weight:800;color:#1F6BFF" aria-hidden="true">›</span></div>
  <div class="sec"><h2>Данные семьи</h2></div><p class="small" style="margin:0 4px 8px">Данные хранятся только на этом устройстве. Удаление нельзя отменить.</p><button class="btn sm red" data-act="reset">Удалить данные семьи</button>`;
}
// ---- окна ----
function kidForm(){
  const k=K(),ages=obAges(S.cur);
  const m=modal(`<h3>Имя и возраст</h3><label>Имя</label><input id="kf-n" maxlength="${OB_NAME_MAX}" value="${esc(k.name||'')}" placeholder="${KID_DEF[S.cur]}"><label>Возраст</label><select id="kf-a"><option value="">Не указан</option>${ages.map(x=>`<option value="${x}" ${k.age===x?'selected':''}>${ageT(x)}</option>`).join('')}</select><button class="btn full" id="kf-ok">Сохранить</button>`);
  m.querySelector('#kf-ok').onclick=()=>{const nm=m.querySelector('#kf-n').value.trim().slice(0,OB_NAME_MAX),a=Number(m.querySelector('#kf-a').value);
    if(nm)k.name=nm;else delete k.name;if(a)k.age=a;else delete k.age;save();m.remove();toast('Сохранено');render()};
}
function pinForm(){
  const m=modal('<h3>Сменить PIN</h3><label>Текущий PIN</label><input id="cp-o" class="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off"><label>Новый PIN (4–6 цифр)</label><input id="cp-n" class="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off"><label>Новый PIN ещё раз</label><input id="cp-n2" class="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off"><button class="btn full" id="cp-ok">Сменить PIN</button>');
  m.querySelector('#cp-ok').onclick=async()=>{const o=m.querySelector('#cp-o').value,n=m.querySelector('#cp-n').value,n2=m.querySelector('#cp-n2').value;
    if(!await checkPin(o))return toast('Текущий PIN неверный');
    if(!/^\d{4,6}$/.test(n))return toast('PIN: 4–6 цифр');
    if(n!==n2)return toast('Новый PIN не совпадает');
    await setPin(n);m.remove();toast('PIN изменён. Запомните новый PIN.')};
}
function helpDialog(){
  const m=modal(`<h3>Помощь</h3><p class="ip">• Родитель назначает задание, ребёнок отмечает «Я сделал!», родитель проверяет.</p><p class="ip">• Награда (монеты и опыт) начисляется один раз и только после подтверждения родителя.</p><p class="ip">• Если задание вернули, награды нет: ребёнок может сделать его ещё раз.</p><p class="ip">• Ступени навыков и «уровень помощи» — наблюдения семьи, а не оценка ребёнка.</p><p class="ip">• PIN нужен для входа в кабинет родителя; он вводится один раз при входе.</p><button class="btn full" id="hp-ok">Понятно</button>`);
  m.querySelector('#hp-ok').onclick=()=>m.remove();
}
