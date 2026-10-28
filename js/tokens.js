'use strict';
// Цвета из таблицы токенов в css/app.css (блок :root). Нужны там, где CSS-переменную записать нельзя:
// атрибуты SVG (иконки, маршрут, кольцо отчёта) и конфетти. COL.blue → «#1F6BFF», COL.blueLight берёт --blue-light.
// Менять цвета нужно только в css/app.css.
const _col={};
const COL=new Proxy({},{get:(_,n)=>_col[n]||(_col[n]=getComputedStyle(document.documentElement).getPropertyValue('--'+String(n).replace(/[A-Z]/g,m=>'-'+m.toLowerCase())).trim())});
