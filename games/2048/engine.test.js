const {test}=require('node:test'),a=require('node:assert/strict'),g=require('./engine');
test('a tile merges only once per move',()=>{a.deepEqual(g.merge([2,2,2,2]),{line:[4,4,0,0],score:8});a.deepEqual(g.merge([2,2,4,0]),{line:[4,4,0,0],score:4});});
test('all four directions preserve orientation and score',()=>{for(const dir of ['left','right','up','down']){const s={cells:Array(16).fill(2),score:0};a.ok(g.move(s,dir));a.equal(s.score,32);a.equal(s.cells.filter(v=>v===4).length,8);a.equal(s.cells.reduce((x,y)=>x+y),32);}});
test('no-op move neither scores nor changes cells',()=>{const s={cells:[2,0,0,0,...Array(12).fill(0)],score:0};a.equal(g.move(s,'left'),false);a.equal(s.cells.filter(Boolean).length,1);});
test('loss requires a full board without adjacent equal tiles',()=>{const s={cells:[2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2],score:0};a.ok(g.over(s));s.cells[0]=4;a.equal(g.over(s),false);a.ok(g.valid(g.fresh()));});
test('animation paths bring both merging tiles to the same destination',()=>{
  const s={cells:[2,2,4,4,...Array(12).fill(0)],score:0},motions=[];
  g.move(s,'left',motions);
  a.deepEqual(motions,[{from:0,to:0},{from:1,to:0},{from:2,to:1},{from:3,to:1}]);
  a.deepEqual(s.cells.slice(0,4),[4,8,0,0]);
});
test('animation paths match final tile values in every direction',()=>{
  for(const dir of ['left','right','up','down']){
    const before=[2,0,2,4,0,4,4,0,2,0,2,4,2,4,0,4];
    const s={cells:[...before],score:0},motions=[];
    g.move(s,dir,motions);
    a.equal(motions.length,before.filter(Boolean).length);
    a.equal(new Set(motions.map(m=>m.from)).size,motions.length);
    const arrivals=Array(16).fill(0);
    motions.forEach(({from,to})=>{arrivals[to]+=before[from];});
    a.deepEqual(arrivals,s.cells);
  }
});
