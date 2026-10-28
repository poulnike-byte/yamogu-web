const CACHE='yamogu-v24';
const FILES=['./','index.html','css/app.css','js/vendor/confetti.browser.min.js','js/vendor/howler.min.js','sounds/ok.wav','js/tokens.js','js/icons.js','js/storage.js','js/app.js','js/skills.js','js/report.js','js/wishes.js','js/onboarding.js','js/cosmetics.js','js/parent.js','js/route.js','manifest.webmanifest','img/decor/flag_blue.png','img/decor/flag_flower.png','img/decor/flag_red.png','img/decor/flag_star.png','img/decor/ring_blue.png','img/decor/ring_gold.png','img/decor/ring_rainbow.png','img/decor/ring_white.png','img/decor/trail_gold.png','img/decor/trail_green.png','img/decor/trail_sand.png','img/decor/trail_stone.png','img/decor/trees_autumn.png','img/decor/trees_cherry.png','img/decor/trees_pine.png','img/decor/trees_round.png','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))));self.clients.claim()});
// Сеть в приоритете (чтобы обновления доходили), кэш — для работы без интернета.
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));
});
