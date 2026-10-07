const {test}=require('node:test'),a=require('node:assert/strict'),b=require('./birthday');
const close=(x,y,eps=1e-9)=>a.ok(Math.abs(x-y)<eps,`${x} ≉ ${y}`);
test('exact probabilities match the textbook values',()=>{
  a.equal(b.probShared(0),0);a.equal(b.probShared(1),0);close(b.probShared(2),1/365);
  close(b.probShared(23),0.5072972343,1e-9);close(b.probShared(50),0.9703735796,1e-9);
  a.equal(b.probShared(366),1);a.ok(b.probShared(100)<1);
});
test('23 people is the first room with even odds',()=>{a.equal(b.firstAtLeast(0.5),23);a.equal(b.firstAtLeast(0.99),57);a.equal(b.firstAtLeast(0.5,2),2);});
test('labels name the day of a non-leap year',()=>{a.equal(b.label(0),'Jan 1');a.equal(b.label(31),'Feb 1');a.equal(b.label(58),'Feb 28');a.equal(b.label(59),'Mar 1');a.equal(b.label(364),'Dec 31');a.equal(b.STARTS[12],365);});
test('shared pairs count every pair in a group',()=>{a.equal(b.sharedPairs([1,2,3]),0);a.equal(b.sharedPairs([5,5]),1);a.equal(b.sharedPairs([5,5,5,9,9]),4);a.equal(b.pairs(23),253);a.ok(Object.is(b.pairs(0),0));});
test('the empirical curve is a cumulative share',()=>{
  const e=b.empirical([2,3,3,10],5);a.deepEqual([...e],[0,0,0.25,0.75,0.75,0.75]);a.equal(b.empirical([],3)[3],0);
});
test('simulated rooms agree with the exact curve',()=>{
  const random=b.mulberry32(5),firsts=Array.from({length:20000},()=>b.firstMatch(random)),e=b.empirical(firsts,80);
  a.ok(firsts.every(f=>f>=2&&f<=366));
  for(const n of [10,23,40])a.ok(Math.abs(e[n]-b.probShared(n))<0.015,`n=${n}: ${e[n]}`);
});
