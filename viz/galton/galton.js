(function(root){
  // Chance of landing in bin k after n bounces, each one to the right with probability p: C(n,k)·pᵏ·(1−p)ⁿ⁻ᵏ.
  function binomial(n,p){
    const out=new Array(n+1).fill(0);
    if(p<=0||p>=1){out[p>=1?n:0]=1;return out;}
    let logC=0;
    for(let k=0;k<=n;k++){if(k)logC+=Math.log((n-k+1)/k);out[k]=Math.exp(logC+k*Math.log(p)+(n-k)*Math.log(1-p));}
    return out;
  }
  function theory(n,p){return {mean:n*p,sd:Math.sqrt(n*p*(1-p))};}
  function normalPdf(x,mean,sd){const z=(x-mean)/sd;return Math.exp(-z*z/2)/(sd*Math.sqrt(2*Math.PI));}
  // Observed mean and (population) standard deviation of the bin numbers.
  function stats(counts){
    let total=0,sum=0,sq=0;
    counts.forEach((c,k)=>{total+=c;sum+=c*k;sq+=c*k*k;});
    if(!total)return {total,mean:NaN,sd:NaN};
    const mean=sum/total;return {total,mean,sd:Math.sqrt(Math.max(0,sq/total-mean*mean))};
  }
  // One ball's route: entry r is how many times it has gone right before reaching row r, so it hits peg route[r] there.
  function route(rows,p,random){const out=new Uint8Array(rows+1);for(let r=0;r<rows;r++)out[r+1]=out[r]+(random()<p?1:0);return out;}
  function drop(rows,p,random){let k=0;for(let r=0;r<rows;r++)if(random()<p)k++;return k;}
  // Small seeded generator so runs can be reproduced in tests.
  function mulberry32(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  const api={binomial,theory,normalPdf,stats,route,drop,mulberry32};
  if(typeof module!=='undefined')module.exports=api;else root.Galton=api;
})(globalThis);
