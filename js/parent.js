'use strict';
// Кабинет родителя (порт renderParentHub / настроек из Android): «Моя семья» — дети карточками, затем разделы-плитки.
// Разделы (макет v2): На проверке, Задания, Прогресс, Цели, Желания, О семье, Настройки; внизу — родительская навигация. Прежний список: На проверке, Задания, Прогресс и помощь, Цели, Желания, Знакомство, Настройки. PIN вводится один раз при входе в кабинет.
let parentPage='hub';   // hub | review | tasks | report | goals | wishes | settings
const PAGE_T={review:'На проверке',tasks:'Задания',report:'Прогресс и помощь',goals:'Цели',wishes:'Желания',settings:'Настройки'};
const ageT=a=>a+' '+plural(a,'год','года','лет');
const tile=(page,img,title,note,i)=>`<div class="task c${i%5}" data-act="pp" data-id="${page}" role="button" tabindex="0" aria-label="${title}${note?'. '+note:''}" style="cursor:pointer"><img class="ic" src="img/${img}.png" alt=""><div class="tx"><h3>${title}</h3>${note?`<div class="small">${note}</div>`:''}</div><span style="font-size:26px;font-weight:800;color:var(--blue)" aria-hidden="true">›</span></div>`;

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
// Главная кабинета «Моя семья» (макет v2): заголовок с настройками, выбор ребёнка, блок проверки, «Задания» + «Создать», сетка 2×2, копия данных.
// Счётчик проверки — по выбранному ребёнку (очередь у каждого своя), поэтому подписан его именем. Все разделы и вложенные функции прежние.
const chev='<span style="font-size:26px;font-weight:800;color:var(--blue)" aria-hidden="true">›</span>';
const gtile=(attrs,img,title,note,i)=>`<div class="gtile c${i}" ${attrs} role="button" tabindex="0" aria-label="${title}${note?'. '+note:''}"><img src="img/${img}.png" alt=""><h3>${title}</h3><div class="small">${note}</div></div>`;
function parentHub(k){
  const wa=k.tasks.filter(t=>t.status==='WAITING_APPROVAL').length,pd=k.purchases.filter(isOpenP),late=pd.filter(p=>waitDays(p)>=OVERDUE_DAYS).length,name=kinfo().name;
  const d=daysSinceBackup();
  let h=`<div class="top"><div class="hello">Кабинет родителя<b>Моя семья</b></div><button class="gear" data-act="pp" data-id="settings" aria-label="Настройки" style="width:48px;height:48px"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/></svg></button></div>
  <div class="kids" role="group" aria-label="Выбор ребёнка">${KIDS.map(x=>{const a=S.kids[x.id].age,on=x.id===S.cur;return`<button class="pkid${on?' on':''}" data-act="who" data-id="${x.id}" data-stay="1" aria-pressed="${on}" aria-label="${x.name}${a?', '+ageT(a):''}${on?', выбрано':''}"><img src="${x.img}" alt=""><span class="nm"><b>${x.name}</b>${a?`<span class="small">${ageT(a)}</span>`:''}${on?'<span class="sel">✓ Выбран</span>':''}</span></button>`}).join('')}</div>`;
  h+=backupNag();
  h+=wa?`<div class="revbox"><div class="rt"><div class="small" style="color:#27407F">На проверке · ${esc(name)}</div><h2>${wa} ${plural(wa,'задание','задания','заданий')}</h2><div class="small" style="color:#27407F">ждут вашего решения</div></div><button class="btn sm white" data-act="pp" data-id="review">Проверить</button></div>`
    :`<div class="revbox calm"><div class="rt"><div class="small" style="color:#27407F">На проверке · ${esc(name)}</div><h2>Всё проверено</h2></div><button class="btn sm white" data-act="pp" data-id="review">Открыть</button></div>`;
  h+=`<div class="task c1 trow"><div class="tmain" data-act="pp" data-id="tasks" role="button" tabindex="0" aria-label="Задания. Расписание и повторы"><img class="ic" src="img/ref_task_bag.png" alt=""><div class="tx"><h3>Задания</h3><div class="small">Расписание и повторы</div></div></div><button class="btn sm" data-act="addtask">Создать</button></div>`;
  h+=`<div class="g2">${gtile('data-act="pp" data-id="report"','ref_nav_bars','Прогресс','отчёты и помощь',2)}${gtile('data-act="pp" data-id="goals"','ref_stat_target','Цели','недельные цели',3)}
   ${gtile('data-act="pp" data-id="wishes"','ref_stat_star','Желания',pd.length?(late?`ждут выдачи: ${pd.length}, давно: ${late}`:'ждут выдачи: '+pd.length):'награды, которые копит ребёнок',4)}${gtile('data-act="i_open"','ref_skill_book','О семье',S.intro.done?'знакомство и договорённости':'пройти знакомство',0)}</div>`;
  h+=`<div class="task c0 bkrow"><svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true" style="flex:none"><path fill="none" stroke="${COL.blue}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" d="M6 2.8h8l4.2 4.2V20a1.2 1.2 0 0 1-1.2 1.2H6A1.2 1.2 0 0 1 4.8 20V4A1.2 1.2 0 0 1 6 2.8zM14 2.8V7h4.2M12 10.5v6M9.5 14.2l2.5 2.5 2.5-2.5"/></svg><div class="tx"><h3>Копия данных</h3><div class="small">${S.lastBackup?'последняя: '+S.lastBackup.split('-').reverse().join('.'):'копия ещё не делалась'} · файл на этом телефоне</div></div><button class="btn sm soft" data-act="backup">Сохранить</button></div>
   <button class="btn full soft" data-act="lock" style="margin-top:6px">Выйти из кабинета</button>`;
  return h;
}
function pageReview(k){
  const wa=k.tasks.filter(t=>t.status==='WAITING_APPROVAL');
  let h='<div class="sec"><h2>Ожидают проверки</h2><span class="cnt">'+wa.length+'</span></div>';
  if(!wa.length)h+='<div class="empty">Нечего проверять</div>';
  wa.forEach(t=>h+=`<div class="task c1"><img class="ic" src="${iconFor(t.title)}" alt=""><div class="tx"><h3>${esc(t.title)}</h3><div class="meta">${rew(t)}</div></div>
    <button class="go" style="background:var(--green);color:var(--white)" data-act="review" data-id="${t.id}" aria-label="Проверить">✓</button><button class="go" style="background:var(--red);color:var(--white)" data-act="reject" data-id="${t.id}" aria-label="Вернуть на доработку">✕</button></div>`);
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
  return `<div class="task c0" data-act="editkid" role="button" tabindex="0" style="cursor:pointer"><div class="tx"><h3>Профиль ребёнка</h3><div class="small">${kinfo().name}${a?' · '+ageT(a):''}</div></div><span style="font-size:26px;font-weight:800;color:var(--blue)" aria-hidden="true">›</span></div>
  <div class="task c1" data-act="chpin" role="button" tabindex="0" style="cursor:pointer"><div class="tx"><h3>Родительский PIN</h3><div class="small">сменить PIN входа в кабинет</div></div><span style="font-size:26px;font-weight:800;color:var(--blue)" aria-hidden="true">›</span></div>
  <div class="task c2" data-act="sound" role="button" tabindex="0" style="cursor:pointer"><div class="tx"><h3>Звук наград</h3><div class="small">${S.sound===false?'выключен':'включён'}: нажмите, чтобы ${S.sound===false?'включить':'выключить'}</div></div></div>
  <div class="task c3" data-act="help" role="button" tabindex="0" style="cursor:pointer"><div class="tx"><h3>Помощь</h3><div class="small">как устроены задания, награды и PIN</div></div><span style="font-size:26px;font-weight:800;color:var(--blue)" aria-hidden="true">›</span></div>
  ${backupBlock()}${parentDecoBlock(k)}<div class="sec"><h2>Данные семьи</h2></div><p class="small" style="margin:0 4px 8px">Данные хранятся только на этом устройстве. Удаление нельзя отменить.</p><button class="btn sm red" data-act="reset">Удалить данные семьи</button>`;
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
