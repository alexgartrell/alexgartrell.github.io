const {test}=require('node:test'),a=require('node:assert/strict'),p=require('./estimator');
test('points on the circle count as inside; corners do not',()=>{a.ok(p.inside(1,0));a.ok(p.inside(0,-1));a.ok(p.inside(0,0));a.equal(p.inside(1,1),false);a.equal(p.inside(-.8,.8),false);});
test('estimate is four times the hit fraction, or four minus four times the miss fraction',()=>{
  const t=p.tally();p.add(t,0,0);p.add(t,0,0);p.add(t,0,0);p.add(t,1,1);
  a.equal(t.total,4);a.equal(p.outside(t),1);a.equal(p.estimate(t),3);a.equal(p.estimate(t),4*t.inside/t.total);
  a.ok(Number.isNaN(p.estimate(p.tally())));
});
test('standard error shrinks with the square root of the sample size',()=>{
  a.equal(p.standardError(0),Infinity);a.ok(Math.abs(p.standardError(1)-1.642)<1e-3);
  a.ok(Math.abs(p.standardError(100)*10-p.standardError(1))<1e-12);
});
test('matching decimals use truncation rather than rounding',()=>{
  a.equal(p.matchingDecimals(Math.PI),14);a.equal(p.matchingDecimals(3.1439),2);a.equal(p.matchingDecimals(3.1416),3);
  a.equal(p.matchingDecimals(3.2),0);a.equal(p.matchingDecimals(2.99),0);a.equal(p.matchingDecimals(NaN),0);a.equal(p.matchingDecimals(3),0);
});
test('a seeded run converges within a few standard errors of pi',()=>{
  const random=p.mulberry32(42),t=p.tally(),n=200000;
  for(let i=0;i<n;i++)p.add(t,random()*2-1,random()*2-1);
  a.ok(Math.abs(p.estimate(t)-Math.PI)<4*p.standardError(n));
  const values=Array.from({length:1000},p.mulberry32(7));a.ok(values.every(v=>v>=0&&v<1));
});
