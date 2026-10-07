const {test}=require('node:test'),a=require('node:assert/strict'),s=require('./search');

// Reference answer by repeated edge relaxation (slow but obviously correct).
function reference(g,start,goal,weighted){
  const d=new Array(g.w*g.h).fill(Infinity);d[start]=0;
  for(let changed=true;changed;){changed=false;for(let i=0;i<d.length;i++)if(d[i]<Infinity)for(const m of s.neighbors(g,i)){const c=d[i]+(weighted?s.cost(g,m):1);if(c<d[m]){d[m]=c;changed=true;}}}
  return d[goal];
}
function parse(rows){
  const g=s.grid(rows[0].length,rows.length);let start=-1,goal=-1;
  rows.join('').split('').forEach((ch,i)=>{if(ch==='#')g.cells[i]=s.WALL;else if(ch==='~')g.cells[i]=s.MUD;else if(ch==='S')start=i;else if(ch==='G')goal=i;});
  return {g,start,goal};
}
function assertValidPath(g,r,start,goal){
  a.equal(r.path[0],start);a.equal(r.path.at(-1),goal);a.equal(r.steps,r.path.length-1);a.equal(r.cost,s.pathCost(g,r.path));
  for(let i=1;i<r.path.length;i++){a.equal(s.manhattan(g,r.path[i-1],r.path[i]),1);a.notEqual(g.cells[r.path[i]],s.WALL);}
}
const IDS=s.ALGORITHMS.map(x=>x.id);

test('BFS, Dijkstra and A* find shortest paths on random grids with mud; greedy does not always',()=>{
  const random=s.mulberry32(3);let checked=0,greedyWorse=0;
  for(let trial=0;trial<60;trial++){
    const g=s.scatterMud(s.randomWalls(15,11,random,0.25),random,2,3),start=0,goal=g.w*g.h-1;
    g.cells[start]=g.cells[goal]=s.OPEN;
    const weighted=reference(g,start,goal,true),steps=reference(g,start,goal,false);
    for(const id of IDS){
      const r=s.run(id,g,start,goal);
      a.equal(r.found,weighted<Infinity);
      if(!r.found)continue;
      assertValidPath(g,r,start,goal);
      if(id==='bfs')a.equal(r.steps,steps);
      else if(id==='greedy'){a.ok(r.cost>=weighted);if(r.cost>weighted)greedyWorse++;}
      else a.equal(r.cost,weighted);
      a.ok(r.explored>=1&&r.explored===r.order.length);
    }
    if(weighted<Infinity)checked++;
  }
  a.ok(checked>20);a.ok(greedyWorse>0,'greedy should sometimes miss the best path');
});

test('when the goal is walled off every algorithm reports no path',()=>{
  const {g,start,goal}=parse(['S..#...','...#...','...#..G']);
  for(const id of IDS){
    const r=s.run(id,g,start,goal);
    a.equal(r.found,false);a.deepEqual(r.path,[]);a.equal(r.cost,Infinity);a.equal(r.explored,9);
  }
});

test('mud makes BFS take the short expensive route while Dijkstra and A* go around',()=>{
  const {g,start,goal}=parse(['.......','S~~~~~G','.......']);
  const bfs=s.run('bfs',g,start,goal),dij=s.run('dijkstra',g,start,goal),astar=s.run('astar',g,start,goal);
  a.equal(bfs.steps,6);a.equal(bfs.cost,5*5+1);
  a.equal(dij.cost,8);a.equal(dij.steps,8);a.equal(astar.cost,8);
  a.ok(astar.explored<=dij.explored);
});

test('A* explores far fewer cells than Dijkstra on an open grid',()=>{
  const open=s.grid(21,21),start=10*21+2,goal=10*21+18;
  const d=s.run('dijkstra',open,start,goal),h=s.run('astar',open,start,goal);
  a.equal(d.cost,16);a.equal(h.cost,16);a.ok(h.explored*4<d.explored);
});

test('the start counts as explored and a start equal to the goal is a zero-length path',()=>{
  const g=s.grid(3,3);
  for(const id of IDS){const r=s.run(id,g,4,4);a.equal(r.found,true);a.deepEqual(r.path,[4]);a.equal(r.cost,0);a.equal(r.explored,1);}
  a.throws(()=>s.run('dfs',g,0,8));
});

test('generated mazes connect every open cell, and loops add extra routes',()=>{
  const g=s.maze(31,21,s.mulberry32(9));
  let open=0;for(let i=0;i<g.cells.length;i++)if(g.cells[i]!==s.WALL)open++;
  a.equal(open,15*10*2-1); // A perfect maze: 150 rooms joined by 149 passages.
  const reached=s.run('bfs',g,32,-1).explored;a.equal(reached,open);
  const loopy=s.maze(31,21,s.mulberry32(9),0.2);
  let open2=0;for(let i=0;i<loopy.cells.length;i++)if(loopy.cells[i]!==s.WALL)open2++;
  a.ok(open2>open);
  for(let x=0;x<31;x++){a.equal(g.cells[x],s.WALL);a.equal(g.cells[20*31+x],s.WALL);}
});
