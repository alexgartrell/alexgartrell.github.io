(function(root){
  const DAYS=365,MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],LENGTHS=[31,28,31,30,31,30,31,31,30,31,30,31];
  const STARTS=LENGTHS.reduce((s,l,i)=>(s.push(s[i]+l),s),[0]);
  // Chance that at least two of n people share a birthday: 1 − (365/365)(364/365)…((365 − n + 1)/365).
  function probShared(n,days=DAYS){
    if(n>days)return 1;
    let none=1;for(let k=0;k<n;k++)none*=(days-k)/days;
    return 1-none;
  }
  // Smallest room where a match is at least as likely as `target`.
  function firstAtLeast(target,days=DAYS){let n=0;while(probShared(n,days)<target)n++;return n;}
  function pairs(n){return n<2?0:n*(n-1)/2;}
  // Day 0 is January 1 in a non-leap year.
  function label(day){let m=0;while(day>=STARTS[m+1])m++;return `${MONTHS[m]} ${day-STARTS[m]+1}`;}
  // Pairs of people who share a birthday, counting every pair within a group of three or more.
  function sharedPairs(birthdays){const seen=new Map();let n=0;for(const d of birthdays){const c=seen.get(d)||0;n+=c;seen.set(d,c+1);}return n;}
  // Fill a room one person at a time; return how many people are in it when the first shared birthday appears.
  function firstMatch(random,days=DAYS){
    const seen=new Uint8Array(days);
    for(let n=1;;n++){const d=Math.floor(random()*days);if(seen[d])return n;seen[d]=1;}
  }
  // Share of rooms that already had a match with n people, for n = 0…maxN.
  function empirical(firsts,maxN){
    const out=new Float64Array(maxN+1);if(!firsts.length)return out;
    for(const f of firsts)if(f<=maxN)out[f]++;
    for(let n=1;n<=maxN;n++)out[n]+=out[n-1];
    return out.map(v=>v/firsts.length);
  }
  // Small seeded generator so runs can be reproduced in tests.
  function mulberry32(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  const api={DAYS,MONTHS,STARTS,probShared,firstAtLeast,pairs,label,sharedPairs,firstMatch,empirical,mulberry32};
  if(typeof module!=='undefined')module.exports=api;else root.Birthday=api;
})(globalThis);
