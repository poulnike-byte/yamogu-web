// Pure reference formulas. Integrate with the app's existing layout and state.
export function coverTransform(vw,vh,iw=853,ih=1844,panX=0,panY=0){
  if(![vw,vh,iw,ih].every(n=>Number.isFinite(n)&&n>0)||![panX,panY].every(Number.isFinite))throw new RangeError('Invalid dimensions or pan');
  const scale=Math.max(vw/iw,vh/ih);
  return {scale,offsetX:(vw-iw*scale)/2+panX,offsetY:(vh-ih*scale)/2+panY,imageWidth:iw,imageHeight:ih};
}
export function toScreen(u,v,t){return {x:t.offsetX+u*t.imageWidth*t.scale,y:t.offsetY+v*t.imageHeight*t.scale};}
export function toImage(x,y,t){return {u:(x-t.offsetX)/(t.imageWidth*t.scale),v:(y-t.offsetY)/(t.imageHeight*t.scale)};}
