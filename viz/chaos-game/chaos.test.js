const {test}=require('node:test'),a=require('node:assert/strict'),c=require('./chaos');
const near=(x,y,eps=1e-9)=>Math.abs(x-y)<eps;
test('regular polygons are evenly spaced, start at the top and fit in the square',()=>{
  for(const k of [3,4,5,6,8]){
    const v=c.polygon(k);a.equal(v.length,k);a.ok(near(v[0][0],0));a.ok(v.every(([x,y])=>Math.abs(x)<=1&&Math.abs(y)<=1));
    const d=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);for(let i=1;i<k;i++)a.ok(near(d(v[i-1],v[i]),d(v[0],v[1])));
    const ys=v.map(p=>p[1]);a.ok(near(Math.max(...ys),-Math.min(...ys)));
  }
  const sq=c.polygon(4,Math.PI/4);a.ok(near(sq[0][0],sq[1][0]));a.ok(near(sq[0][1],-sq[1][1]));a.ok(near(Math.abs(sq[0][0]),0.98));
});
test('the kissing ratio gives the classic values',()=>{
  a.ok(near(c.optimalRatio(3),0.5));a.ok(near(c.optimalRatio(4),0.5));
  a.ok(near(c.optimalRatio(5),(Math.sqrt(5)-1)/2));a.ok(near(c.optimalRatio(6),2/3));
});
test('rules forbid the right vertices',()=>{
  a.deepEqual(c.allowedVertices(4,2,'any'),[0,1,2,3]);a.deepEqual(c.allowedVertices(4,2,'no-repeat'),[0,1,3]);
  a.deepEqual(c.allowedVertices(5,0,'no-neighbor'),[0,2,3]);a.deepEqual(c.allowedVertices(4,-1,'no-neighbor'),[0,1,2,3]);
  const random=c.mulberry32(3),v=c.polygon(4);
  for(const rule of ['no-repeat','no-neighbor']){
    const s=c.start(random);let prev=-1;
    for(let i=0;i<5000;i++){const j=c.step(s,v,0.5,rule,random);if(prev>=0)a.ok(c.RULES[rule].allowed(j,prev,4));prev=j;}
  }
});
test('each step moves exactly r of the way to the chosen vertex',()=>{
  const v=c.polygon(3),s={x:0.2,y:-0.4,prev:-1},i=c.step(s,v,0.25,'any',()=>0.5);
  a.equal(i,1);a.ok(near(s.x,0.2+0.25*(v[1][0]-0.2)));a.ok(near(s.y,-0.4+0.25*(v[1][1]+0.4)));
});
test('the triangle with r = 1/2 never visits the removed middle triangle',()=>{
  const v=c.polygon(3),mid=(p,q)=>[(p[0]+q[0])/2,(p[1]+q[1])/2],m=[mid(v[0],v[1]),mid(v[1],v[2]),mid(v[2],v[0])];
  const random=c.mulberry32(9),s=c.start(random);
  for(let i=0;i<40;i++)c.step(s,v,0.5,'any',random);
  let inside=0;for(let i=0;i<100000;i++){c.step(s,v,0.5,'any',random);if(c.inTriangle(s.x,s.y,...m))inside++;}
  a.equal(inside,0);
  // Without the gap the middle quarter would hold a quarter of the points.
  a.ok(c.inTriangle(0,0,...m));
});
test('the fern picks maps with the right probabilities and stays in its bounds',()=>{
  const random=c.mulberry32(5),counts=[0,0,0,0],s={x:0,y:0,prev:-1},b=c.FERN_BOUNDS,n=200000;
  a.ok(near(c.FERN.reduce((t,f)=>t+f.p,0),1));
  for(let i=0;i<n;i++){counts[c.fernStep(s,random)]++;a.ok(s.x>=b.x0-1e-3&&s.x<=b.x1+1e-3&&s.y>=b.y0-1e-3&&s.y<=b.y1+1e-3);}
  c.FERN.forEach((f,i)=>a.ok(Math.abs(counts[i]/n-f.p)<0.005,f.name));
});
