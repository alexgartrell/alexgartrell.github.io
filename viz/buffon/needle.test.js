const {test}=require('node:test'),a=require('node:assert/strict'),b=require('./needle');
const close=(x,y,eps=1e-9)=>a.ok(Math.abs(x-y)<eps,`${x} ≉ ${y}`);
test('a needle crosses when its half-height reaches the nearest line',()=>{
  a.ok(b.crosses(0.1,Math.PI/2,0.5,1));a.equal(b.crosses(0.5,Math.PI/2,0.5,1),false);
  a.ok(b.crosses(0.5,Math.PI/2,1,1));a.equal(b.crosses(0.5,0,1,1),false);
  a.ok(b.crosses(2.95,Math.PI/2,0.2,1));a.ok(b.crosses(-0.05,Math.PI/2,0.2,1));
  a.equal(b.crosses(3.5,Math.PI/6,0.8,1),false);a.ok(b.crosses(3.5,Math.PI/2,1,1));a.ok(b.crosses(3.25,Math.PI/6,1.2,1));
});
test('the crossing probability is 2l over pi t',()=>{close(b.crossProbability(1,1),2/Math.PI);close(b.crossProbability(0.5,2),0.5/Math.PI);});
test('estimate solves the crossing rate for pi',()=>{
  const s=b.tally(0.8,1);b.add(s,0.05,Math.PI/2);b.add(s,0.5,0);b.add(s,1.02,1);b.add(s,2.5,0.3);
  a.equal(s.total,4);a.equal(s.crossings,2);a.equal(b.clear(s),2);close(b.estimate(s),2*0.8*4/(1*2));
  a.ok(Number.isNaN(b.estimate(b.tally(1,1))));
});
test('crossing points lie on the lines and on the needle',()=>{
  const [x,y,th,l]=[2,3.1,0.9,1],pts=b.crossingPoints(x,y,th,l,1);
  a.equal(pts.length,1);close(pts[0][1],3);
  const along=(pts[0][0]-x)/Math.cos(th);close(y+along*Math.sin(th),3);a.ok(Math.abs(along)<=l/2);
  a.equal(b.crossingPoints(2,3.5,0.3,0.5,1).length,0);a.equal(b.crossingPoints(2,3.5,0,1,1).length,0);
});
test('standard error matches the delta method and shrinks with the square root of n',()=>{
  a.equal(b.standardError(0,1,1),Infinity);close(b.standardError(1,1,1),Math.PI*Math.sqrt((1-2/Math.PI)/(2/Math.PI)));
  close(b.standardError(100,1,1)*10,b.standardError(1,1,1));a.ok(b.standardError(100,0.3,1)>b.standardError(100,1,1));
});
test('matching decimals truncate',()=>{a.equal(b.matchingDecimals(3.1439),2);a.equal(b.matchingDecimals(3.1416),3);a.equal(b.matchingDecimals(NaN),0);});
test('a seeded run converges within a few standard errors of pi',()=>{
  for(const l of [1,0.4]){
    const random=b.mulberry32(11),s=b.tally(l,1),n=200000;
    for(let i=0;i<n;i++)b.add(s,random()*5,random()*Math.PI);
    a.ok(Math.abs(b.estimate(s)-Math.PI)<4*b.standardError(n,l,1),`l=${l}: ${b.estimate(s)}`);
  }
});
