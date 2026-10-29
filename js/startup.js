'use strict';
// Готовность первого экрана: пока приветственный фон и логотип не декодированы, поверх приложения остаётся
// лёгкий экран загрузки (#boot из index.html). Задержек «для красоты» нет; при ошибке/таймауте экран всё равно открывается.
const Startup=(()=>{
  const WAIT_MS=4000,HARD_MS=8000;   // WAIT_MS — ожидание картинок приветствия, HARD_MS — страховка: экран загрузки не может остаться навсегда
  let done=false;
  const boot=()=>document.getElementById('boot');
  function hide(){
    if(done)return;done=true;
    const b=boot();if(!b)return;
    b.classList.add('boot-out');
    setTimeout(()=>b.remove(),200);
  }
  // Одна картинка: загружена и декодирована; при ошибке — одна повторная попытка с новым адресом; false, если не вышло
  function ready(img){
    const ok=()=>img.complete&&img.naturalWidth>0?(img.decode?img.decode().then(()=>true,()=>true):true):false;
    return new Promise(res=>{
      let retried=false;
      const check=()=>{const r=ok();if(r===false)return;res(r)};
      const fail=()=>{
        if(retried)return res(false);
        retried=true;const u=img.getAttribute('src').split('?')[0];img.src=u+'?retry='+Date.now();
      };
      if(img.complete&&img.naturalWidth>0)return check();
      if(img.complete&&img.naturalWidth===0&&img.src)fail();
      img.addEventListener('load',check);img.addEventListener('error',fail);
    });
  }
  // Вызывается после каждого первого render(): на приветствии ждём картинки, на остальных экранах открываем сразу
  function reveal(){
    if(done)return Promise.resolve();
    const imgs=[...document.querySelectorAll('.wl-bg,.wl-logo')];
    if(!imgs.length){hide();return Promise.resolve()}
    const timeout=new Promise(res=>setTimeout(()=>res(false),WAIT_MS));
    return Promise.race([Promise.all(imgs.map(ready)),timeout]).then(r=>{
      document.documentElement.dataset.welcomeImages=(Array.isArray(r)&&r.every(Boolean))?'ok':'fallback';   // 'fallback' → CSS показывает нейтральное небо вместо фона
      hide();
    });
  }
  setTimeout(hide,HARD_MS);
  return{reveal,hide};
})();
