'use strict';
// Отчёт родителя по периодам (порт ProgressUi.parentOverview / ProgressReader.Period из Android).
// Только факты по одному ребёнку: подтверждено, ждёт проверки, возвращено, уровни помощи. Без оценок ребёнка и без сравнения детей между собой.
let reportRange='week';   // 'week' — эта неделя, '4w' — последние 4 недели

function periodData(k,from,to){
  const inR=d=>d&&d>=from&&d<=to,ap=k.log.filter(e=>inR(e.day));
  const help={};ap.forEach(e=>{const h=e.help||'UNKNOWN';help[h]=(help[h]||0)+1});
  const assessed=ap.filter(e=>e.help&&e.help!=='UNKNOWN').length;
  return{approved:ap.length,waiting:k.tasks.filter(t=>t.status==='WAITING_APPROVAL'&&inR(t.sub)).length,returned:(k.rets||[]).filter(e=>inR(e.day)).length,
    help,assessed,withoutHelp:(help.INDEPENDENT||0)+(help.AFTER_REMINDER||0)};
}
// Сравнивает только если в обеих неделях хотя бы три оценённых выполнения; нейтральные формулировки
function compareText(cur,prev){
  if(cur.assessed<3||prev.assessed<3)return'Для сравнения с прошлой неделей пока мало оценённых выполнений.';
  const a=cur.withoutHelp/cur.assessed,b=prev.withoutHelp/prev.assessed;
  return Math.abs(a-b)<.1?'Объём помощи примерно такой же, как на прошлой неделе.'
    :a>b?'Самостоятельных выполнений и выполнений после напоминания стало больше, чем на прошлой неделе.'
    :'Помощи на этой неделе понадобилось больше, чем на прошлой. Это нормально: неделя могла быть непростой.';
}
function reportBlock(k){
  const today=dayStr(),mon=mondayOf(today),four=reportRange==='4w';
  const thisW=periodData(k,mon,addDays(mon,6)),prevW=periodData(k,addDays(mon,-7),addDays(mon,-1));
  const per=four?periodData(k,addDays(today,-27),today):thisW;
  const sent=per.approved+per.waiting+per.returned,pct=sent?Math.round(100*per.approved/sent):0;
  const R=44,C=2*Math.PI*R;
  const ring=`<svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label="${sent?`Подтверждено ${per.approved} из ${sent} отправленных выполнений`:'Отправленных выполнений в этот период нет'}"><circle cx="56" cy="56" r="${R}" fill="none" stroke="${COL.track}" stroke-width="12"/>${sent?`<circle cx="56" cy="56" r="${R}" fill="none" stroke="${COL.teal}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(C*pct/100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 56 56)"/>`:''}<text x="56" y="58" text-anchor="middle" font-size="22" font-weight="800" fill="${COL.ink}">${sent?pct+'%':'—'}</text><text x="56" y="76" text-anchor="middle" font-size="9" fill="${COL.muted}">подтверждено</text></svg>`;
  const vals=four?[3,2,1,0].map(w=>{const to=addDays(today,-7*w);return periodData(k,addDays(to,-6),to).approved}):DAYN.map((_,i)=>periodData(k,addDays(mon,i),addDays(mon,i)).approved);
  const labs=four?['−3 нед','−2 нед','−1 нед','Эта']:DAYN,hi=four?3:(new Date().getDay()+6)%7,mx=Math.max(4,...vals);
  const bars=`<div role="img" aria-label="${four?'По неделям':'По дням'}: ${vals.map((v,i)=>labs[i]+' '+v).join(', ')}" style="display:flex;gap:4px;margin-top:10px">${vals.map((v,i)=>`<div style="flex:1;text-align:center"><div style="height:70px;display:flex;align-items:flex-end;justify-content:center"><div style="width:26px;height:${8+Math.round(62*v/mx)}px;border-radius:9px;background:${v?'linear-gradient(0deg,var(--teal),var(--blue-chart))':'var(--track)'};${i===hi?'outline:2px solid var(--blue)':''}"></div></div><div class="small" style="font-size:11px;margin-top:4px">${labs[i]}</div></div>`).join('')}</div>`;
  const kpi=(n,c)=>`<div style="flex:1;text-align:center;background:var(--kpi);border-radius:14px;padding:10px 4px"><div style="font-size:24px;font-weight:800;color:var(--ink)">${n}</div><div class="small" style="font-size:12px">${c}</div></div>`;
  const total=Object.values(per.help).reduce((a,b)=>a+b,0);
  const helpBar=total?`<div role="img" aria-label="Уровни помощи: ${HELP.concat([['UNKNOWN','Не оценено']]).filter(x=>per.help[x[0]]).map(x=>x[1]+' '+per.help[x[0]]).join(', ')}" style="display:flex;height:14px;border-radius:8px;overflow:hidden;background:var(--track-help);margin-top:6px">${HELP.concat([['UNKNOWN','','var(--help-unknown)']]).filter(x=>per.help[x[0]]).map(x=>`<i style="flex:${per.help[x[0]]};background:${x[2]}"></i>`).join('')}</div>
    <div class="small" style="margin-top:6px">${HELP.concat([['UNKNOWN','Не оценено']]).filter(x=>per.help[x[0]]).map(x=>`<span style="margin-right:10px"><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${HELP_COLOR(x[0])};margin-right:4px"></i>${x[1]==='С небольшой помощью'?'С подсказкой':x[1]==='Вместе со взрослым'?'Вместе':x[1]}: ${per.help[x[0]]}</span>`).join('')}</div>`:'';
  return`<div class="sec"><h2>Отчёт</h2></div><div class="row" style="margin-bottom:10px"><button class="btn sm ${four?'soft':''}" data-act="range" data-id="week">Эта неделя</button><button class="btn sm ${four?'':'soft'}" data-act="range" data-id="4w">4 недели</button></div>
  <div class="card"><div style="display:flex;align-items:center;gap:16px">${ring}<div><div style="font-size:36px;font-weight:800;color:var(--ink);line-height:1">${per.approved}</div><div class="small">${plural(per.approved,'подтверждённое выполнение','подтверждённых выполнения','подтверждённых выполнений')}</div><div class="small" style="margin-top:4px">${four?`Из ${sent} отправленных`:`На прошлой неделе: ${prevW.approved}`}</div></div></div>${bars}
   <div style="display:flex;gap:8px;margin-top:12px">${kpi(per.approved,'подтверждено')}${kpi(per.waiting,'ждёт проверки')}${kpi(per.returned,'возвращено на доработку')}</div>
   ${per.approved?`<div style="margin-top:12px;font-weight:800">Уровень помощи при подтверждённых выполнениях</div>${helpBar}${four?'':`<div class="small" style="margin-top:8px">${compareText(thisW,prevW)}</div>`}${per.assessed<per.approved?'<div class="small" style="margin-top:6px">«Не оценено» значит, что уровень помощи не был выбран: такие записи не считаются ни хорошими, ни плохими.</div>':''}`:'<div class="small" style="margin-top:10px">В этот период подтверждённых выполнений нет.</div>'}</div>`;
}
