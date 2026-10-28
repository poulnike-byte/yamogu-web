'use strict';
// «Мои желания» (порт WishStore / WishesUi из Android): настоящие награды, которые предлагает родитель и на которые ребёнок копит монеты.
// Монеты тут не списываются: свободно = заработано − цена каждой не отменённой покупки. Открытая покупка по желанию только одна.
// Выдаёт награду, откладывает и отменяет родитель; за пропущенное ничего не отнимается.
const WISH_MIN=10,WISH_MAX=100000,OVERDUE_DAYS=7;
const WISH_TEMPLATES=[
 ['Выбрать мультфильм на вечер',150],['Пирожное или мороженое',300],['На 30 минут позже лечь спать (в выходной)',400],
 ['Прогулка в парк или на площадку по выбору',600],['Поход в кино',1500],['Новая игрушка или книга',2500],
 ['+15 минут телефона',100],['Выбрать, как провести выходные',600],['Карманные деньги: родитель выдаёт 500 ₽',800]];
const WISH_STATUS={BOUGHT:'куплено, ждёт выдачи',POSTPONED:'отложено',DELIVERED:'выдано',CANCELLED:'отменено, монеты возвращены'};
const coinsT=n=>n+' '+plural(n,'монета','монеты','монет');
const isOpenP=p=>p.status==='BOUGHT'||p.status==='POSTPONED';
const frozen=k=>k.purchases.filter(isOpenP).reduce((a,p)=>a+p.price,0);
const goalWish=k=>k.wishes.find(w=>w.id===k.goal&&!w.hidden);
const waitDays=p=>Math.max(0,daysBetween(p.at||dayStr(),dayStr()));

// ---- правила ----
function buyWish(k,id){
  const w=k.wishes.find(x=>x.id===id);if(!w)return'NOT_FOUND';if(w.hidden)return'HIDDEN';
  if(openPurchase(k,id))return'ALREADY_OPEN';if(avail(k)<w.price)return'NOT_ENOUGH';
  k.purchases.push({id:uid(),wishId:w.id,title:w.title,price:w.price,status:'BOUGHT',note:'',at:dayStr()});save();return'OK';
}
function setPurchase(k,id,to,note){const p=k.purchases.find(x=>x.id===id);if(!p||!isOpenP(p))return false;p.status=to;if(note!==undefined)p.note=note;save();return true}
function validWish(title,price){title=(title||'').trim();
  if(title.length<2||title.length>60)return'Название от 2 до 60 символов';
  if(!(price>=WISH_MIN&&price<=WISH_MAX))return`Цена от ${WISH_MIN} до ${WISH_MAX}`;return''}
function addWish(k,title,price){const e=validWish(title,price);if(e)return e;k.wishes.push({id:uid(),title:title.trim(),price:Math.round(price),hidden:false});save();return''}
function updateWish(k,id,title,price){const w=k.wishes.find(x=>x.id===id);if(!w)return'Желание не найдено';const e=validWish(title,price);if(e)return e;w.title=title.trim();w.price=Math.round(price);save();return''}
function setWishHidden(k,id,hidden){const w=k.wishes.find(x=>x.id===id);if(!w)return;w.hidden=hidden;if(hidden&&k.goal===id)k.goal=null;save()}
function setGoal(k,id){const w=k.wishes.find(x=>x.id===id&&!x.hidden);if(!w)return;k.goal=k.goal===id?null:id;save()}   // нажать ещё раз — убрать цель

// ---- ребёнок ----
function viewRewards(){
  const k=K(),av=avail(k),fz=frozen(k),shown=k.wishes.filter(w=>!w.hidden);
  let h=topbar('Мои награды,')+`<div class="hero" style="min-height:0"><div class="big">${I.coin} ${av}</div><div class="small" style="text-align:center">мой баланс · ${I.star} ${k.xp} XP</div></div>
   <p class="small" style="margin:10px 4px 0">Копи монеты на то, что хочешь. Награду выдаёт родитель.</p>${fz?`<p class="small" style="margin:4px 4px 0">Ещё ${coinsT(fz)} ждут, пока родитель выдаст награду.</p>`:''}<div class="sec"><h2>Мои желания</h2></div>`;
  if(!shown.length)h+='<div class="empty"><b>Пока желаний нет</b><br>Попроси родителя добавить первое: например, поход в кино.</div>';
  shown.forEach((w,i)=>{const op=openPurchase(k,w.id),can=!op&&av>=w.price,isGoal=k.goal===w.id;
    h+=`<div class="task c${(i+3)%5}" style="flex-wrap:wrap"><div class="tx" style="min-width:60%"><h3>${esc(w.title)}</h3><div class="meta"><span>${I.coin} ${w.price}</span><span>~${days(w.price)} дн.</span></div>
    <div class="bar"><i style="width:${Math.min(100,100*av/w.price)}%"></i></div></div>
    ${op?`<div class="small" style="font-weight:800;color:var(--green-dark);flex-basis:100%">${op.status==='POSTPONED'&&op.note?'Куплено. Родитель отложил: '+esc(op.note):'Куплено. Ждём, когда родитель выдаст награду.'}</div>`
      :can?`<button class="btn sm green" data-act="wishbuy" data-id="${w.id}">Хочу! За ${w.price}</button>`:`<div class="small" style="font-weight:800" aria-label="До «${esc(w.title)}» ещё ${coinsT(w.price-av)}">Ещё ${coinsT(w.price-av)}</div>`}
    <button class="btn sm ${isGoal?'':'soft'}" data-act="wishgoal" data-id="${w.id}" aria-label="${isGoal?'Это моя цель. Нажми, чтобы убрать':'Сделать «'+esc(w.title)+'» моей целью'}" style="flex-basis:100%">${isGoal?'★ Это моя цель':'Сделать целью'}</button></div>`});
  const dl=k.purchases.filter(p=>p.status==='DELIVERED');
  if(dl.length){h+=`<div class="sec"><h2>Уже получено</h2><span class="cnt">${dl.length}</span></div>`;dl.slice(-8).reverse().forEach(p=>h+=`<div class="task c0"><div class="tx"><h3>${ico('gift-outline')} ${esc(p.title)}</h3><div class="meta"><span>${I.coin} ${p.price}</span></div></div></div>`)}
  return h;
}
// Подтверждение покупки: ребёнок видит цену и сколько останется
function confirmBuy(id){
  const k=K(),w=k.wishes.find(x=>x.id===id);if(!w)return;
  const m=modal(`<h3>Купить «${esc(w.title)}»?</h3><p class="ip">Цена: ${coinsT(w.price)}. После покупки останется ${coinsT(Math.max(0,avail(k)-w.price))}.</p><p class="ip muted">Родитель увидит твою покупку и выдаст награду.</p>
    <button class="btn full green" id="by-ok">Купить</button><button class="btn full soft" id="by-no" style="margin-top:8px">Не сейчас</button>`);
  m.querySelector('#by-no').onclick=()=>m.remove();
  m.querySelector('#by-ok').onclick=()=>{const r=buyWish(k,id);m.remove();
    toast({OK:'Готово! Родитель увидит твою покупку.',NOT_ENOUGH:'Пока не хватает монет.',ALREADY_OPEN:'Это желание уже куплено.'}[r]||'Это желание сейчас недоступно.');render()};
}
// Карточка «Моя цель» на главной
function goalCardHome(k){
  const w=goalWish(k);if(!w)return'';const op=openPurchase(k,w.id),free=avail(k);
  const t=op?'Куплено! Ждём, когда родитель выдаст награду.':free>=w.price?'Монет хватает! Загляни в «Мои желания».':'Ещё '+coinsT(w.price-free);
  return`<div class="card c3" data-tab="wishes" role="button" tabindex="0" aria-label="Моя цель: ${esc(w.title)}" style="margin-top:12px"><b>Моя цель: ${esc(w.title)}</b><div class="bar"><i style="width:${Math.min(100,100*free/w.price)}%"></i></div><div class="small">${t}</div></div>`;
}

// ---- родитель ----
function parentPendingBlock(k){
  const pd=k.purchases.filter(isOpenP).sort((a,b)=>(a.at||'')<(b.at||'')?-1:1);
  if(!pd.length)return'';
  let h=`<div class="sec"><h2>Ждёт меня</h2><span class="cnt">${pd.length}</span></div><p class="small" style="margin:0 4px 8px">Монеты за подарки списываются только после вашей выдачи или отмены.</p>`;
  pd.forEach(p=>{const d=waitDays(p);
    h+=`<div class="task c4"><div class="tx"><h3>${ico('gift-outline')} ${esc(p.title)}</h3><div class="meta"><span>${I.coin} ${p.price}</span>${p.status==='POSTPONED'?'<span>отложено'+(p.note?': '+esc(p.note):'')+'</span>':''}</div>
    <div class="small" style="font-weight:800;${d>=OVERDUE_DAYS?'color:var(--amber-text)':''}">Ждёт выдачи уже ${d} ${plural(d,'день','дня','дней')}</div>
    <div class="row" style="margin-top:8px"><button class="btn sm green" data-act="deliver" data-id="${p.id}">Выдано</button><button class="btn sm soft" data-act="postpone" data-id="${p.id}">Отложить с причиной</button><button class="btn sm red" data-act="cancelp" data-id="${p.id}">Отменить и вернуть монеты</button></div></div></div>`});
  return h;
}
function parentWishesBlock(k){
  let h=`<div class="sec"><h2>Желания ребёнка</h2></div><p class="small" style="margin:0 4px 8px">Свободно ${coinsT(avail(k))}, заморожено ${coinsT(frozen(k))}.</p><button class="btn sm soft" data-act="addwish">+ Желание</button><div style="height:10px"></div>`;
  if(!k.wishes.length)h+='<div class="empty">Пока нет ни одного желания. Добавьте из шаблонов или своё.</div>';
  k.wishes.forEach(w=>h+=`<div class="task c4" style="${w.hidden?'opacity:.6':''}"><div class="tx"><h3>${esc(w.title)}</h3><div class="meta"><span>Цена: ${coinsT(w.price)}</span>${w.hidden?'<span>скрыто от ребёнка</span>':''}</div>
    <div class="row" style="margin-top:8px"><button class="btn sm soft" data-act="editwish" data-id="${w.id}">Изменить</button><button class="btn sm soft" data-act="hidewish" data-id="${w.id}">${w.hidden?'Показать':'Скрыть'}</button><button class="go" data-act="delwish" data-id="${w.id}" aria-label="Удалить желание">${ico('trash-outline')}</button></div></div></div>`);
  const hist=k.purchases.filter(p=>!isOpenP(p)).slice(-10).reverse();
  if(hist.length)h+=`<div class="sec"><h2>История</h2></div>`+hist.map(p=>`<div class="small" style="margin:0 4px 6px">${esc(p.title)} · ${WISH_STATUS[p.status]}</div>`).join('');
  return h;
}
function wishForm(w,pre){
  const m=modal(`<h3>${w?'Изменить желание':'Новое желание'}</h3><label>Название</label><input id="w-t" maxlength="60" value="${esc(w?w.title:pre?pre[0]:'')}"><label>Цена в монетах (${WISH_MIN}–${WISH_MAX})</label><input id="w-p" type="number" inputmode="numeric" value="${w?w.price:pre?pre[1]:''}"><button class="btn full" id="w-ok">Сохранить</button>`);
  m.querySelector('#w-ok').onclick=()=>{const t=m.querySelector('#w-t').value,p=parseInt(m.querySelector('#w-p').value)||0,e=w?updateWish(K(),w.id,t,p):addWish(K(),t,p);if(e)return toast(e);m.remove();render()};
}
function wishPicker(){
  const m=modal('<h3>Новое желание</h3>'+WISH_TEMPLATES.map((t,i)=>`<div class="task c${i%5}"><div class="tx"><h3>${esc(t[0])}</h3><div class="meta"><span>${I.coin} ${t[1]}</span></div></div><button class="go" data-pick="${i}" aria-label="Выбрать">+</button></div>`).join('')+'<button class="btn full soft" data-pick="own" style="margin-top:8px">Своё желание…</button>');
  m.addEventListener('click',ev=>{const b=ev.target.closest('[data-pick]');if(!b)return;m.remove();wishForm(null,b.dataset.pick==='own'?null:WISH_TEMPLATES[+b.dataset.pick])});
}
function postponeForm(id){
  const m=modal('<h3>Отложить выдачу</h3><label>Причина, например: пойдём в субботу</label><input id="pp-n" maxlength="80"><button class="btn full" id="pp-ok">Отложить</button>');
  m.querySelector('#pp-ok').onclick=()=>{setPurchase(K(),id,'POSTPONED',m.querySelector('#pp-n').value.trim().slice(0,80));m.remove();toast('Отложено');render()};
}
function cancelForm(id){
  const p=K().purchases.find(x=>x.id===id);if(!p)return;
  const m=modal(`<h3>Отменить покупку?</h3><p class="ip">«${esc(p.title)}»: ${coinsT(p.price)} вернутся ребёнку в полном объёме.</p><button class="btn full red" id="cp-ok">Отменить покупку</button><button class="btn full soft" id="cp-no" style="margin-top:8px">Не отменять</button>`);
  m.querySelector('#cp-no').onclick=()=>m.remove();
  m.querySelector('#cp-ok').onclick=()=>{setPurchase(K(),id,'CANCELLED');m.remove();toast('Монеты возвращены');render()};
}
