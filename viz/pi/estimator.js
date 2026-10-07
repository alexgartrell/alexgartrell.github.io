(function(root){
  const PI_TEXT='3.14159265358979';
  // A dart uniformly in [-1, 1]² lands in the unit circle with probability π/4.
  const P_INSIDE=Math.PI/4,SIGMA=4*Math.sqrt(P_INSIDE*(1-P_INSIDE));
  function inside(x,y){return x*x+y*y<=1;}
  function tally(){return {total:0,inside:0};}
  function add(t,x,y){t.total++;const hit=inside(x,y);if(hit)t.inside++;return hit;}
  function outside(t){return t.total-t.inside;}
  // Equivalent to 4·inside/total, written in terms of the darts that miss the circle.
  function estimate(t){return t.total?4*(1-outside(t)/t.total):NaN;}
  function standardError(total){return total>0?SIGMA/Math.sqrt(total):Infinity;}
  // Decimal places that agree with π when both are truncated, e.g. 3.1439 → 2.
  function matchingDecimals(value){
    if(!Number.isFinite(value)||value<0)return 0;
    const text=(Math.floor(value*1e14)/1e14).toFixed(14);let i=0;
    while(i<PI_TEXT.length&&text[i]===PI_TEXT[i])i++;
    return Math.max(0,i-2);
  }
  // Small seeded generator so runs can be reproduced in tests.
  function mulberry32(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  const api={PI_TEXT,SIGMA,inside,tally,add,outside,estimate,standardError,matchingDecimals,mulberry32};
  if(typeof module!=='undefined')module.exports=api;else root.PiEstimator=api;
})(globalThis);
