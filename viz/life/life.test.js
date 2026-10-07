const {test}=require('node:test'),a=require('node:assert/strict'),L=require('./life');
const live=g=>{const out=[];for(let y=0;y<g.h;y++)for(let x=0;x<g.w;x++)if(g.cells[y*g.w+x])out.push(`${x},${y}`);return out;};
const run=(g,n,wrap=false)=>{for(let i=0;i<n;i++)g=L.step(g,wrap);return g;};
const at=(w,h,name,x,y)=>L.place(L.grid(w,h),L.PATTERNS[name],x,y);

test('a blinker flips between horizontal and vertical with period 2',()=>{
  const g=L.place(L.grid(5,5),L.parse('OOO'),1,2),one=L.step(g,false),two=L.step(one,false);
  a.deepEqual(live(one),['2,1','2,2','2,3']);a.ok(L.equal(two,g));a.equal(L.equal(one,g),false);
  a.equal(one.born,2);a.equal(one.died,2);a.equal(one.population,3);
});
test('a block is a still life',()=>{
  const g=L.place(L.grid(4,4),L.parse('OO\nOO'),1,1),next=L.step(g,false);
  a.ok(L.equal(next,g));a.equal(next.born,0);a.equal(next.died,0);a.equal(L.hash(next),L.hash(g));
});
test('a glider moves one cell diagonally every four generations',()=>{
  const g=at(12,12,'glider',2,2),moved=at(12,12,'glider',3,3);
  a.ok(L.equal(run(g,4),moved));a.ok(L.equal(run(g,8),at(12,12,'glider',4,4)));
  a.equal(L.population(run(g,3)),5);
});
test('a lightweight spaceship moves two cells every four generations',()=>{
  a.ok(L.equal(run(at(16,10,'lwss',8,3),4),at(16,10,'lwss',6,3)));
});
test('a pulsar oscillates with period 3',()=>{
  const g=at(17,17,'pulsar',2,2);
  a.equal(L.equal(run(g,1),g),false);a.ok(L.equal(run(g,3),g));a.equal(L.population(g),48);
});
test('with wrap-around a glider returns to its start after crossing the whole torus',()=>{
  const g=at(8,8,'glider',0,0);a.ok(L.equal(run(g,32,true),g));
  a.equal(L.population(run(g,40,false)),4,'without wrap it crashes into the corner and leaves a block');
});
test('wrap decides whether cells on opposite edges are neighbours',()=>{
  const g=L.grid(6,5);g.cells[2*6+5]=g.cells[2*6+0]=g.cells[2*6+1]=1;
  a.equal(L.neighbours(g,0,2,true),2);a.equal(L.neighbours(g,0,2,false),1);
  a.equal(L.population(L.step(g,false)),0);
  const w=L.step(g,true);a.deepEqual(live(w),['0,1','0,2','0,3']);
});
test('the Gosper gun fires a new glider every 30 generations',()=>{
  const g=at(60,40,'gun',1,1);
  a.equal(L.population(g),36);a.equal(L.population(run(g,30)),41);a.equal(L.population(run(g,60)),46);
});
test('the R-pentomino and acorn are tiny but keep changing',()=>{
  for(const name of ['rpentomino','acorn']){const g=at(40,40,name,18,18),later=run(g,20);a.ok(L.population(later)>L.population(g));}
  a.equal(L.PATTERNS.acorn.cells.length,7);a.equal(L.PATTERNS.rpentomino.cells.length,5);
});
test('random fill is reproducible and roughly matches the density',()=>{
  const g1=L.randomFill(L.grid(100,100),0.3,L.mulberry32(5)),g2=L.randomFill(L.grid(100,100),0.3,L.mulberry32(5));
  a.ok(L.equal(g1,g2));a.ok(Math.abs(L.population(g1)/1e4-0.3)<0.03);
});
