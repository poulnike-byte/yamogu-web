'use strict';
// Украшения карты маршрута (порт CosmeticStore / CosmeticsUi из Android): флаг, дорожка, деревья, рамка помощника.
// Каждое украшение имеет одну редкость (слово + цвет) и один способ получить: бесплатно, за монеты или за достижение. Никакой случайности.
// Монеты за украшения уменьшают тот же свободный баланс, что и «Мои желания» (см. held в app.js). Родитель может выключить покупки
// и отменить покупку в течение суток (монеты вернутся полностью).
// Картинки: img/decor/<id>.png (набор от 28.10.2026, оригиналы — android-prototype/design/map_decor_20261028).
const SLOTS=[['FLAG','Флаг'],['TRAIL','Дорожка'],['TREES','Деревья'],['RING','Рамка помощника']];
const RARITY={COMMON:'Обычная',SPECIAL:'Особая',ELITE:'Элитная',PREMIUM:'Премиум'};
const ACH={FIRST_TASK:'Получи первые монеты за подтверждённое задание',SUMMIT:'Дойди до вершины и собери монеты',COINS_200:'Заработай 200 монет'};
const PRICE={COMMON:100,SPECIAL:250,ELITE:500,PREMIUM:800},REFUND_MS=24*60*60*1000;
// way: 'D' — есть у каждого, число — цена в монетах, строка — ключ достижения
const DECO=[
 {id:'flag_red',t:'Красный флаг',slot:'FLAG',r:'COMMON',way:'D'},
 {id:'flag_blue',t:'Синий флаг',slot:'FLAG',r:'COMMON',way:PRICE.COMMON},
 {id:'flag_star',t:'Жёлтый флаг с цветком',slot:'FLAG',r:'SPECIAL',way:'FIRST_TASK'},
 {id:'flag_flower',t:'Зелёный флаг с цветком',slot:'FLAG',r:'ELITE',way:PRICE.ELITE},
 {id:'trail_sand',t:'Песчаная дорожка',slot:'TRAIL',r:'COMMON',way:'D'},
 {id:'trail_stone',t:'Каменная дорожка',slot:'TRAIL',r:'COMMON',way:PRICE.COMMON},
 {id:'trail_green',t:'Лесная тропа',slot:'TRAIL',r:'SPECIAL',way:'COINS_200'},
 {id:'trail_gold',t:'Золотая дорожка',slot:'TRAIL',r:'ELITE',way:PRICE.ELITE},
 {id:'trees_round',t:'Зелёные деревья',slot:'TREES',r:'COMMON',way:'D'},
 {id:'trees_pine',t:'Ёлки',slot:'TREES',r:'COMMON',way:PRICE.COMMON},
 {id:'trees_cherry',t:'Цветущая вишня',slot:'TREES',r:'SPECIAL',way:PRICE.SPECIAL},
 {id:'trees_autumn',t:'Осенние деревья',slot:'TREES',r:'SPECIAL',way:PRICE.SPECIAL},
 {id:'ring_white',t:'Белая рамка',slot:'RING',r:'COMMON',way:'D'},
 {id:'ring_blue',t:'Синяя рамка',slot:'RING',r:'COMMON',way:PRICE.COMMON},
 {id:'ring_gold',t:'Жёлтая рамка с цветами',slot:'RING',r:'SPECIAL',way:'SUMMIT'},
 {id:'ring_rainbow',t:'Мятная рамка с цветами',slot:'RING',r:'PREMIUM',way:PRICE.PREMIUM}];
const decoById=id=>DECO.find(x=>x.id===id);
const decoDefault=slot=>DECO.find(x=>x.slot===slot&&x.way==='D');
const decoImg=id=>'img/decor/'+id+'.png';
const decoSpent=k=>k.deco.bought.reduce((a,b)=>a+b.price,0);
let wishPage='main';   // main | decor — страница «Желания» ребёнка

// ---- правила ----
const achieved=k=>({FIRST_TASK:k.coins>=1,COINS_200:k.coins>=200,SUMMIT:!!k.summit});
function decoOwns(k,it){
  if(it.way==='D')return true;
  if(typeof it.way==='string')return !!achieved(k)[it.way];
  return k.deco.bought.some(b=>b.id===it.id);
}
function decoWorn(k,slot){const it=decoById(k.deco.worn[slot]);return it&&it.slot===slot&&decoOwns(k,it)?it:decoDefault(slot)}
const decoLook=k=>({flag:decoImg(decoWorn(k,'FLAG').id),trail:decoImg(decoWorn(k,'TRAIL').id),trees:decoImg(decoWorn(k,'TREES').id),ring:decoImg(decoWorn(k,'RING').id)});
function buyDeco(k,id,now=Date.now()){
  const it=decoById(id);if(!it)return'NOT_FOUND';if(typeof it.way!=='number')return'NOT_FOR_SALE';
  if(S.shopOff)return'SHOP_OFF';if(decoOwns(k,it))return'ALREADY_OWNED';if(avail(k)<it.way)return'NOT_ENOUGH';
  k.deco.bought.push({id,price:it.way,at:now});save();return'OK';
}
function equipDeco(k,id){const it=decoById(id);if(!it||!decoOwns(k,it))return false;k.deco.worn[it.slot]=id;save();return true}
// Возврат делает родитель: монеты возвращаются полностью, только в течение суток; надетое снимается
function refundDeco(k,id,now=Date.now()){
  const b=k.deco.bought.find(x=>x.id===id);if(!b||now-b.at>REFUND_MS)return false;
  const it=decoById(id);if(it&&k.deco.worn[it.slot]===id)delete k.deco.worn[it.slot];
  k.deco.bought=k.deco.bought.filter(x=>x.id!==id);save();return true;
}

// ---- ребёнок ----
const wayText=it=>it.way==='D'?'Есть у каждого':typeof it.way==='number'?coinsT(it.way):ACH[it.way];
function decoEntry(k){
  const owned=DECO.filter(x=>decoOwns(k,x)).length;
  return`<div class="task c4" data-act="wp" data-id="decor" role="button" tabindex="0" aria-label="Украшения карты. Собрано ${owned} из ${DECO.length}" style="cursor:pointer;margin-top:14px"><img class="ic" src="${decoImg('flag_star')}" alt=""><div class="tx"><h3>Украшения карты</h3><div class="small">Флаги, дорожки, деревья и рамка помощника. Собрано ${owned} из ${DECO.length}.</div></div><span style="font-weight:800;color:var(--blue)">Открыть ›</span></div>`;
}
function viewDecor(){
  const k=K(),free=avail(k);
  let h=`<button class="btn sm soft" data-act="wp" data-id="main" style="margin-bottom:8px" aria-label="Назад в «Мои желания»">‹ Мои желания</button>
   <div class="sec"><h2>Украшения карты</h2></div><p class="small" style="margin:0 4px 4px">Покупай и надевай. Случайности нет: ты видишь, что получишь.</p>
   <p style="margin:0 4px 8px;font-weight:800">У тебя свободно: ${coinsT(free)}</p>${S.shopOff?'<p class="small" style="margin:0 4px 8px">Родитель пока выключил покупки. Надевать уже полученное можно.</p>':''}`;
  SLOTS.forEach(([slot,title])=>{
    h+=`<div class="sec"><h2 style="font-size:18px">${title}</h2></div>`;
    DECO.filter(x=>x.slot===slot).forEach((it,i)=>{
      const owns=decoOwns(k,it),worn=decoWorn(k,slot).id===it.id,price=typeof it.way==='number'?it.way:0;
      const ctl=worn?'<span style="font-weight:800;color:var(--green-dark)">Надето</span>'
        :owns?`<button class="btn sm" data-act="decoequip" data-id="${it.id}" aria-label="Надеть: ${it.t}">Надеть</button>`
        :price?(free>=price&&!S.shopOff?`<button class="btn sm green" data-act="decobuy" data-id="${it.id}" aria-label="Купить ${it.t} за ${coinsT(price)}">За ${price}</button>`
                 :`<span class="small" style="font-weight:800">${S.shopOff?'Выключено':'Ещё '+(price-free)}</span>`)
        :'<span class="small" style="font-weight:800">Закрыто</span>';
      h+=`<div class="task c${(i+slot.length)%5}" aria-label="${it.t}"><img src="${decoImg(it.id)}" alt="" style="${slot==='TRAIL'?'width:96px;height:auto':'width:60px;height:60px;object-fit:contain'};flex:none"><div class="tx"><h3>${it.t}</h3><div class="small">${RARITY[it.r]} · ${owns&&it.way!=='D'?'у тебя есть':wayText(it)}</div></div>${ctl}</div>`});
  });
  return h;
}
function confirmDeco(id){
  const k=K(),it=decoById(id);if(!it||typeof it.way!=='number')return;
  const m=modal(`<h3>Купить «${it.t}»?</h3><p class="ip">Цена: ${coinsT(it.way)}. После покупки останется ${coinsT(Math.max(0,avail(k)-it.way))}.</p>
    <button class="btn full green" id="dy-ok">Купить</button><button class="btn full soft" id="dy-no" style="margin-top:8px">Не сейчас</button>`);
  m.querySelector('#dy-no').onclick=()=>m.remove();
  m.querySelector('#dy-ok').onclick=()=>{const r=buyDeco(k,id);m.remove();
    toast({OK:'Готово! Украшение уже на карте.',NOT_ENOUGH:'Пока не хватает монет.',SHOP_OFF:'Родитель выключил покупки.'}[r]||'Это украшение сейчас недоступно.');
    if(r==='OK')equipDeco(k,id);render()};   // купленное сразу надевается: ребёнок видит результат
}

// ---- родитель (Настройки) ----
function parentDecoBlock(k){
  let h=`<div class="sec"><h2>Украшения карты</h2></div><p class="small" style="margin:0 4px 8px">Ребёнок покупает их за свободные монеты. Покупку можно отменить в течение суток: монеты вернутся полностью.</p>
   <button class="btn sm ${S.shopOff?'':'soft'}" data-act="shopsw">${S.shopOff?'Покупки выключены — включить':'Покупки включены — выключить'}</button><div style="height:10px"></div>`;
  if(!k.deco.bought.length)return h+'<div class="small" style="margin:0 4px 10px">Покупок пока нет.</div>';
  k.deco.bought.slice().reverse().forEach(b=>{const it=decoById(b.id),can=Date.now()-b.at<=REFUND_MS;
    h+=`<div class="task c1"><img src="${decoImg(b.id)}" alt="" style="${it&&it.slot==='TRAIL'?'width:80px;height:auto':'width:48px;height:48px;object-fit:contain'};flex:none"><div class="tx"><h3>${it?it.t:b.id}</h3><div class="small">${coinsT(b.price)}</div></div>
    ${can?`<button class="btn sm soft" data-act="decorefund" data-id="${b.id}">Отменить и вернуть монеты</button>`:'<span class="small">возврат — только в течение суток</span>'}</div>`});
  return h;
}
