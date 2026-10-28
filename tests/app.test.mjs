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
const asKirill = async p => { await p.waitForSelector('nav,[data-act=who]'); if (await p.isVisible('[data-act=who][data-id=kirill]')) await p.click('[data-act=who][data-id=kirill]'); await p.waitForSelector('nav'); };
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
