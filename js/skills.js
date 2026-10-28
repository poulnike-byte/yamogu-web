'use strict';
// Навыки, ступени и уровни помощи (порт SkillDomainPolicies / ProgressReader / ParentApprovalActivity из Android).
// Ступень навыка — состояние навыка, а не оценка ребёнка. Переход решает родитель; возврат не отнимает XP.
const STAGES=['LEARNING','PRACTICING','INDEPENDENT','HABIT'];
const STAGE_T={LEARNING:'Учусь',PRACTICING:'Пробую',INDEPENDENT:'Могу сам',HABIT:'Моя привычка'};
const STAGE_CHILD={LEARNING:'Делаем вместе, шаг за шагом',PRACTICING:'Делаю сам, иногда нужно напоминание',INDEPENDENT:'Делаю без подсказок',HABIT:'Это уже моя привычка!'};
const HELP=[['INDEPENDENT','Самостоятельно','#22C274'],['AFTER_REMINDER','После напоминания','#6AA6E8'],['SMALL_HELP','С небольшой помощью','#F0B44C'],['TOGETHER','Вместе со взрослым','#B38BE0']];
const HELP_COLOR=h=>(HELP.find(x=>x[0]===h)||[0,0,'#C9CED9'])[2], HELP_NAME=h=>(HELP.find(x=>x[0]===h)||[0,'Не оценено'])[1];
const SKILL_PRESETS=['Самоорганизация','Порядок','Учёба','Забота о себе','Чтение','Здоровье'];
const HABIT_DAYS=14,HABIT_ATTEMPTS=5;   // как HabitSuggestionConfig

const skillById=(k,id)=>k.skills.find(s=>s.id===id);
const activeSkills=k=>k.skills.filter(s=>s.status==='ACTIVE');
const daysBetween=(a,b)=>Math.round((Date.UTC(...b.split('-').map((x,i)=>i===1?x-1:+x))-Date.UTC(...a.split('-').map((x,i)=>i===1?x-1:+x)))/864e5);
// Создаёт навык ребёнку (название 3–60, без повторов); возвращает навык или текст ошибки
function addSkill(k,title){
  title=(title||'').trim();
  if(title.length<3||title.length>60)return'Название навыка: от 3 до 60 символов';
  if(k.skills.some(s=>s.status==='ACTIVE'&&s.title.toLowerCase()===title.toLowerCase()))return'Такой навык уже есть';
  const s={id:uid(),title,stage:'LEARNING',since:dayStr(),status:'ACTIVE'};k.skills.push(s);return s;
}
// Ступень строго по порядку: вперёд на 1 или назад на 1
function moveStage(k,id,dir){
  const s=skillById(k,id);if(!s)return;const i=STAGES.indexOf(s.stage)+dir;
  if(i<0||i>=STAGES.length)return;s.stage=STAGES[i];s.since=dayStr();save();
}
function skillStats(k,s){
  const own=k.log.filter(e=>e.skill===s.id),assessed=own.filter(e=>e.help&&e.help!=='UNKNOWN').length;
  const days=s.since?Math.max(0,daysBetween(s.since,dayStr())):0;
  return{recent:own.slice(-8).map(e=>e.help||'UNKNOWN'),assessed,days,
    eligible:s.stage==='INDEPENDENT'&&days>=HABIT_DAYS&&assessed>=HABIT_ATTEMPTS,
    moreDays:Math.max(0,HABIT_DAYS-days),moreAttempts:Math.max(0,HABIT_ATTEMPTS-assessed)};
}
const ladder=stage=>{const cur=STAGES.indexOf(stage);
  return`<div role="img" aria-label="Ступень навыка: ${STAGE_T[stage]}" style="display:flex;gap:4px;margin-top:8px">${STAGES.map((s,i)=>`<div style="flex:1;text-align:center;font-size:12px;font-weight:800;padding:9px 2px;border-radius:12px;${i===cur?'background:#1F6BFF;color:#fff':i<cur?'background:#D8F2E6;color:#0F8F53':'background:#EEF2F8;color:#6A7488'}">${STAGE_T[s]}</div>`).join('')}</div>`};
const helpDots=list=>list.length?`<div role="img" aria-label="Последние выполнения: ${list.map(HELP_NAME).join(', ')}" style="display:flex;gap:5px;margin-top:8px">${list.map(h=>`<i style="width:14px;height:14px;border-radius:50%;background:${HELP_COLOR(h)};display:block"></i>`).join('')}</div>`:'';

// Карточка навыка для ребёнка («Прогресс»)
function childSkillCard(k,s){
  return`<div class="card"><div class="row" style="align-items:center;flex-wrap:nowrap"><img src="${iconFor(s.title)}" height="44" alt="" style="margin-right:10px"><div><b>${esc(s.title)}</b><div class="small">${STAGE_T[s.stage]}: ${STAGE_CHILD[s.stage]}</div></div></div>${ladder(s.stage)}</div>`;
}
// Блок навыков в кабинете родителя: ступень, последние выполнения, подсказка про «Мою привычку», кнопки перехода
function parentSkillsBlock(k){
  const list=activeSkills(k);
  let h='<div class="sec"><h2>Навыки</h2></div>';
  if(!list.length)return h+'<div class="empty">Навыков пока нет.<br>Они появятся, когда вы привяжете к заданию навык.</div>';
  list.forEach(s=>{const st=skillStats(k,s),i=STAGES.indexOf(s.stage);
    h+=`<div class="card"><b>${esc(s.title)}</b><div class="small">${STAGE_T[s.stage]} · на ступени ${st.days} ${plural(st.days,'день','дня','дней')}</div>${ladder(s.stage)}${helpDots(st.recent)}`;
    if(!st.recent.length)h+='<div class="small" style="margin-top:6px">Подтверждённых выполнений с этим навыком пока нет.</div>';
    if(s.stage==='INDEPENDENT')h+=st.eligible?'<div class="card c2 small" style="margin:10px 0 0"><b>Можно обсудить переход в «Моя привычка»</b><br>Прошло '+st.days+' '+plural(st.days,'день','дня','дней')+' на ступени и оценено '+st.assessed+' выполнений.</div>'
      :`<div class="small" style="margin-top:8px">Пока рано предлагать «Моя привычка»: нужно ещё ${[st.moreDays?st.moreDays+' '+plural(st.moreDays,'день','дня','дней'):'',st.moreAttempts?st.moreAttempts+' '+plural(st.moreAttempts,'оценённое выполнение','оценённых выполнения','оценённых выполнений'):''].filter(Boolean).join(' и ')}. Решение всё равно принимаете вы.</div>`;
    h+='<div class="row" style="margin-top:10px">'+(i<STAGES.length-1?`<button class="btn sm ${s.stage==='INDEPENDENT'&&st.eligible?'':'soft'}" data-act="stage" data-dir="1" data-id="${s.id}">Перейти на «${STAGE_T[STAGES[i+1]]}»</button>`:'')+(i>0?`<button class="btn sm soft" data-act="stage" data-dir="-1" data-id="${s.id}">Вернуться на «${STAGE_T[STAGES[i-1]]}»</button>`:'')+'</div>';
    h+='<div class="small" style="margin-top:8px">Ступень — состояние навыка, а не оценка ребёнка. Возврат не отнимает XP.</div></div>'});
  return h;
}
// «Как ребёнок справился?» — обязательный выбор перед подтверждением; награду платит approve() ровно один раз
function reviewDialog(id){
  const k=K(),t=k.tasks.find(x=>x.id===id&&x.status==='WAITING_APPROVAL');if(!t)return;
  const sk=skillById(k,t.skill);let help=null;
  const m=modal(`<h3>Проверка задания</h3><div style="font-weight:800;margin-bottom:4px">${esc(t.title)}</div>${sk?`<div class="small">Навык: ${esc(sk.title)}</div>`:''}
    <div class="meta row" style="margin:8px 0">${rew(t)}</div><p class="ip"><b>Как ребёнок справился? Выберите один вариант.</b></p>
    ${HELP.map(x=>`<button class="opt" data-help="${x[0]}">${x[1]}</button>`).join('')}
    <button class="btn full green" id="rv-ok" disabled style="margin-top:8px">Подтвердить</button>
    <button class="btn full soft" id="rv-back" style="margin-top:8px">Вернуть</button><button class="btn full soft" id="rv-no" style="margin-top:8px">Закрыть</button>`);
  m.addEventListener('click',ev=>{const b=ev.target.closest('[data-help]');if(!b)return;help=b.dataset.help;
    m.querySelectorAll('[data-help]').forEach(x=>x.classList.toggle('on',x===b));m.querySelector('#rv-ok').disabled=false});
  m.querySelector('#rv-ok').onclick=()=>{if(!help)return;approve(id,help);m.remove();toast('Награда выдана ⭐');render()};
  m.querySelector('#rv-back').onclick=()=>{reject(id);m.remove();render()};
  m.querySelector('#rv-no').onclick=()=>m.remove();
}
// Выбор навыка в формах: «Без навыка», навыки ребёнка, готовые «+ …», «+ Новый навык…» (создаётся при сохранении)
function skillSelect(k,idAttr,withNone=true,noneLabel='Без навыка'){
  const have=new Set(activeSkills(k).map(s=>s.title.toLowerCase()));
  return`<select id="${idAttr}">${withNone?`<option value="">${noneLabel}</option>`:''}${activeSkills(k).map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join('')}${SKILL_PRESETS.filter(p=>!have.has(p.toLowerCase())).map(p=>`<option value="+${esc(p)}">+ ${esc(p)}</option>`).join('')}<option value="+new">+ Новый навык…</option></select>
   <input id="${idAttr}-new" placeholder="Название нового навыка" maxlength="60" style="display:none;margin-top:6px">`;
}
function bindSkillSelect(m,idAttr){const sel=m.querySelector('#'+idAttr),inp=m.querySelector('#'+idAttr+'-new');sel.onchange=()=>{inp.style.display=sel.value==='+new'?'block':'none'}}
// Значение выбора → id навыка (создавая новый при необходимости). Возвращает {id} или {err}
function resolveSkill(m,k,idAttr){
  const v=m.querySelector('#'+idAttr).value;if(!v)return{id:null};
  if(v[0]!=='+')return{id:v};
  const r=addSkill(k,v==='+new'?m.querySelector('#'+idAttr+'-new').value:v.slice(1));
  return typeof r==='string'?{err:r}:{id:r.id};
}
