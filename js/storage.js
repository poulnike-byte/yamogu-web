'use strict';
// Слой хранилища. Все данные приложения — один объект состояния.
// Пишем в два места: localStorage (мгновенно) и IndexedDB (надёжнее: iOS реже его стирает).
// При запуске берём более свежую копию (по метке _t), поэтому если Safari очистил
// одно хранилище, данные восстанавливаются из другого.
// Позже этот слой можно подменить на родное хранилище (Capacitor/Keychain), не меняя экраны.
const Store=(()=>{
  const KEY='yamogu_v2', DB='yamogu', OS='kv', IDB_KEY='state';
  let idbState=null, db=null, timer=null, lastJson='';

  const openDb=()=>new Promise(res=>{
    if(!window.indexedDB) return res(null);
    try{
      const r=indexedDB.open(DB,1);
      r.onupgradeneeded=()=>r.result.createObjectStore(OS);
      r.onsuccess=()=>res(r.result);
      r.onerror=r.onblocked=()=>res(null);
    }catch(e){ res(null); }
  });
  const idbGet=()=>new Promise(res=>{
    if(!db) return res(null);
    try{ const q=db.transaction(OS,'readonly').objectStore(OS).get(IDB_KEY); q.onsuccess=()=>res(q.result||null); q.onerror=()=>res(null); }catch(e){ res(null); }
  });
  const idbPut=json=>{
    if(!db) return;
    try{ db.transaction(OS,'readwrite').objectStore(OS).put(json,IDB_KEY); }catch(e){}
  };
  // Любое обращение к IndexedDB ограничено по времени: если оно зависло, приложение всё равно запускается (на localStorage).
  const within=(p,ms)=>Promise.race([p,new Promise(res=>setTimeout(()=>res(null),ms))]);
  const parse=j=>{ try{ const s=JSON.parse(j); return s&&s.kids?s:null; }catch(e){ return null; } };

  return {
    // Вызвать один раз до первого чтения. Не бросает ошибок.
    async init(){
      db=await within(openDb(),1500);
      const j=await within(idbGet(),1500); idbState=j?parse(j):null;
      try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist(); }catch(e){}
    },
    // Возвращает более свежий из двух сохранённых объектов или null (первый запуск).
    read(){
      let ls=null; try{ ls=parse(localStorage.getItem(KEY)); }catch(e){}
      const a=ls, b=idbState;
      if(a&&b) return (b._t||0)>(a._t||0)?b:a;
      return a||b||null;
    },
    write(state){
      const json=JSON.stringify(state);
      if(json===lastJson) return; lastJson=json;
      try{ localStorage.setItem(KEY,json); }catch(e){}
      clearTimeout(timer); timer=setTimeout(()=>idbPut(json),150);   // не чаще раза в 150 мс
    },
    // Сохранить немедленно (при сворачивании приложения).
    flush(){ if(lastJson){ clearTimeout(timer); idbPut(lastJson); } }
  };
})();
addEventListener('pagehide',()=>Store.flush());
document.addEventListener('visibilitychange',()=>{ if(document.hidden) Store.flush(); });
