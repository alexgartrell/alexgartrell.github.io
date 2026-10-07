const {test}=require('node:test'),a=require('node:assert/strict'),g=require('./galton');
const close=(x,y,eps=1e-9)=>a.ok(Math.abs(x-y)<eps,`${x} ≉ ${y}`);
test('binomial probabilities match Pascal’s triangle and sum to one',()=>{
  const b=g.binomial(4,0.5);[1,4,6,4,1].forEach((c,k)=>close(b[k],c/16));
  for(const [n,p] of [[12,0.5],[20,0.13],[7,0.9]])close(g.binomial(n,p).reduce((s,v)=>s+v,0),1);
  a.deepEqual(g.binomial(3,0),[1,0,0,0]);a.deepEqual(g.binomial(3,1),[0,0,0,1]);
});
test('the binomial has mean np and variance np(1 − p)',()=>{
  const n=15,p=0.3,b=g.binomial(n,p),mean=b.reduce((s,v,k)=>s+v*k,0),vari=b.reduce((s,v,k)=>s+v*(k-mean)**2,0);
  close(mean,g.theory(n,p).mean);close(Math.sqrt(vari),g.theory(n,p).sd);
});
test('stats summarise bin counts',()=>{
  const s=g.stats([0,2,0,2]);a.equal(s.total,4);a.equal(s.mean,2);a.equal(s.sd,1);
  a.ok(Number.isNaN(g.stats([0,0]).mean));
});
test('a route steps down one peg or one peg to the right each row',()=>{
  const r=g.route(10,0.5,g.mulberry32(3));a.equal(r.length,11);a.equal(r[0],0);
  for(let i=1;i<r.length;i++)a.ok(r[i]-r[i-1]===0||r[i]-r[i-1]===1);
  a.deepEqual([...g.route(4,1,Math.random)],[0,1,2,3,4]);a.deepEqual([...g.route(4,0,Math.random)],[0,0,0,0,0]);
});
test('the normal density integrates to one',()=>{let s=0;for(let x=-10;x<=10;x+=0.01)s+=g.normalPdf(x,0.5,1.7)*0.01;close(s,1,1e-6);});
test('seeded drops match the theory',()=>{
  const random=g.mulberry32(9),rows=12,p=0.65,counts=new Array(rows+1).fill(0),n=40000;
  for(let i=0;i<n;i++)counts[g.drop(rows,p,random)]++;
  const s=g.stats(counts),t=g.theory(rows,p);
  a.ok(Math.abs(s.mean-t.mean)<4*t.sd/Math.sqrt(n));a.ok(Math.abs(s.sd-t.sd)<0.03);
});
