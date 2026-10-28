'use strict';
const KEY='yamogu_v2';
const KIDS=[{id:'kirill',name:'Кирилл',img:'img/kirill_portrait.png',cls:'k'},{id:'vika',name:'Вика',img:'img/vika_portrait.png',cls:'v'}];
const ICONS=[ // подбор иконки по ключевому слову в названии
 [/уроки|домашн|читать|почитать|книг/i,'ref_skill_book'],[/портфел|сумк/i,'ref_task_bag'],[/одежд|форм/i,'ref_task_shirt'],
 [/комнат|кроват|порядок|спать|сну/i,'ref_task_bed'],[/пыль|пылесос|мусор|убр/i,'ref_skill_broom'],[/ужин|кухн|посуд|еда/i,'ref_skill_kitchen'],
 [/спорт|зарядк/i,'skill_sport'],[/деньг|коп/i,'skill_money'],[/план/i,'skill_plan']];
const iconFor=t=>'img/'+((ICONS.find(x=>x[0].test(t))||[0,'ref_stat_target'])[1])+'.png';
const CATALOG=[
 {t:'Подготовить одежду на завтра',d:'',c:10},
 {t:'Комната перед сном',d:'1. Форма на завтра на вешалке.\n2. Игрушки и книжки на полки.',c:20},
 {t:'Уроки',d:'1. Сначала сложное, потом лёгкое.\n2. Решаем на черновике, переписываем на чистовик.',c:30},
 {t:'Собрать портфель и сумку на занятие',d:'1. Собрать портфель в школу.\n2. Сумка на занятие собрана в коридоре.',c:20},
 {t:'Вечер: зубы и душ',d:'1. Почистить зубы.\n2. Принять душ.',c:10},
 {t:'Почитать перед сном',d:'Почитать оставшееся время до 21:30.',c:10},
 {t:'Вынести мусор',d:'',c:10},
 {t:'Пропылесосить комнату',d:'',c:20},
 {t:'Протереть пыль',d:'Стереть пыль со стола и стеллажа.',c:10},
 {t:'Помочь с ужином',d:'1. Накрыть на ужин.\n2. Сполоснуть тарелку и приборы, поставить в посудомойку.',c:20}
];
// wishes: [{id,title,price}], purchases: [{id,wishId,title,price,status:BOUGHT|POSTPONED|DELIVERED|CANCELLED}]
const blank=()=>({tasks:[],xp:0,coins:0,wishes:[],purchases:[]});
const freshIntro=()=>({step:0,done:false,family:{},wish:{},wk:null,draft:null});
function normalize(s){
  s.intro=s.intro||freshIntro();
  for(const id in s.kids){const k=s.kids[id];k.wishes=k.wishes||[];k.purchases=k.purchases||[];
    (k.spent||[]).forEach(p=>k.purchases.push({id:uid(),wishId:'',title:p.title,price:p.price,status:'DELIVERED'}));delete k.spent}
  return s;
}
function load(){
  try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.kids)return normalize(s)}catch(e){}
  const s={kids:{kirill:blank(),vika:blank()},cur:null,pin:null};
  try{const o=JSON.parse(localStorage.getItem('yamogu_v1')); // перенос данных первой версии
    if(o&&o.tasks){Object.assign(s.kids.kirill,{tasks:o.tasks,xp:o.xp,coins:o.coins,wishes:o.wishes||[],spent:o.spent||[]});s.pin=o.pin||null}}catch(e){}
  return normalize(s);
}
let S=load();
// Свободный баланс = заработано − цена каждой не отменённой покупки (как WishStore.available)
const held=k=>k.purchases.filter(p=>p.status!=='CANCELLED').reduce((a,p)=>a+p.price,0);
const avail=k=>Math.max(0,k.coins-held(k));
const openPurchase=(k,wishId)=>k.purchases.find(p=>p.wishId===wishId&&(p.status==='BOUGHT'||p.status==='POSTPONED'));
const save=()=>localStorage.setItem(KEY,JSON.stringify(S));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const K=()=>S.kids[S.cur], kinfo=()=>KIDS.find(k=>k.id===S.cur);

// ---- Правила (как TaskRepositoryRules.kt) ----
function submit(id){const t=K().tasks.find(x=>x.id===id&&x.status==='AVAILABLE');if(t){t.status='WAITING_APPROVAL';save()}}
function reject(id){const t=K().tasks.find(x=>x.id===id&&x.status==='WAITING_APPROVAL');if(t){t.status='AVAILABLE';save()}}
function approve(id){const k=K(),t=k.tasks.find(x=>x.id===id&&x.status==='WAITING_APPROVAL');if(!t)return; // награда ровно один раз
  t.status='COMPLETED';k.xp+=t.xp;k.coins+=t.coins;save()}
function del(id){const k=K(),i=k.tasks.findIndex(x=>x.id===id&&x.status==='AVAILABLE');if(i>=0){k.tasks.splice(i,1);save()}}

// ---- PIN (соль + SHA-256) ----
async function sha(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function setPin(p){const salt=uid();S.pin={salt,hash:await sha(salt+p)};save()}
async function checkPin(p){return !!S.pin&&await sha(S.pin.salt+p)===S.pin.hash}

// ================= «Знакомство родителя» (порт ParentIntro.kt) =================
const NONE='NONE',UNL=9,TXT='_txt',DAILY=110,MAXW=8;
const STARTERS=[
 ['Подготовить одежду на завтра','готовить одежду на завтра','Подготовить одежду на завтра','Одежда лежит на стуле к вечеру'],
 ['Собрать рюкзак к следующему дню','собирать рюкзак к следующему дню','Собрать рюкзак к завтрашнему дню','Рюкзак собран и стоит у двери'],
 ['Убрать вещи после игры','убирать вещи после игры','Убрать вещи после игры','Игрушки лежат на местах'],
 ['Убрать за собой после еды','убирать за собой после еды','Убрать за собой после еды','Тарелка и чашка в раковине'],
 ['Привести кровать в порядок','приводить кровать в порядок','Заправить кровать','Одеяло накрыто, подушка на месте. Достаточно хорошо, не обязательно идеально'],
 ['Подготовить место для занятий','готовить место для занятий','Подготовить место для занятий','Стол свободен, всё нужное под рукой']
].map(a=>({title:a[0],inf:a[1],task:a[2],ready:a[3]}));
const starterOf=f=>(f.q2||[]).map(Number).filter(i=>i>=0&&i<STARTERS.length).map(i=>STARTERS[i])[0];
function familyQ(i,f){
  const deed=(starterOf(f)||{}).inf||'небольшие повседневные дела',several='Можно выбрать несколько вариантов.';
  return [
  {id:'q1',t:'Что вы хотели бы облегчить в первую очередь?',o:['Меньше повторять одни и те же просьбы','Спокойнее договариваться о повседневных делах','Помочь ребёнку делать больше самостоятельно','Помочь доводить небольшие дела до конца','Поддержать то, что уже получается','Пока не знаю'],m:UNL,ex:[5],hint:several,afterAny:'Не нужно менять всё сразу. Можно начать с одного посильного дела.'},
  {id:'q2',t:'С какого небольшого дела вам хотелось бы начать?',o:STARTERS.map(s=>s.title).concat('Пока не знаю, покажите варианты'),m:UNL,ex:[6],hint:'Можно отметить несколько дел. Начнём с первого из отмеченных. Своё задание можно будет написать перед сохранением.'},
  {id:'q3',t:`За последние 7 дней как обычно получалось: ${deed}?`,o:['Самостоятельно','После напоминания, дальше самостоятельно','С небольшой помощью по ходу дела','Вместе со взрослым большую часть времени','Каждый раз по-разному','За эту неделю не пробовали','Не знаю / не наблюдал(а)'],m:UNL,ex:[5,6],hint:several},
  {id:'q4',t:`В скольких из последних 7 дней приходилось напоминать — ${deed} — дважды или больше?`,o:['Ни в один день','В 1–2 дня','В 3–4 дня','В 5–7 дней','За неделю такого дела не было','Не помню / трудно сказать'],m:1},
  {id:'q5',t:'За последние 7 дней как обычно проходила просьба начать это дело?',o:['Обычно спокойно','Ребёнку нужно время, чтобы переключиться','Нередко возникали расстройство или спор','По-разному','За неделю такой ситуации не было','Трудно сказать'],m:UNL,ex:[4,5],hint:several,afterAnswer:{2:'Когда вокруг обычных дел возникают споры, это может утомлять. Попробуем выбрать одно небольшое действие и заранее договориться, что будет считаться готовым.'}},
  {id:'q6',t:'Что, по вашим наблюдениям, чаще затрудняет это дело?',o:['Трудно сделать первый шаг','Трудно удержать последовательность шагов','Трудно оторваться от текущего занятия','Дело начинается, но остаётся незавершённым','К этому времени ребёнок часто устаёт','Сейчас особых трудностей нет','Что-то другое','Пока не понимаю'],m:2,ex:[5,7],hint:'Это ваше наблюдение, а не установленная причина. Можно выбрать до двух.'},
  {id:'q7',t:'Какой вариант поддержки вам удобнее попробовать сначала?',o:['Короткое напоминание в подходящий момент','Сначала сделать вместе','Небольшую подсказку из нескольких шагов','Предложить ребёнку выбор, с чего начать','Пока не знаю'],m:UNL,ex:[4],hint:several}
  ][i];
}
function wishQ(i){
  const dk='Пока не знаю';
  return [
  {id:'w1',t:'Что ваш ребёнок любит делать в свободное время? Подумайте о прошлой неделе.',o:['Рисовать','Конструкторы','Спорт и двор','Мультфильмы','Игры на планшете','Читать','Готовить с вами','Животные','Музыка','Поделки'],m:UNL,ask:'Спросите ребёнка: «Чем тебе больше всего нравится заниматься?»',none:dk},
  {id:'w2',t:'Какие маленькие радости для него особенные?',o:['Сладкое','Выбрать мультфильм','Лечь попозже в выходной','Любимая прогулка','Позвать друга','Поход в кино','Новая книга или игрушка'],m:UNL,ask:'Спросите ребёнка: «Что тебя радует так, что хочется улыбаться?»',none:dk},
  {id:'w3',t:'О чём ваш ребёнок мечтает? Что он говорит: «вот бы…»?',o:[],m:1,ask:'Спросите ребёнка: «Если бы можно было загадать желание, какое?»',free:true,none:dk},
  {id:'w4',t:'Что он просил купить в последнее время?',o:['Игрушка','Одежда или обувь','Гаджет','Сладкое','Ничего'],m:UNL,ex:[4],ask:'Спросите ребёнка: «Что тебе сейчас очень хочется?»',none:dk},
  {id:'w5',t:'Какие подарки вы готовы дарить сами?',o:['Время вместе: настолки, прогулка','Выбор ужина','+15 минут экрана','Поход в кино или кафе','Карманные деньги','Подарок','Пока не хочу ничего материального'],m:UNL,ex:[6],ask:'Спросите ребёнка: «Что бы тебе хотелось делать вместе со мной?»',none:dk},
  {id:'w6',t:'Даёте ли вы ребёнку карманные деньги?',o:['Нет','Иногда','Регулярно','Хочу обсудить'],m:1,hint:'Приложение деньги не переводит и рубли не считает. Это подарок: вы сами выдаёте сумму и нажимаете «Выдано».',none:dk},
  {id:'w7',t:'Что для вас важно НЕ превращать в награду?',o:['Еда как награда','Сон','Прогулки и здоровье','Внимание и любовь','Учёба и чтение'],m:UNL,ask:'Выбранное мы не будем предлагать в магазине.',none:dk},
  {id:'w8',t:'Как ребёнок переносит долгое ожидание?',o:['Быстро теряет интерес','Терпеливо копит','По-разному'],m:1,none:dk},
  {id:'w9',t:'Сколько желаний завести сейчас?',o:['3 (рекомендуем)','5','8'],m:1,none:dk},
  {id:'w10',t:'Пусть ребёнок сам предлагает желания?',o:['Да, вы утвердите цену','Нет'],m:1,none:dk}
  ][i];
}
function toggleOpt(q,cur,idx){
  const key=String(idx);if(q.m<=1)return[key];
  const c=cur.filter(x=>x!==NONE);
  if(c.includes(key))return c.filter(x=>x!==key);
  if((q.ex||[]).includes(idx))return[key];
  const w=c.filter(x=>!(q.ex||[]).includes(Number(x)));
  if(q.m<UNL&&w.length>=q.m)return null;
  return w.concat(key);
}
const answered=(q,A)=>{const c=A[q.id]||[];return c.length>0||(q.free&&((A[q.id+TXT]||[])[0]||'').trim()!=='')};
function afterText(q,sel){const r=sel.filter(x=>x!==NONE);if(!r.length)return null;
  for(const x of r){if(q.afterAnswer&&q.afterAnswer[Number(x)])return q.afterAnswer[Number(x)]}return q.afterAny||null}
function familyResult(f){
  const base=starterOf(f)||STARTERS[1],ch=id=>(f[id]||[]).map(Number),hints=[];
  const sup={0:'Короткое напоминание: договоритесь об одном сигнале начала, вроде звонка таймера, и не повторяйте просьбу.',1:'Сначала сделайте вместе, потом выделите одну часть, которую попробует ребёнок.',2:'Короткая подсказка из 2–3 шагов в карточке задания, чтобы ребёнок видел, что дальше.',3:'Предложите ребёнку выбрать, с чего начать: так дело становится его решением.'};
  ch('q7').filter(i=>i in sup).slice(0,2).forEach(i=>hints.push({t:sup[i],w:'Вы выбрали этот вариант поддержки.'}));
  const q6=ch('q6'),q5=ch('q5');let ex=null;
  if(q6.includes(0))ex={t:'Покажите один конкретный первый шаг: «возьми рюкзак и поставь у двери».',w:'Вы отметили, что трудно начать.'};
  else if(q6.includes(1))ex={t:'Разбейте дело на 2–3 коротких шага в подсказке.',w:'Вы отметили, что трудно удержать последовательность.'};
  else if(q6.includes(3))ex={t:'Ясно скажите, что считается готовым, одной фразой.',w:'Вы отметили, что дело бывает трудно закончить.'};
  else if(q6.includes(2)||q5.includes(1))ex={t:'Заранее договоритесь о моменте перехода: «после этой серии идём собирать рюкзак».',w:'Вы отметили, что нужно время для переключения.'};
  else if(q6.includes(4))ex={t:'Выберите другое время или уменьшите объём дела.',w:'Вы отметили усталость в это время.'};
  else if(q5.includes(2))ex={t:'Заранее спокойно договоритесь, что будет считаться готовым.',w:'Вы хотите более спокойное начало.'};
  if(ex&&hints.length<2)hints.push(ex);
  if(!hints.length)hints.push({t:'Начните с малого: одно дело, один понятный критерий готовности.',w:'Подсказки подберём по мере работы.'});
  return{task:base.task,ready:base.ready,hints:hints.slice(0,2)};
}
function buildTable(w){
  const p=(id,i)=>(w[id]||[]).includes(String(i));
  const noFood=p('w7',0),noSleep=p('w7',1),noWalk=p('w7',2),noStudy=p('w7',4),nothing=p('w5',6);
  const R=[],add=(title,price,source,tag='')=>R.push({title,price,source,tag,on:true});
  add('Выбрать мультфильм на вечер',150,'ответы: радости, интересы');
  if(p('w5',2))add('+15 минут телефона',100,'вы готовы дарить: экран');
  if((p('w2',0)||p('w4',3))&&!noFood)add('Пирожное или мороженое',300,'ответы: сладкое');
  if(p('w2',2)&&!noSleep)add('На 30 минут позже лечь спать в выходной',400,'ответы: радости');
  if((p('w1',2)||p('w2',3))&&!noWalk)add('Прогулка в парк или на площадку по выбору',600,'ответы: интересы, радости');
  if(p('w2',4))add('Позвать друга в гости',700,'ответы: радости');
  if(p('w5',0))add('Вечер настолок или прогулка вместе',600,'вы готовы дарить: время вместе');
  if(p('w5',1))add('Выбрать, что будет на ужин',300,'вы готовы дарить: ужин');
  if(p('w5',3)||p('w2',5))add('Поход в кино',1500,'ответы: радости, подарки');
  const book=(p('w2',6)||p('w4',0))&&!noStudy&&!nothing;
  if(book)add('Новая книга или игрушка',2500,'ответы: радости, просьбы');
  if(p('w5',5)&&!book&&!nothing)add('Небольшой подарок на выбор',1200,'вы готовы дарить: подарок');
  if(p('w5',4)&&!nothing)add('Карманные деньги: родитель выдаёт сумму сам',800,p('w6',2)?'карманные деньги: регулярно':'вы готовы дарить: деньги','выдаёте вы');
  const dream=((w['w3'+TXT]||[])[0]||'').trim();
  if(dream.length>=2)add((dream[0].toUpperCase()+dream.slice(1)).slice(0,60),3000,'мечта ребёнка','цену назначаете вы');
  if(p('w8',0)){add('Лишние 10 минут игры во дворе',80,'ребёнок быстро теряет интерес: короткая цель');add('Выбрать музыку на вечер',100,'короткая цель')}
  if(!R.some(r=>r.price<=150))add('Выбрать мультфильм на вечер',150,'короткое желание: первая награда придёт быстро');
  let list=R.filter((r,i)=>R.findIndex(x=>x.title===r.title)===i);
  const big=list.find(r=>r.source==='мечта ребёнка'&&r.price>=1500)||list.find(r=>r.price>=1500);
  list=list.filter(r=>r.price<1500||r===big);
  const limit={'1':5,'2':8}[(w.w9||[])[0]]||3;
  const sorted=[...list].sort((a,b)=>a.price-b.price),pick=sorted.slice(0,limit);
  const sh=sorted.find(r=>r.price<=150);if(sh&&!pick.includes(sh))pick[pick.length-1]=sh;
  const dr=list.find(r=>r.source==='мечта ребёнка');
  if(dr&&!pick.includes(dr)){const v=[...pick].reverse().find(r=>r.price>150)||pick[pick.length-1];pick[pick.indexOf(v)]=dr}
  return pick.sort((a,b)=>a.price-b.price).slice(0,MAXW);
}
const days=p=>Math.max(1,Math.round(p/DAILY));
const FAM_FIRST=1,FAM_RES=8,GRAT=9,WISH_INTRO=10,WISH_FIRST=11,TABLE=21,FIN=22;
const intro=()=>S.intro;
const kidName=()=>(KIDS.find(k=>k.id===intro().wk)||{name:''}).name;
function introView(){
  const I=intro(),st=I.step;let h='',back=st>0&&st!==FIN,nextLbl='Далее',next=true,body='';
  const title=(t,s=25)=>`<h2 style="font-size:${s}px;margin:6px 0 10px">${t}</h2>`,p=(t,c='')=>`<p class="ip ${c}">${t}</p>`;
  const prog=`<div class="bar"><i style="width:${Math.round(100*st/FIN)}%"></i></div>`;
  if(st===0){body=title('Давайте познакомимся с вашей семьёй')+p('Сборы, напоминания и домашние дела не всегда идут легко, и это знакомо многим родителям. Ответьте на несколько вопросов: мы предложим небольшое первое дело и удобную подсказку.')+p('Если не хочется отвечать на какой-то вопрос, выберите «Не хочу отвечать». Это нормально и ничего не ухудшает.','muted');nextLbl='Начать'}
  else if(st>=FAM_FIRST&&st<FAM_RES){const q=familyQ(st-1,I.family);body=qView(q,I.family,`Семья · вопрос ${st} из 7`);next=answered(q,I.family);if(st===7)nextLbl='Показать результат'}
  else if(st===FAM_RES){const r=familyResult(I.family);
    body=title('Предлагаем начать с одного дела')+`<div class="card c0"><h3>${esc(r.task)}</h3><div class="small">Готово, когда: ${esc(r.ready)}.</div></div><h3 style="margin:12px 0 6px">Две подсказки для вас</h3>`+
    r.hints.map(x=>`<div class="card"><b>${esc(x.t)}</b><div class="small">${esc(x.w)}</div></div>`).join('')+
    p('Это идея, а не диагноз. Вы знаете своего ребёнка лучше всех. Задание можно изменить как угодно.','muted')+
    `<div class="row">${KIDS.map(k=>`<button class="btn sm soft" data-act="i_addstarter" data-id="${k.id}">Добавить задание: ${k.name}</button>`).join('')}</div>`}
  else if(st===GRAT){body=title('Как мы будем благодарить вашего ребёнка',24)+
    p('Самостоятельность растёт из ощущения «я могу». Детям очень важно, чтобы их старание заметили. Поэтому в «ЯмогУ!» мы не наказываем и не отнимаем заработанное. Мы благодарим за дело, сделанное вовремя и аккуратно.')+
    p('За каждое подтверждённое вами дело ребёнок получает виртуальные монеты. Их можно потратить в магазине, который мы создадим вместе с вами: в нём будут базовые подарки и ваши подарки, то, о чём вы знаете лучше всех.')+
    `<h3 style="margin:12px 0 6px">Три правила благодарности</h3>`+
    [['Замечайте усилие.','«Ты сам собрал портфель», а не просто «ты молодец».'],['Подарок — это «спасибо», а не торг.','Не говорите «если не сделаешь, не получишь». Ничего не отнимаем.'],['Договаривайтесь вместе.','Пусть ребёнок сам выбирает, за что копить. Тогда цель его, а не ваша.']].map((x,i)=>`<div class="card"><b>${i+1}. ${x[0]}</b><div class="small">${x[1]}</div></div>`).join('')}
  else if(st===WISH_INTRO){body=title('Желания вашего ребёнка')+p('Вы знаете своего ребёнка лучше всех. Ответьте на несколько вопросов: мы предложим желания, а вы решите, что оставить.')+p('Лучше всего задавать эти вопросы самому ребёнку: что бы он выбрал? Не торопитесь. Если не знаете, выберите «Пока не знаю».','muted')+
    `<h3 style="margin:12px 0 6px">Для кого заполняем?</h3><div class="kids">${KIDS.map(k=>`<button class="kid ${I.wk===k.id?'on':''}" data-act="i_wk" data-id="${k.id}"><img src="${k.img}" alt="">${k.name}</button>`).join('')}</div>`;next=!!I.wk}
  else if(st>=WISH_FIRST&&st<TABLE){const q=wishQ(st-WISH_FIRST),A=I.wish[I.wk]=I.wish[I.wk]||{};body=qView(q,A,`Желания: ${kidName()} · вопрос ${st-WISH_FIRST+1} из 10`);next=answered(q,A);if(st===TABLE-1)nextLbl='Собрать таблицу'}
  else if(st===TABLE){const D=I.draft||[],n=D.filter(r=>r.on).length;
    body=title('Таблица желаний: '+kidName(),22)+p(`Мы предложили желания по вашим ответам. Оставьте нужные, поменяйте цену, добавьте своё. Ориентир: около ${DAILY} монет в день.`,'muted')+
    D.map((r,i)=>`<div class="card ${r.on?'':'off'}"><div class="row" style="align-items:center;flex-wrap:nowrap"><button class="chk ${r.on?'on':''}" data-act="i_row" data-id="${i}" aria-label="Оставить">${r.on?'✓':''}</button><div style="flex:1"><b>${esc(r.title)}</b><div class="small">${esc(r.source)}${r.tag?' · '+esc(r.tag):''}</div></div></div>
      <div class="row" style="align-items:center;margin-top:8px"><input class="price" type="number" inputmode="numeric" data-price="${i}" value="${r.price}"><span class="small">монет · копить ~${days(r.price)} дн.</span></div></div>`).join('')+
    `<div class="row" style="flex-wrap:nowrap"><input id="addw" placeholder="Своё желание" maxlength="60" style="margin:0"><button class="btn sm soft" data-act="i_addwish">+</button></div><p class="ip muted" style="margin-top:12px">Подарки — это ваше обещание ребёнку. Если вы не выдали подарок за 7 дней, мы напомним.</p>`;
    nextLbl=n?`Сохранить в магазин (${n})`:'Выберите хотя бы одно желание';next=n>0}
  else if(st===FIN){const k=S.kids[I.wk];body=title('Знакомство завершено',24)+p(`Желания, которые увидит ${kidName()} во вкладке «Награды»:`)+(k.wishes.map(w=>`<div class="card"><b>${esc(w.title)}</b><div class="small">🪙 ${w.price}</div></div>`).join(''))+
    p('Монеты придут за подтверждённые вами дела. Нажав «Хочу!», ребёнок попросит подарок, а выдаёте его вы.','muted')+`<div class="row"><button class="btn sm soft" data-act="i_another">Заполнить для другого ребёнка</button></div>`;nextLbl='Готово'}
  return `<div class="top"><div class="hello"><b>Знакомство</b></div><button class="gear" data-act="i_exit" title="Выйти из знакомства">✕</button></div>${prog}<div style="height:12px"></div>${body}
   <div class="row" style="margin-top:14px;flex-wrap:nowrap">${back?'<button class="btn soft" data-act="i_back">Назад</button>':''}<button class="btn full" data-act="i_next" ${next?'':'disabled'}>${nextLbl}</button></div>`;
}
function qView(q,A,head){
  const sel=A[q.id]||[],none=sel.includes(NONE),at=afterText(q,sel);
  let h=`<div class="small" style="font-weight:800">${head}</div><h2 style="font-size:21px;margin:6px 0 8px">${esc(q.t)}</h2>`;
  if(q.hint)h+=`<p class="ip muted">${esc(q.hint)}</p>`;
  if(q.ask)h+=`<div class="card c3 small"><b>${esc(q.ask)}</b></div>`;
  if(q.free)h+=`<input id="free" data-free="${q.id}" maxlength="60" placeholder="Например: собака, велосипед, поездка к бабушке" value="${esc((A[q.id+TXT]||[''])[0])}">`;
  h+=q.o.map((o,i)=>`<button class="opt ${sel.includes(String(i))?'on':''}" data-act="i_opt" data-q="${q.id}" data-id="${i}">${esc(o)}</button>`).join('');
  h+=`<button class="opt none ${none?'on':''}" data-act="i_none" data-q="${q.id}">${esc(q.none||'Не хочу отвечать')}</button>`;
  if(at)h+=`<div class="card c2 small"><b>${esc(at)}</b></div>`;
  return h;
}
function qOf(id){return id[0]==='q'?familyQ(Number(id.slice(1))-1,intro().family):wishQ(Number(id.slice(1))-1)}
const ansOf=id=>id[0]==='q'?intro().family:(intro().wish[intro().wk]=intro().wish[intro().wk]||{});
function introAct(act,b){
  const I=intro(),id=b.dataset.id,qid=b.dataset.q;
  if(act==='i_opt'){const q=qOf(qid),A=ansOf(qid),r=toggleOpt(q,A[qid]||[],Number(id));if(r===null)return toast('Выберите до '+q.m+' вариантов');A[qid]=r;if(q.free){A[qid+TXT]=[]}}
  else if(act==='i_none'){const A=ansOf(qid);A[qid]=[NONE];if(qOf(qid).free)A[qid+TXT]=[]}
  else if(act==='i_wk'){I.wk=id}
  else if(act==='i_back'){I.step=Math.max(0,I.step-1)}
  else if(act==='i_addstarter'){const r=familyResult(I.family),k=S.kids[id];if(!k.tasks.some(t=>t.title===r.task&&t.status!=='COMPLETED'))k.tasks.push({id:uid(),title:r.task,desc:'Готово, когда: '+r.ready+'.',coins:10,xp:10,status:'AVAILABLE'});toast('Задание добавлено: '+KIDS.find(x=>x.id===id).name)}
  else if(act==='i_row'){I.draft[Number(id)].on=!I.draft[Number(id)].on}
  else if(act==='i_addwish'){const t=(document.getElementById('addw').value||'').trim();
    if(t.length<2||t.length>60)return toast('Название от 2 до 60 символов');if(I.draft.length>=MAXW)return toast('На старте не больше '+MAXW+' желаний');
    I.draft.push({title:t,price:500,source:'добавлено вами',tag:'цену назначаете вы',on:true})}
  else if(act==='i_another'){I.step=WISH_INTRO;I.wk=KIDS.find(k=>k.id!==I.wk).id;I.draft=null}
  else if(act==='i_exit'){introOpen=false}
  else if(act==='i_next'){
    if(I.step===TABLE){const kept=I.draft.filter(r=>r.on);
      if(kept.some(r=>!(r.price>=10&&r.price<=100000)))return toast('Цена от 10 до 100 000 монет');
      const k=S.kids[I.wk];k.wishes=kept.map(r=>({id:uid(),title:r.title,price:Math.round(r.price)}));I.step=FIN}
    else if(I.step===FIN){I.done=true;introOpen=false}
    else{I.step++;if(I.step===TABLE){I.draft=buildTable(ansOf('w1'))}
      if(I.step===FAM_RES)I.wish=I.wish||{}}
  }
  save();
}
let introOpen=false;
// ---- UI ----
let tab='tasks',unlocked=false;
const $app=document.getElementById('app');
function toast(m){const e=document.createElement('div');e.className='toast';e.textContent=m;document.body.appendChild(e);setTimeout(()=>e.remove(),1800)}
function modal(html){const m=document.createElement('div');m.className='modal';m.innerHTML='<div class="sheet">'+html+'</div>';
  m.addEventListener('click',e=>{if(e.target===m)m.remove()});document.body.appendChild(m);return m}
const rew=t=>`<span>⭐ ${t.xp} XP</span><span>🪙 ${t.coins}</span>`;

function render(){
  if(!S.cur){
    $app.innerHTML=`<main class="welcome"><img class="logo" src="img/ref_logo.png" alt="ЯмогУ!"><p>Я учусь. Я пробую. Я могу!</p>
    <h2>Кто сегодня играет?</h2><div class="pick">${KIDS.map(k=>`<button class="${k.cls}" data-act="who" data-id="${k.id}"><img src="${k.img}" alt="">${k.name}</button>`).join('')}</div></main>`;
    return;
  }
  const waiting=K().tasks.filter(t=>t.status==='WAITING_APPROVAL').length;
  const nav=(id,ic,l,extra='')=>`<button data-tab="${id}" class="${tab===id?'on':''}"><img src="img/ref_nav_${ic}${tab===id?'':'_off'}.png" alt="">${l}${extra}</button>`;
  $app.innerHTML=`<main>${tab==='tasks'?viewTasks():tab==='rewards'?viewRewards():tab==='progress'?viewProgress():viewParent()}</main>
  <nav>${nav('tasks','home','Задания')}${nav('rewards','star','Награды')}${nav('progress','bars','Прогресс')}
  ${nav('parent','menu','Родитель',waiting&&unlocked?`<span class="badge">${waiting}</span>`:'')}</nav>`;
}

function topbar(title){const ki=kinfo();return `<div class="top"><div class="ava"><img src="${ki.img}" alt=""></div>
  <div class="hello">${title}<b>${ki.name}! 👋</b></div><button class="gear" data-act="switch" title="Сменить ребёнка">🔄</button></div>`}

function viewTasks(){
  const k=K(),ki=kinfo(),lvl=Math.floor(k.xp/200)+1,inLvl=k.xp%200;
  const av=k.tasks.filter(t=>t.status==='AVAILABLE'),wa=k.tasks.filter(t=>t.status==='WAITING_APPROVAL'),co=k.tasks.filter(t=>t.status==='COMPLETED');
  const day=k.tasks.length-0, done=co.length+wa.length;
  let h=topbar('Привет,')+`<div class="hero"><img class="hk" src="${ki.img}" alt="">
   <div class="info"><h2>Уровень ${lvl}</h2><div class="bar"><i style="width:${inLvl/2}%"></i></div><div class="small">${inLvl} / 200 XP</div>
   <div class="stats"><div class="st"><img src="img/ref_stat_star.png" alt="">${k.xp}<span>XP</span></div><div class="st"><img src="img/skill_money.png" alt="">${avail(k)}<span>монет</span></div></div></div></div>
   <div class="sec"><h2>Мои задания</h2><span class="cnt">${done}/${k.tasks.length}</span></div>`;
  if(!k.tasks.length)h+='<div class="empty">Пока нет заданий.<br>Попроси родителя добавить их во вкладке «Родитель».</div>';
  av.forEach((t,i)=>h+=`<div class="task c${i%5}"><img class="ic" src="${iconFor(t.title)}" alt=""><div class="tx"><h3>${esc(t.title)}</h3>${t.desc?`<div class="desc">${esc(t.desc)}</div>`:''}<div class="meta">${rew(t)}</div></div><button class="go" data-act="submit" data-id="${t.id}" aria-label="Готово">›</button></div>`);
  wa.forEach(t=>h+=`<div class="task c2"><img class="ic" src="${iconFor(t.title)}" alt=""><div class="tx"><h3>${esc(t.title)}</h3><div class="meta">Ждёт проверки родителя ⏳</div></div></div>`);
  co.slice(-8).reverse().forEach(t=>h+=`<div class="task c3" style="opacity:.8"><img class="ic" src="${iconFor(t.title)}" alt=""><div class="tx"><h3>${esc(t.title)}</h3><div class="meta">${rew(t)}</div></div><img class="ok" src="img/ref_check_done.png" alt=""></div>`);
  return h;
}

function viewRewards(){
  const k=K(),av=avail(k),fz=k.purchases.filter(p=>p.status==='BOUGHT'||p.status==='POSTPONED').reduce((x,p)=>x+p.price,0);
  let h=topbar('Мои награды,')+`<div class="hero" style="min-height:0"><div class="big">🪙 ${av}</div><div class="small" style="text-align:center">мой баланс${fz?' · ждёт выдачи: '+fz:''} · ⭐ ${k.xp} XP</div></div><div class="sec"><h2>Мои желания</h2></div>`;
  if(!k.wishes.length)h+='<div class="empty">Желаний пока нет.<br>Родитель создаст их в «Родитель» → «Знакомство».</div>';
  k.wishes.forEach((w,i)=>{const op=openPurchase(k,w.id),can=!op&&av>=w.price;
    h+=`<div class="task c${(i+3)%5}"><div class="tx"><h3>${esc(w.title)}</h3><div class="meta"><span>🪙 ${w.price}</span><span>~${days(w.price)} дн.</span></div>
    <div class="bar"><i style="width:${Math.min(100,100*av/w.price)}%"></i></div></div>
    ${op?'<div class="small" style="font-weight:800">Ждёт выдачи ⏳</div>':`<button class="btn sm ${can?'green':'soft'}" ${can?'':'disabled'} data-act="buy" data-id="${w.id}">${can?'Хочу!':'ещё '+(w.price-av)}</button>`}</div>`});
  const dl=k.purchases.filter(p=>p.status==='DELIVERED');
  if(dl.length){h+='<div class="sec"><h2>Уже получено</h2></div>';dl.slice(-8).reverse().forEach(p=>h+=`<div class="task c0"><div class="tx"><h3>🎉 ${esc(p.title)}</h3><div class="meta">🪙 ${p.price}</div></div></div>`)}
  return h;
}

function viewProgress(){
  const k=K(),done=k.tasks.filter(t=>t.status==='COMPLETED').length,total=k.tasks.length,pct=total?Math.round(100*done/total):0;
  return topbar('Мой прогресс,')+`<div class="card"><h2>Выполнено заданий</h2><div class="big">${pct}%</div><div class="bar"><i style="width:${pct}%"></i></div><div class="small" style="text-align:center">${done} из ${total}</div></div>
  <div class="grid">
   <div class="card c2" style="text-align:center"><img src="img/ref_stat_star.png" height="56" alt=""><div class="big" style="font-size:30px">${k.xp}</div><div class="small">опыта</div></div>
   <div class="card c0" style="text-align:center"><img src="img/skill_money.png" height="56" alt=""><div class="big" style="font-size:30px">${k.coins}</div><div class="small">монет</div></div>
   <div class="card c3" style="text-align:center"><img src="img/ref_stat_check.png" height="56" alt=""><div class="big" style="font-size:30px">${done}</div><div class="small">выполнено</div></div>
   <div class="card c4" style="text-align:center"><img src="img/ref_stat_cup.png" height="56" alt=""><div class="big" style="font-size:30px">${k.purchases.filter(p=>p.status==='DELIVERED').length}</div><div class="small">наград получено</div></div>
  </div>`;
}

function viewParent(){
  if(!unlocked){
    return `<div class="top"><div class="hello"><b>Кабинет родителя</b></div></div><div class="card"><p style="margin-top:0">${S.pin?'Введите PIN, чтобы продолжить.':'Придумайте PIN из 4–6 цифр. Он защитит проверку заданий и кабинет родителя.'}</p>
    <input id="pin" class="pin" type="password" inputmode="numeric" maxlength="6" placeholder="••••" autocomplete="off">
    <button class="btn full" data-act="${S.pin?'unlock':'newpin'}">${S.pin?'Войти':'Установить PIN'}</button></div>`;
  }
  if(introOpen)return introView();
  const k=K(),wa=k.tasks.filter(t=>t.status==='WAITING_APPROVAL'),av=k.tasks.filter(t=>t.status==='AVAILABLE');
  let h=`<div class="top"><div class="hello"><b>Кабинет родителя</b></div></div>
  <div class="kids">${KIDS.map(x=>`<button class="kid ${x.id===S.cur?'on':''}" data-act="who" data-id="${x.id}" data-stay="1"><img src="${x.img}" alt="">${x.name}</button>`).join('')}</div>
  <button class="btn sm soft" data-act="i_open" style="margin-bottom:12px">${S.intro.done?'Знакомство: пройти заново':'Знакомство с семьёй'}</button>
  <div class="sec"><h2>Ожидают проверки</h2><span class="cnt">${wa.length}</span></div>`;
  if(!wa.length)h+='<div class="empty">Нечего проверять</div>';
  wa.forEach(t=>h+=`<div class="task c1"><img class="ic" src="${iconFor(t.title)}" alt=""><div class="tx"><h3>${esc(t.title)}</h3><div class="meta">${rew(t)}</div></div>
    <button class="go" style="background:#22C274;color:#fff" data-act="approve" data-id="${t.id}">✓</button><button class="go" style="background:#F0486B;color:#fff" data-act="reject" data-id="${t.id}">✕</button></div>`);
  const pd=k.purchases.filter(p=>p.status==='BOUGHT'||p.status==='POSTPONED');
  if(pd.length){h+=`<div class="sec"><h2>Подарки к выдаче</h2><span class="cnt">${pd.length}</span></div>`;
    pd.forEach(p=>h+=`<div class="task c4"><div class="tx"><h3>🎁 ${esc(p.title)}</h3><div class="meta">🪙 ${p.price}${p.status==='POSTPONED'?' · отложено':''}</div><div class="row" style="margin-top:8px"><button class="btn sm green" data-act="deliver" data-id="${p.id}">Выдано</button><button class="btn sm soft" data-act="postpone" data-id="${p.id}">Отложить</button><button class="btn sm red" data-act="cancelp" data-id="${p.id}">Отменить</button></div></div></div>`)}
  h+=`<div class="sec"><h2>Все задания</h2></div><div class="row" style="margin-bottom:12px"><button class="btn sm" data-act="addtask">+ Своё</button><button class="btn sm soft" data-act="catalog">Из каталога</button></div>`;
  av.forEach((t,i)=>h+=`<div class="task c${i%5}"><img class="ic" src="${iconFor(t.title)}" alt=""><div class="tx"><h3>${esc(t.title)}</h3><div class="meta">${rew(t)}</div></div><button class="go" data-act="del" data-id="${t.id}">🗑</button></div>`);
  h+='<div class="sec"><h2>Желания ребёнка</h2></div><button class="btn sm soft" data-act="addwish">+ Желание</button><div style="height:10px"></div>';
  k.wishes.forEach(w=>h+=`<div class="task c4"><div class="tx"><h3>${esc(w.title)}</h3><div class="meta">🪙 ${w.price}</div></div><button class="go" data-act="delwish" data-id="${w.id}">🗑</button></div>`);
  h+='<div class="sec"><h2>Прочее</h2></div><div class="row"><button class="btn sm soft" data-act="lock">Выйти из кабинета</button><button class="btn sm red" data-act="reset">Сбросить всё</button></div>';
  return h;
}

function taskForm(pre){
  const m=modal(`<h3>Новое задание для ${kinfo().name}</h3><label>Название</label><input id="f-t" value="${esc(pre.t||'')}">
   <label>Описание / шаги</label><textarea id="f-d" rows="3">${esc(pre.d||'')}</textarea>
   <div class="grid"><div><label>Монеты</label><input id="f-c" type="number" inputmode="numeric" value="${pre.c??10}"></div>
   <div><label>XP</label><input id="f-x" type="number" inputmode="numeric" value="${pre.x??10}"></div></div>
   <button class="btn full" id="f-ok">Добавить</button>`);
  m.querySelector('#f-ok').onclick=()=>{
    const t=m.querySelector('#f-t').value.trim();if(!t)return toast('Нужно название');
    const n=(id)=>Math.min(10000,Math.max(0,parseInt(m.querySelector(id).value)||0));
    K().tasks.push({id:uid(),title:t,desc:m.querySelector('#f-d').value.trim(),coins:n('#f-c'),xp:n('#f-x'),status:'AVAILABLE'});
    save();m.remove();render();
  };
}

document.addEventListener('click',async e=>{
  const tb=e.target.closest('[data-tab]');
  if(tb){tab=tb.dataset.tab;if(tab!=='parent'){unlocked=false;introOpen=false}return render()}
  const b=e.target.closest('[data-act]');if(!b)return;
  const id=b.dataset.id,act=b.dataset.act,pinVal=()=>(document.getElementById('pin')||{}).value||'';
  if(act==='who'){S.cur=id;save();if(!b.dataset.stay){tab='tasks';unlocked=false}}
  else if(act==='switch'){S.cur=null;unlocked=false;save()}
  else if(act==='submit'){submit(id);toast('Отправлено родителю 👍')}
  else if(act==='buy'){const k=K(),w=k.wishes.find(x=>x.id===id);if(w&&!openPurchase(k,w.id)&&avail(k)>=w.price){k.purchases.push({id:uid(),wishId:w.id,title:w.title,price:w.price,status:'BOUGHT'});save();toast('Попросили родителя 🎁')}}
  else if(act==='deliver'||act==='postpone'||act==='cancelp'){const p=K().purchases.find(x=>x.id===id);if(p&&(p.status==='BOUGHT'||p.status==='POSTPONED')){p.status=act==='deliver'?'DELIVERED':act==='postpone'?'POSTPONED':'CANCELLED';save();toast(act==='deliver'?'Выдано 🎉':act==='cancelp'?'Монеты возвращены':'Отложено')}}
  else if(act==='i_open'){introOpen=true}
  else if(act.startsWith('i_')){introAct(act,b)}
  else if(act==='newpin'){const p=pinVal();if(!/^\d{4,6}$/.test(p))return toast('PIN: 4–6 цифр');await setPin(p);unlocked=true;introOpen=!S.intro.done}
  else if(act==='unlock'){if(await checkPin(pinVal())){unlocked=true;introOpen=!S.intro.done}else return toast('Неверный PIN')}
  else if(act==='approve'){approve(id);toast('Награда выдана ⭐')}
  else if(act==='reject'){reject(id)}
  else if(act==='del'){del(id)}
  else if(act==='delwish'){K().wishes=K().wishes.filter(x=>x.id!==id);save()}
  else if(act==='lock'){unlocked=false;introOpen=false}
  else if(act==='addtask'){return taskForm({})}
  else if(act==='catalog'){
    const m=modal('<h3>Каталог заданий</h3>'+CATALOG.map((c,i)=>`<div class="task c${i%5}"><img class="ic" src="${iconFor(c.t)}" alt=""><div class="tx"><h3>${esc(c.t)}</h3><div class="meta">🪙 ${c.c}</div></div><button class="go" data-pick="${i}">+</button></div>`).join(''));
    m.addEventListener('click',ev=>{const p=ev.target.closest('[data-pick]');if(p){const c=CATALOG[+p.dataset.pick];m.remove();taskForm({t:c.t,d:c.d,c:c.c,x:10})}});return;
  }
  else if(act==='addwish'){
    const m=modal(`<h3>Новое желание</h3><label>Что хочется</label><input id="w-t"><label>Цена в монетах</label><input id="w-p" type="number" inputmode="numeric" value="50"><button class="btn full" id="w-ok">Добавить</button>`);
    m.querySelector('#w-ok').onclick=()=>{const t=m.querySelector('#w-t').value.trim(),p=parseInt(m.querySelector('#w-p').value)||0;if(!t||p<=0)return toast('Заполните поля');K().wishes.push({id:uid(),title:t,price:p});save();m.remove();render()};return;
  }
  else if(act==='reset'){if(confirm('Удалить все задания, монеты и PIN на этом устройстве?')){S=normalize({kids:{kirill:blank(),vika:blank()},cur:null,pin:null});save();unlocked=false;introOpen=false}else return}
  render();
});
document.addEventListener('input',e=>{const t=e.target;
  if(t.dataset&&t.dataset.free){const A=ansOf(t.dataset.free);A[t.dataset.free+TXT]=[t.value];A[t.dataset.free]=A[t.dataset.free]&&A[t.dataset.free][0]===NONE?[]:A[t.dataset.free]||[];save();
    const nb=document.querySelector('[data-act="i_next"]');if(nb)nb.disabled=!answered(qOf(t.dataset.free),A)}
  else if(t.dataset&&t.dataset.price!==undefined){intro().draft[Number(t.dataset.price)].price=parseInt(t.value)||0;save()}});
render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
