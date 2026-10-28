// Автопроверки ЯмогУ! в настоящем браузере (Edge/Chrome, отдельный браузер не скачивается).
// Запуск: npm install && npm test. Каждая проверка идёт в чистом профиле браузера.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.webmanifest': 'application/json' };
let server, base;
test.before(async () => {
  server = http.createServer((q, r) => {
    const f = path.join(root, new URL(q.url, 'http://x').pathname.replace(/\/$/, '/index.html'));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end(); }
    r.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f));
  });
  await new Promise(res => server.listen(0, res));
  base = `http://127.0.0.1:${server.address().port}/`;
});
test.after(() => server.close());

// Чистый профиль; s.reopen() закрывает и снова открывает браузер с теми же данными (проверка сохранения)
async function session(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yamogu-e2e-'));
  const open = async () => {
    const ctx = await chromium.launchPersistentContext(dir, { channel: 'msedge', headless: true, viewport: { width: 420, height: 900 } });
    const page = ctx.pages()[0] || await ctx.newPage();
    page.on('pageerror', e => { throw e; });
    await page.goto(base);
    await page.waitForFunction(() => typeof S !== 'undefined' && S);
    return { ctx, page };
  };
  let cur = await open();
  const api = {
    get page() { return cur.page; },
    reopen: async () => { await cur.page.waitForTimeout(700); await cur.ctx.close(); cur = await open(); },
  };
  try { await fn(api); } finally { await cur.ctx.close().catch(() => {}); fs.rmSync(dir, { recursive: true, force: true }); }
}
// После перезапуска выбранный ребёнок сохраняется — тогда экран выбора не показывается
const asKirill = async p => { await p.waitForFunction(() => S.onb); await p.evaluate(() => { if (!S.onb.done) { S.onb.done = true; save(); render(); } });   // онбординг проверяется отдельным тестом
  await p.waitForSelector('nav,[data-act=who]'); if (await p.isVisible('[data-act=who][data-id=kirill]')) await p.click('[data-act=who][data-id=kirill]'); await p.waitForSelector('nav'); };
const toParent = async (p, pin) => {
  await p.click('[data-tab=home]'); await p.click('[data-act=toparent]');
  await p.fill('#pin', pin); await p.click('[data-act=newpin],[data-act=unlock]');
  await exitIntro(p);
};
// У нового родителя после PIN открывается «Знакомство»: в проверках из него выходим
const exitIntro = async p => { if (await p.waitForSelector('[data-act=i_exit],[data-act=addtask]', { timeout: 3000 }).then(e => e.getAttribute('data-act')).catch(() => '') === 'i_exit') await p.click('[data-act=i_exit]'); };

test('PIN: задаётся, переживает перезапуск, неверный не пускает', async () => session(async s => {
  let p = s.page; await asKirill(p); await toParent(p, '2468');
  await p.waitForSelector('text=Ожидают проверки');
  await s.reopen(); p = s.page; await asKirill(p);
  await p.click('[data-tab=home]'); await p.click('[data-act=toparent]'); await p.fill('#pin', '1111'); await p.click('[data-act=unlock]');
  await p.waitForSelector('.toast', { timeout: 1500 });   // «Неверный PIN» держится меньше 2 секунд
  assert.ok(!await p.isVisible('text=Ожидают проверки'));
  await p.fill('#pin', '2468'); await p.click('[data-act=unlock]'); await exitIntro(p);
  await p.waitForSelector('text=Ожидают проверки');
}));

test('«Забыли PIN?»: нужно слово УДАЛИТЬ, потом новый PIN', async () => session(async s => {
  let p = s.page; await asKirill(p); await toParent(p, '2468');
  await p.evaluate(() => { unlocked = false; render(); });
  await p.click('[data-act=forgot]'); await p.fill('#fg-w', 'нет'); await p.click('#fg-ok');
  assert.equal(await p.evaluate(() => !!S.pin), true, 'без слова ничего не удаляется');
  await p.fill('#fg-w', 'удалить'); await p.click('#fg-ok');
  assert.equal(await p.evaluate(() => S.pin), null);
  await p.fill('#pin', '1357'); await p.click('[data-act=newpin]'); await exitIntro(p); await p.waitForSelector('text=Ожидают проверки');
}));

test('Задание: ребёнок отправляет, родитель подтверждает — награда один раз', async () => session(async s => {
  let p = s.page; await asKirill(p); await toParent(p, '2468');
  await p.click('[data-act=addtask]'); await p.fill('#f-t', 'Собрать портфель'); await p.fill('#f-c', '20'); await p.fill('#f-x', '10');
  await p.selectOption('#f-s', '+Самоорганизация'); await p.click('#f-ok');
  await p.click('[data-tab=home]'); await p.click('[data-act=submit]');
  await p.click('[data-act=toparent]'); await p.fill('#pin', '2468'); await p.click('[data-act=unlock]'); await exitIntro(p);
  await p.click('[data-act=review]');
  assert.ok(await p.isDisabled('#rv-ok'), 'без выбора помощи подтвердить нельзя');
  await p.click('[data-help=INDEPENDENT]'); await p.click('#rv-ok');
  assert.deepEqual(await p.evaluate(() => [K().coins, K().xp, K().log.length, K().log[0].help, !!K().log[0].skill]), [20, 10, 1, 'INDEPENDENT', true]);
  await p.evaluate(() => approve(K().tasks[0].id));   // повторное подтверждение не платит
  assert.equal(await p.evaluate(() => K().coins), 20);
}));

test('Повторы: задание на сегодня создаётся один раз и после перезапуска', async () => session(async s => {
  let p = s.page; await asKirill(p); await toParent(p, '2468');
  await p.click('[data-act=addtask]'); await p.fill('#f-t', 'Зубы'); await p.selectOption('#f-r', 'daily'); await p.click('#f-ok');
  const n = () => p.evaluate(() => todays(K()).filter(t => t.title === 'Зубы').length);
  assert.equal(await n(), 1);
  await s.reopen(); p = s.page; await asKirill(p);
  assert.equal(await n(), 1, 'после перезапуска дубля быть не должно');
  assert.equal(await p.evaluate(() => occursOn('weekdays', '2026-11-01')), false);   // воскресенье
}));

test('Цели: ставятся, считаются по подтверждённым, неверные значения отклоняются', async () => session(async s => {
  let p = s.page; await asKirill(p); await toParent(p, '2468');
  await p.click('[data-act=addgoal]'); await p.fill('#g-t', 'ab'); await p.click('#g-ok');
  assert.equal(await p.evaluate(() => K().goals.length), 0);
  await p.fill('#g-t', 'Рюкзак с вечера'); await p.fill('#g-n', '2'); await p.click('#g-ok');
  await p.evaluate(() => { for (let i = 0; i < 2; i++) { K().tasks.push({ id: 'z' + i, title: 'З', desc: '', coins: 1, xp: 1, status: 'AVAILABLE' }); submit('z' + i); approve('z' + i, 'INDEPENDENT'); } });
  await p.click('[data-tab=goals]'); await p.waitForSelector('text=Цель недели достигнута');
}));

test('Прогресс: неделя по дням, навыки, достижения', async () => session(async s => {
  let p = s.page; await asKirill(p);
  await p.evaluate(() => { const sk = addSkill(K(), 'Порядок'); K().log.push({ day: dayStr(), title: 'x', skill: sk.id, help: 'INDEPENDENT' }); K().tasks.push({ id: 'w', title: 'W', desc: '', coins: 1, xp: 1, status: 'AVAILABLE' }); submit('w'); render(); });
  await p.click('[data-tab=progress]');
  for (const t of ['Моя неделя', 'Последние 4 недели', 'Мои навыки', 'достижение']) assert.ok(await p.isVisible(`text=${t}`), t);
  assert.equal(await p.locator('[role=img][aria-label*="сегодня"]').count(), 1);
}));

test('Звук: играет при подтверждении, родитель может выключить, файл доступен', async () => session(async s => {
  let p = s.page; await asKirill(p);
  const wav = await p.evaluate(async () => { const r = await fetch('sounds/ok.wav'); return [r.status, (await r.arrayBuffer()).byteLength]; });
  assert.equal(wav[0], 200); assert.ok(wav[1] > 50000, 'файл звука не пустой');
  assert.equal(await p.evaluate(() => typeof Howl), 'function');
  await p.evaluate(() => { window.__plays = 0; Howl.prototype.play = function () { window.__plays++; return 0; }; });   // слышать звук тест не может — считаем вызовы
  const approveOne = async id => {
    await p.evaluate(i => { K().tasks.push({ id: i, title: i, desc: '', coins: 1, xp: 1, status: 'AVAILABLE' }); submit(i); tab = 'parent'; unlocked = true; render(); }, id);
    await p.click(`[data-act=review][data-id=${id}]`); await p.click('[data-help=INDEPENDENT]'); await p.click('#rv-ok');
  };
  await approveOne('a1'); assert.equal(await p.evaluate(() => window.__plays), 1, 'при подтверждении звук играет');
  await p.evaluate(() => { tab = 'parent'; unlocked = true; render(); });
  await p.click('[data-act=sound]'); assert.equal(await p.evaluate(() => S.sound), false); assert.ok(await p.isVisible('text=Звук: выкл'));
  await approveOne('a2'); assert.equal(await p.evaluate(() => window.__plays), 1, 'при выключенном звуке тишина');
}));

test('Отчёт родителя: неделя и 4 недели, возвраты, уровни помощи, сравнение', async () => session(async s => {
  let p = s.page; await asKirill(p); await toParent(p, '2468');
  await p.evaluate(() => {
    const d = dayStr();
    K().log.push({ day: d, title: 'a', help: 'INDEPENDENT' }, { day: d, title: 'b', help: 'SMALL_HELP' }, { day: d, title: 'c', help: 'UNKNOWN' }, { day: addDays(d, -15), title: 'old', help: 'INDEPENDENT' });
    K().tasks.push({ id: 'r1', title: 'R', desc: '', coins: 1, xp: 1, status: 'AVAILABLE' }); submit('r1'); reject('r1');
    K().tasks.push({ id: 'r2', title: 'R2', desc: '', coins: 1, xp: 1, status: 'AVAILABLE' }); submit('r2');
    render();
  });
  assert.ok(await p.isVisible('text=Уровень помощи при подтверждённых'));
  assert.deepEqual(await p.evaluate(() => { const w = periodData(K(), mondayOf(dayStr()), addDays(mondayOf(dayStr()), 6)); return [w.approved, w.waiting, w.returned, w.assessed]; }), [3, 1, 1, 2]);
  assert.ok(await p.isVisible('text=Для сравнения с прошлой неделей пока мало'));
  await p.click('[data-act=range][data-id="4w"]');
  assert.equal(await p.evaluate(() => periodData(K(), addDays(dayStr(), -27), dayStr()).approved), 4);
  assert.ok(await p.isVisible('text=Из 6 отправленных'), 'в 4 недели: 4 подтверждено + 1 ждёт + 1 возвращено');
  assert.ok(await p.isVisible('text=«Не оценено» значит'));
}));

test('Желания: покупка с подтверждением, цель, отложить, выдать, отменить, скрыть', async () => session(async s => {
  let p = s.page; await asKirill(p); await toParent(p, '2468');
  // родитель: проверка цены и название, потом желание из шаблона
  await p.click('[data-act=addwish]'); await p.click('[data-pick="own"]');
  await p.fill('#w-t', 'Кино'); await p.fill('#w-p', '5'); await p.click('#w-ok');
  assert.equal(await p.evaluate(() => K().wishes.length), 0, 'цена меньше 10 отклоняется');
  await p.fill('#w-p', '300'); await p.click('#w-ok');
  await p.click('[data-act=addwish]'); await p.click('[data-pick="0"]'); await p.click('#w-ok');   // «Выбрать мультфильм на вечер», 150
  assert.deepEqual(await p.evaluate(() => K().wishes.map(w => [w.title, w.price])), [['Кино', 300], ['Выбрать мультфильм на вечер', 150]]);
  await p.evaluate(() => { K().coins = 500; });
  // ребёнок: покупка через подтверждение
  await p.click('[data-tab=wishes]');
  await p.locator('[data-act=wishbuy]').first().click();
  assert.ok(await p.isVisible('text=Купить «Кино»?'));
  await p.click('#by-no'); assert.equal(await p.evaluate(() => K().purchases.length), 0, '«Не сейчас» ничего не покупает');
  await p.locator('[data-act=wishbuy]').first().click(); await p.click('#by-ok');
  assert.deepEqual(await p.evaluate(() => [K().purchases.length, avail(K()), K().purchases[0].status]), [1, 200, 'BOUGHT']);
  assert.ok(await p.isVisible('text=Куплено. Ждём, когда родитель выдаст награду.'));
  await p.evaluate(() => buyWish(K(), K().wishes[0].id));   // повторная покупка того же желания
  assert.equal(await p.evaluate(() => K().purchases.length), 1, 'открытая покупка по желанию только одна');
  // цель
  await p.locator('[data-act=wishgoal]').nth(1).click();
  await p.click('[data-tab=home]'); assert.ok(await p.isVisible('text=Моя цель: Выбрать мультфильм на вечер'));
  // родитель: отложить с причиной, ребёнок видит причину, потом выдать
  await p.click('[data-act=toparent]'); await p.fill('#pin', '2468'); await p.click('[data-act=unlock]'); await exitIntro(p);
  await p.evaluate(() => { K().purchases[0].at = addDays(dayStr(), -8); render(); });
  assert.ok(await p.isVisible('text=Ждёт выдачи уже 8 дней'));
  await p.click('[data-act=postpone]'); await p.fill('#pp-n', 'пойдём в субботу'); await p.click('#pp-ok');
  assert.equal(await p.evaluate(() => [K().purchases[0].status, K().purchases[0].note, avail(K())].join('|')), 'POSTPONED|пойдём в субботу|200', 'отложено, монеты всё ещё заморожены');
  await p.click('[data-act=deliver]');
  assert.equal(await p.evaluate(() => K().purchases[0].status), 'DELIVERED');
  assert.equal(await p.evaluate(() => avail(K())), 200, 'выданное — потрачено');
  // отмена возвращает монеты
  await p.evaluate(() => { buyWish(K(), K().wishes[1].id); render(); });
  assert.equal(await p.evaluate(() => avail(K())), 50);
  await p.click('[data-act=cancelp]'); await p.click('#cp-ok');
  assert.equal(await p.evaluate(() => avail(K())), 200, 'отмена возвращает монеты полностью');
  // скрыть желание: ребёнок не видит, цель снимается
  await p.click('[data-act=hidewish] >> nth=1');
  assert.deepEqual(await p.evaluate(() => [K().wishes[1].hidden, K().goal]), [true, null]);
}));

test('Онбординг: приветствие, знакомство, три навыка; повторно не показывается', async () => session(async s => {
  let p = s.page; await p.waitForFunction(() => S.onb);
  assert.ok(await p.isVisible('text=Давай учиться'), 'на чистом устройстве показывается приветствие');
  await p.click('[data-act=ob_next]');                                   // «Начать»
  assert.ok(await p.isVisible('text=Давай познакомимся!'));
  await p.click('[data-act=ob_child][data-id=vika]');
  assert.equal(await p.locator('[data-act=ob_age]').count(), 4, 'у Вики возраст 6–9');
  await p.click('[data-act=ob_child][data-id=kirill]');
  assert.equal(await p.locator('[data-act=ob_age]').count(), 3, 'у Кирилла возраст 10–12');
  await p.click('[data-act=ob_child][data-id=vika]'); await p.click('[data-act=ob_age][data-id="8"]');
  await p.fill('#ob-name', 'Маша'); await p.click('[data-act=ob_next]');
  assert.ok(await p.isVisible('text=Выбери первые навыки'));
  assert.ok(await p.isDisabled('[data-act=ob_next]'), 'без трёх навыков дальше нельзя');
  for (const t of ['Утренние дела', 'Делать уроки', 'Заниматься спортом']) await p.click(`[data-act=ob_skill][data-id="${t}"]`);
  await p.click('[data-act=ob_skill][data-id="Планировать день"]');
  assert.equal(await p.evaluate(() => S.onb.skills.length), 3, 'четвёртый навык не выбирается');
  await p.click('[data-act=ob_next]');
  assert.deepEqual(await p.evaluate(() => [S.cur, S.kids.vika.name, S.kids.vika.age, S.interests.length, S.onb.done]), ['vika', 'Маша', 8, 3, true]);
  assert.ok(await p.isVisible('text=Маша!'), 'имя из знакомства в приветствии');
  await s.reopen(); p = s.page; await p.waitForSelector('nav'); await p.click('[data-tab=home]');
  assert.ok(await p.isVisible('text=Маша!'), 'после перезапуска онбординга нет, имя сохранилось');
  // навыки из онбординга предлагаются при создании задания
  await p.click('[data-tab=home]'); await p.click('[data-act=toparent]'); await p.fill('#pin', '2468'); await p.click('[data-act=newpin]'); await exitIntro(p);
  await p.click('[data-act=addtask]');
  assert.ok((await p.locator('#f-s option').allTextContents()).includes('+ Утренние дела'));
}));

test('Онбординг не прерывает тех, у кого уже есть данные', async () => session(async s => {
  const p = s.page; await p.waitForFunction(() => S.onb);
  const r = await p.evaluate(() => { const o = { kids: { kirill: blank(), vika: blank() }, cur: null, pin: null }; o.kids.kirill.coins = 5; const a = normalize(o).onb.done;
    const b = normalize({ kids: { kirill: blank(), vika: blank() }, cur: null, pin: null }).onb.done;
    const c = normalize({ kids: { kirill: blank(), vika: blank() }, cur: null, pin: { salt: 'x', hash: 'y' } }).onb.done; return [a, b, c]; });
  assert.deepEqual(r, [true, false, true], 'монеты или PIN = уже пользовались; пусто = нужен онбординг');
}));
