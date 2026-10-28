'use strict';
// Резервная копия данных. Данные веб-версии лежат только в браузере телефона: очистка Safari или новый телефон = потеря,
// поэтому родитель может сохранить копию в файл (через «Поделиться»: Файлы, почта, мессенджер) и восстановить её.
// Файл — JSON {app,format,exported,data}. PIN в копию НЕ входит: короткий PIN по файлу легко подобрать; при восстановлении
// остаётся PIN этого устройства (если его нет — родитель задаёт новый).
const BACKUP_FORMAT=1,BACKUP_MAX=5*1024*1024,BACKUP_NAG_DAYS=14;

function buildBackup(){
  const d=JSON.parse(JSON.stringify(S));delete d.pin;delete d._t;
  return JSON.stringify({app:'yamogu-web',format:BACKUP_FORMAT,exported:new Date().toISOString(),data:d},null,1);
}
// Проверка файла; возвращает {data,exported} или {err:'понятный текст'}
function parseBackup(text){
  if(typeof text!=='string'||text.length>BACKUP_MAX)return{err:'Файл слишком большой или повреждён'};
  let o;try{o=JSON.parse(text)}catch(e){return{err:'Это не файл копии ЯмогУ!'}}
  if(!o||o.app!=='yamogu-web'||!o.data||typeof o.data!=='object')return{err:'Это не файл копии ЯмогУ!'};
  if(o.format>BACKUP_FORMAT)return{err:'Копия сделана более новой версией приложения. Обновите приложение.'};
  const d=o.data;
  if(!d.kids||!['kirill','vika'].every(id=>d.kids[id]&&Array.isArray(d.kids[id].tasks)))return{err:'В файле нет данных детей'};
  return{data:d,exported:o.exported};
}
function restoreBackup(d){
  const keepPin=S.pin;
  S=normalize(d);S.pin=keepPin||null;S.lastBackup=dayStr();
  if(S.cur&&!S.kids[S.cur])S.cur=null;
  introOpen=false;parentPage='hub';wishPage='main';
  save();Store.flush();applyNames();
}
function markBackup(){S.lastBackup=dayStr();save()}
async function exportBackup(){
  const text=buildBackup(),name='yamogu-backup-'+dayStr()+'.json',file=new File([text],name,{type:'application/json'});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:'Копия данных ЯмогУ!'});markBackup();render();return}}
  catch(e){if(e&&e.name==='AbortError')return}   // закрыл окно «Поделиться» — копия не сделана
  const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);markBackup();toast('Копия сохранена в файл');render();
}
const daysSinceBackup=()=>S.lastBackup?Math.max(0,daysBetween(S.lastBackup,dayStr())):null;
const hasWork=()=>Object.values(S.kids).some(k=>k.log.length||k.coins||k.tasks.length||k.wishes.length);

// ---- интерфейс (Настройки родителя) ----
function backupBlock(){
  const d=daysSinceBackup();
  return`<div class="sec"><h2>Резервная копия</h2></div><p class="small" style="margin:0 4px 8px">Данные хранятся только на этом телефоне. Сохраните копию в файл (например, в «Файлы» или на почту): если телефон потеряется или браузер очистят, данные можно будет вернуть. PIN в копию не входит.</p>
   <p class="small" style="margin:0 4px 8px;font-weight:800">${S.lastBackup?'Последняя копия: '+S.lastBackup.split('-').reverse().join('.')+(d?` (${d} ${plural(d,'день','дня','дней')} назад)`:' (сегодня)'):'Копия ещё не делалась'}</p>
   <div class="row" style="margin-bottom:12px"><button class="btn sm" data-act="backup">Сохранить копию</button><button class="btn sm soft" data-act="restore">Восстановить из файла</button></div>
   <input type="file" id="bk-file" accept=".json,application/json" hidden>`;
}
// Мягкое напоминание на главной странице кабинета: есть что терять, а копии давно нет
function backupNag(){
  if(!hasWork())return'';const d=daysSinceBackup();
  if(d!==null&&d<BACKUP_NAG_DAYS)return'';
  return`<div class="card c0" data-act="pp" data-id="settings" role="button" tabindex="0" style="cursor:pointer"><b>Сделайте копию данных</b><div class="small">${d===null?'Копия ещё не делалась.':'Последней копии '+d+' '+plural(d,'день','дня','дней')+'.'} Нажмите, чтобы сохранить её в файл: так данные не пропадут.</div></div>`;
}
function confirmRestore(text){
  const r=parseBackup(text);if(r.err)return toast(r.err);
  const d=r.data,cnt=id=>d.kids[id].tasks.length+' '+plural(d.kids[id].tasks.length,'задание','задания','заданий')+', монет '+(d.kids[id].coins||0);
  const when=r.exported?new Date(r.exported).toLocaleDateString('ru-RU'):'неизвестно';
  const m=modal(`<h3>Восстановить данные?</h3><p class="ip">Копия от ${when}:<br>Кирилл: ${cnt('kirill')}<br>Вика: ${cnt('vika')}</p>
    <p class="ip"><b>Все данные на этом телефоне будут заменены данными из копии.</b> PIN останется прежним.</p>
    <button class="btn full red" id="rs-ok">Заменить данные</button><button class="btn full soft" id="rs-no" style="margin-top:8px">Отмена</button>`);
  m.querySelector('#rs-no').onclick=()=>m.remove();
  m.querySelector('#rs-ok').onclick=()=>{restoreBackup(d);m.remove();toast('Данные восстановлены');tab='parent';render()};
}
document.addEventListener('change',async e=>{
  if(!e.target||e.target.id!=='bk-file'||!e.target.files||!e.target.files[0])return;
  const f=e.target.files[0];e.target.value='';
  if(f.size>BACKUP_MAX)return toast('Файл слишком большой');
  try{confirmRestore(await f.text())}catch(err){toast('Не удалось прочитать файл')}
});
