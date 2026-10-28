'use strict';
// Фон карты маршрута (порт drawScenery из RouteMapView.kt в Android): небо с солнцем и облаками → горы со снежными шапками → луг,
// река с деревянным мостиком там, где её пересекает дорожка, домик на старте. Координаты в единицах карты (ширина 360).
function mountainSvg(a,b,c,body,shade){
  const [px,py]=b,h=34;
  return`<path d="M${a[0]},${a[1]} L${px},${py} L${c[0]},${c[1]} Z" fill="${body}"/><path d="M${px},${py} L${c[0]},${c[1]} L${px+6},${c[1]} Z" fill="${shade}"/>`
    +`<path d="M${px},${py} L${px-h*.55},${py+h} L${px-h*.15},${py+h*.8} L${px+h*.15},${py+h} L${px+h*.55},${py+h*.85} Z" fill="#fff"/>`;
}
// H — полная высота карты, H0 — высота по числу заданий (дом стоит у старта), bridge — {x,y,ang} точка дорожки у реки или null
function sceneSvg(H,H0,bridge){
  const cloud=(x,y)=>`<circle cx="${x}" cy="${y}" r="16"/><circle cx="${x+20}" cy="${y+4}" r="20"/><circle cx="${x+42}" cy="${y+6}" r="14"/>`;
  let s=`<defs><linearGradient id="skyg" x1="0" y1="0" x2="0" y2="330" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${COL.skyTop}"/><stop offset="1" stop-color="${COL.skyBottom}"/></linearGradient>
    <linearGradient id="medg" x1="0" y1="340" x2="0" y2="${H}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${COL.meadowA}"/><stop offset="1" stop-color="${COL.meadowB}"/></linearGradient></defs>
    <rect x="0" y="0" width="360" height="350" fill="url(#skyg)"/><circle cx="300" cy="52" r="26" fill="${COL.sun}"/>
    <g fill="#fff" opacity=".86">${cloud(60,60)}${cloud(190,38)}</g>`;
  s+=mountainSvg([170,345],[290,125],[420,345],COL.mtn1,COL.mtn1Shade)+mountainSvg([-10,345],[60,215],[140,345],COL.mtn2,COL.mtn2Shade)+mountainSvg([-90,345],[94,158],[280,345],COL.mtn3,COL.mtn3Shade);
  s+=`<rect x="0" y="340" width="360" height="${Math.max(0,H-340)}" fill="url(#medg)"/>`;
  // река
  s+=`<path d="M0,355 C120,335 240,395 360,360 L360,410 C240,440 120,380 0,405 Z" fill="${COL.river}"/><g fill="${COL.riverHi}" opacity=".7"><rect x="40" y="372" width="60" height="6" rx="3"/><rect x="230" y="385" width="70" height="6" rx="3"/></g>`;
  // мостик по ходу дорожки
  if(bridge)s+=`<g transform="translate(${bridge.x.toFixed(1)},${bridge.y.toFixed(1)}) rotate(${bridge.ang.toFixed(1)})"><rect x="-46" y="-19" width="92" height="38" rx="8" fill="${COL.bridge}"/>${[0,1,2,3,4].map(i=>`<rect x="${-40+i*17}" y="-15" width="12" height="30" rx="4" fill="${COL.plank}"/>`).join('')}</g>`;
  // домик у старта
  const hy=H0-84;
  s+=`<g><rect x="10" y="${hy}" width="56" height="50" rx="6" fill="${COL.houseWall}"/><path d="M2,${hy+4} L38,${hy-30} L74,${hy+4} Z" fill="${COL.roof}"/><rect x="30" y="${hy+22}" width="16" height="28" rx="4" fill="${COL.door}"/></g>`;
  return s;
}
