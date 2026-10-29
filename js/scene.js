'use strict';
// Фон карты — картинка «Солнечная долина» (дальний слой: небо, холмы, луг). Луг прижат к низу карты, где старт; дорога и точки заданий рисуются поверх отдельно.
// H — полная высота карты; остальные параметры оставлены для совместимости вызова.
function sceneSvg(H){
  return`<image href="img/ref_bg_today.jpg" x="0" y="0" width="360" height="${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true"/>`;
}
