'use strict';
// Первый запуск для ребёнка (порт OnboardingActivity / OnboardingState из Android): приветствие → знакомство → три первых навыка.
// Показывается один раз. Если на устройстве уже есть данные (PIN, выбранный ребёнок, задания, монеты...), онбординг считается пройденным и не прерывает работу.
// S.onb = {done, step 0..2, child, name, age, skills[]}; имя и возраст хранятся у ребёнка (k.name, k.age), выбранные навыки — S.interests (подсказки при создании заданий).
const OB_SKILLS=[['Утренние дела','ref_skill_bed'],['Собирать портфель','ref_skill_bag'],['Выбирать одежду','ref_skill_shirt'],['Помогать на кухне','ref_skill_kitchen'],
  ['Убирать в комнате','ref_skill_broom'],['Делать уроки','ref_skill_book'],['Заниматься спортом','skill_sport'],['Планировать день','skill_plan'],['Управлять деньгами','skill_money'],['Развивать знания','ref_skill_book']];
const OB_REQUIRED=3,OB_NAME_MAX=30,KID_DEF={kirill:'Кирилл',vika:'Вика'};
const obAges=id=>id==='vika'?[6,7,8,9]:[10,11,12];   // Вика 6–9, Кирилл 10–12
const hasAnyData=s=>!!(s.pin||s.cur||Object.values(s.kids).some(k=>k.tasks.length||k.coins||k.xp||k.wishes.length||k.log.length));
const freshOnb=s=>({done:hasAnyData(s),step:0,child:'kirill',name:'',age:null,skills:[]});
// Имена детей: введённое при знакомстве или стандартное
function applyNames(){KIDS.forEach(k=>{const n=S.kids[k.id]&&S.kids[k.id].name;k.name=n||KID_DEF[k.id]})}

function onboardView(){
  const O=S.onb,st=O.step,kid=KIDS.find(k=>k.id===O.child);
  const dots=`<div role="img" aria-label="Шаг ${st+1} из 3" style="display:flex;gap:8px;justify-content:center;margin:6px 0 14px">${[0,1,2].map(i=>`<i style="width:${i===st?28:10}px;height:10px;border-radius:5px;background:${i===st?'var(--blue)':'var(--dot-off)'};display:block"></i>`).join('')}</div>`;
  const back=st>0?'<button class="gear" data-act="ob_back" aria-label="Назад">‹</button>':'';
  if(st===0)return`<div class="wl"><img class="wl-bg" src="img/welcome_sky_v43.png" alt="" aria-hidden="true"><main class="wl-col" style="padding-bottom:calc(12px + env(safe-area-inset-bottom))">
    <img class="wl-logo" src="img/yamogu_logo.png" alt="ЯмогУ!"><p class="wl-slogan">Я пробую, я учусь, я могу</p><div class="wl-gap"></div>
    <section class="wl-actions"><p class="wl-benefit">Помогаем ребенку становиться самостоятельнее</p>
    <button class="btn full" data-act="ob_next">Начать</button><button class="wl-parent" data-act="ob_parent">Я родитель</button></section></main></div>`;
  if(st===1){const ages=obAges(O.child);
    return`<main><div class="top">${back}<div class="hello"><b>Давай познакомимся!</b></div></div>${dots}
    <label>Как тебя зовут?</label><input id="ob-name" maxlength="${OB_NAME_MAX}" placeholder="${kid.name}" value="${esc(O.name)}" autocomplete="off">
    <label>Сколько тебе лет?</label><div class="row" style="flex-wrap:nowrap">${ages.map(a=>`<button class="opt ${O.age===a?'on':''}" data-act="ob_age" data-id="${a}" aria-label="${a} лет${O.age===a?', выбрано':''}" style="text-align:center;margin:0">${a}</button>`).join('')}</div>
    <label>Выбери помощника</label><div class="kids">${KIDS.map(k=>`<button class="kid ${O.child===k.id?'on':''}" data-act="ob_child" data-id="${k.id}" aria-label="${k.name}${O.child===k.id?', выбрано':''}"><img src="${k.img}" alt="">${k.name}</button>`).join('')}</div>
    <button class="btn full" data-act="ob_next" style="margin-top:16px">Продолжить</button></main>`}
  const n=O.skills.length;
  return`<main><div class="top">${back}<div class="hello"><b>Выбери первые навыки</b>Ты можешь выбрать ${OB_REQUIRED} навыка</div></div>${dots}
    <div class="grid">${OB_SKILLS.map(s=>`<button class="opt ${O.skills.includes(s[0])?'on':''}" data-act="ob_skill" data-id="${esc(s[0])}" style="display:flex;flex-direction:column;align-items:center;gap:6px;margin:0 0 8px;text-align:center"><img src="img/${s[1]}.png" height="44" alt="">${esc(s[0])}</button>`).join('')}</div>
    <button class="btn full" data-act="ob_next" ${n===OB_REQUIRED?'':'disabled'} style="margin-top:8px">${n===OB_REQUIRED?'Продолжить':`Выбрано ${n} из ${OB_REQUIRED}`}</button></main>`;
}
function onboardAct(act,b){
  const O=S.onb,id=b.dataset.id;
  const nameEl=document.getElementById('ob-name');if(nameEl)O.name=nameEl.value;   // имя вводится без перерисовки, забираем при любом действии
  if(act==='ob_back'){O.step=Math.max(0,O.step-1)}
  else if(act==='ob_parent'){S.cur=O.child;O.done=true;tab='parent';tabChanged=true;parentPage='hub';unlocked=false}   // «Я родитель» → прежний вход в кабинет (PIN)
  else if(act==='ob_age'){O.age=Number(id)}
  else if(act==='ob_child'){O.child=id;if(!obAges(id).includes(O.age))O.age=null}
  else if(act==='ob_skill'){
    if(O.skills.includes(id))O.skills=O.skills.filter(x=>x!==id);
    else if(O.skills.length<OB_REQUIRED)O.skills.push(id);
    else toast('Можно выбрать три навыка. Сними один, чтобы выбрать другой.');
  }
  else if(act==='ob_next'){
    if(O.step<2){O.step++}
    else if(O.skills.length===OB_REQUIRED){   // завершение: выбранный помощник, имя, возраст, интересы
      const k=S.kids[O.child],nm=O.name.trim().slice(0,OB_NAME_MAX);
      S.cur=O.child;if(nm)k.name=nm;if(O.age)k.age=O.age;S.interests=O.skills.slice();O.done=true;tab='home';applyNames();
    }else toast('Выбери три навыка');
  }
  save();
}
