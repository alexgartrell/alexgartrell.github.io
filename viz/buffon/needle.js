(function(root){
  const PI_TEXT='3.14159265358979';
  // A needle of length l ≤ t, dropped on lines spaced t apart, crosses one with probability 2l/(πt).
  function crossProbability(l,t){return 2*l/(Math.PI*t);}
  // y is the height of the needle's centre and theta its angle to the lines, which sit at every multiple of t.
  function crosses(y,theta,l,t){
    const d=((y%t)+t)%t,gap=Math.min(d,t-d);
    return gap<=l/2*Math.abs(Math.sin(theta));
  }
  function tally(l,t){return {l,t,total:0,crossings:0};}
  function add(s,y,theta){s.total++;const hit=crosses(y,theta,s.l,s.t);if(hit)s.crossings++;return hit;}
  function clear(s){return s.total-s.crossings;}
  // Solve crossings / total ≈ 2l/(πt) for π.
  function estimate(s){return s.crossings?2*s.l*s.total/(s.t*s.crossings):NaN;}
  // Delta method: π̂ = 2l/(t·p̂), so its standard error is π·√((1 − p)/(n·p)).
  function standardError(n,l,t){
    if(!(n>0))return Infinity;
    const p=crossProbability(l,t);return Math.PI*Math.sqrt((1-p)/(n*p));
  }
  // Points where a needle centred at (x, y) meets the lines, for the landing flash.
  function crossingPoints(x,y,theta,l,t){
    const s=Math.sin(theta),h=l/2*Math.abs(s),out=[];
    if(!h)return out;
    for(let k=Math.ceil((y-h)/t);k*t<=y+h;k++)out.push([x+Math.cos(theta)*(k*t-y)/s,k*t]);
    return out;
  }
  // Decimal places that agree with π when both are truncated, e.g. 3.1439 → 2.
  function matchingDecimals(value){
    if(!Number.isFinite(value)||value<0)return 0;
    const text=(Math.floor(value*1e14)/1e14).toFixed(14);let i=0;
    while(i<PI_TEXT.length&&text[i]===PI_TEXT[i])i++;
    return Math.max(0,i-2);
  }
  // Small seeded generator so runs can be reproduced in tests.
  function mulberry32(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  const api={crossProbability,crosses,tally,add,clear,estimate,standardError,crossingPoints,matchingDecimals,mulberry32};
  if(typeof module!=='undefined')module.exports=api;else root.BuffonNeedle=api;
})(globalThis);
