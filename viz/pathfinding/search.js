(function(root){
  // Cells: 0 open, 1 wall, 2 mud. Entering a cell costs 1, or MUD_COST for mud.
  const OPEN=0,WALL=1,MUD=2,MUD_COST=5;
  const ALGORITHMS=[
    {id:'bfs',name:'BFS',full:'Breadth-first search',weighted:false},
    {id:'dijkstra',name:'Dijkstra',full:'Dijkstra’s algorithm',weighted:true},
    {id:'astar',name:'A*',full:'A* with Manhattan distance',weighted:true},
    {id:'greedy',name:'Greedy',full:'Greedy best-first search',weighted:false},
  ];

  function grid(w,h){return {w,h,cells:new Uint8Array(w*h)};}
  function clone(g){return {w:g.w,h:g.h,cells:g.cells.slice()};}
  function cost(g,i){return g.cells[i]===MUD?MUD_COST:1;}
  function manhattan(g,a,b){return Math.abs(a%g.w-b%g.w)+Math.abs((a/g.w|0)-(b/g.w|0));}
  // Four-way moves in a fixed order (up, right, down, left) so runs are reproducible.
  function neighbors(g,i){
    const x=i%g.w,y=i/g.w|0,out=[];
    if(y>0)out.push(i-g.w);if(x<g.w-1)out.push(i+1);if(y<g.h-1)out.push(i+g.w);if(x>0)out.push(i-1);
    return out.filter(n=>g.cells[n]!==WALL);
  }
  function pathCost(g,path){let c=0;for(let i=1;i<path.length;i++)c+=cost(g,path[i]);return c;}

  // Binary min-heap ordered by a list of keys, compared left to right.
  function heap(){
    const items=[],less=(a,b)=>{for(let k=0;k<a.key.length;k++)if(a.key[k]!==b.key[k])return a.key[k]<b.key[k];return false;};
    return {
      get size(){return items.length;},
      push(node,key){items.push({node,key});let i=items.length-1;while(i){const p=(i-1)>>1;if(!less(items[i],items[p]))break;[items[i],items[p]]=[items[p],items[i]];i=p;}},
      pop(){
        const top=items[0],last=items.pop();
        if(items.length){items[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<items.length&&less(items[l],items[m]))m=l;if(r<items.length&&less(items[r],items[m]))m=r;if(m===i)break;[items[i],items[m]]=[items[m],items[i]];i=m;}}
        return top;
      },
    };
  }

  // Yields one event per expanded node: {node, opened}, where opened lists cells newly added
  // to (or improved in) the frontier. Returns {found, path, steps, cost, explored}.
  function* search(id,g,start,goal){
    const n=g.w*g.h,prev=new Int32Array(n).fill(-1),closed=new Uint8Array(n),best=new Float64Array(n).fill(Infinity);
    const h=i=>manhattan(g,i,goal);
    let explored=0,seq=0,found=false;
    const finish=()=>{
      const path=[];
      if(found)for(let i=goal;i!==-1;i=prev[i])path.push(i);
      path.reverse();
      return {found,path,steps:found?path.length-1:Infinity,cost:found?pathCost(g,path):Infinity,explored};
    };
    if(g.cells[start]===WALL||g.cells[goal]===WALL)return finish();
    if(id==='bfs'){
      const queue=[start];let head=0;closed[start]=1;
      while(head<queue.length){
        const node=queue[head++];explored++;
        if(node===goal){found=true;yield {node,opened:[]};break;}
        const opened=[];
        for(const m of neighbors(g,node))if(!closed[m]){closed[m]=1;prev[m]=node;queue.push(m);opened.push(m);}
        yield {node,opened};
      }
      return finish();
    }
    // Dijkstra orders by cost so far, A* by cost so far plus the Manhattan estimate,
    // greedy by the estimate alone. Ties go to the smaller estimate, then first in.
    const priority={dijkstra:(c,i)=>[c,seq++],astar:(c,i)=>[c+h(i),h(i),seq++],greedy:(c,i)=>[h(i),seq++]}[id];
    if(!priority)throw new Error(`Unknown algorithm: ${id}`);
    const open=heap();best[start]=0;open.push(start,priority(0,start));
    while(open.size){
      const {node}=open.pop();
      if(closed[node])continue;
      closed[node]=1;explored++;
      if(node===goal){found=true;yield {node,opened:[]};break;}
      const opened=[];
      for(const m of neighbors(g,node)){
        if(closed[m])continue;
        // Greedy search keeps the first route it finds to a cell; the others relax edges.
        const c=best[node]+cost(g,m);
        if(id==='greedy'?best[m]!==Infinity:c>=best[m])continue;
        best[m]=c;prev[m]=node;open.push(m,priority(c,m));opened.push(m);
      }
      yield {node,opened};
    }
    return finish();
  }
  function run(id,g,start,goal){
    const it=search(id,g,start,goal),order=[];
    for(;;){const r=it.next();if(r.done)return {...r.value,order};order.push(r.value.node);}
  }

  // Recursive backtracker (iterative, to keep the stack small) on odd coordinates, then
  // knock out a share of the remaining walls so there is more than one route.
  function maze(w,h,random,loops=0){
    const g=grid(w,h);g.cells.fill(WALL);
    const stack=[w+1];g.cells[w+1]=OPEN;
    while(stack.length){
      const c=stack[stack.length-1],x=c%w,y=c/w|0;
      const options=[[0,-2],[2,0],[0,2],[-2,0]].filter(([dx,dy])=>{const X=x+dx,Y=y+dy;return X>0&&Y>0&&X<w-1&&Y<h-1&&g.cells[Y*w+X]===WALL;});
      if(!options.length){stack.pop();continue;}
      const [dx,dy]=options[Math.floor(random()*options.length)];
      g.cells[(y+dy/2)*w+x+dx/2]=OPEN;g.cells[(y+dy)*w+x+dx]=OPEN;stack.push((y+dy)*w+x+dx);
    }
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x;if(g.cells[i]!==WALL||(x+y)%2===0)continue;
      const horizontal=g.cells[i-1]===OPEN&&g.cells[i+1]===OPEN,vertical=g.cells[i-w]===OPEN&&g.cells[i+w]===OPEN;
      if((horizontal||vertical)&&random()<loops)g.cells[i]=OPEN;
    }
    return g;
  }
  // Short straight wall segments dropped at random until they cover `density` of the grid.
  function randomWalls(w,h,random,density){
    const g=grid(w,h);let walls=0;
    for(let tries=0;walls<density*w*h&&tries<10000;tries++){
      const len=2+Math.floor(random()*6),across=random()<0.5;
      let x=Math.floor(random()*w),y=Math.floor(random()*h);
      for(let k=0;k<len&&x<w&&y<h;k++){const i=y*w+x;if(g.cells[i]!==WALL){g.cells[i]=WALL;walls++;}if(across)x++;else y++;}
    }
    return g;
  }
  // Soft round patches of mud on open cells.
  function scatterMud(g,random,patches,radius){
    for(let p=0;p<patches;p++){
      const cx=random()*g.w,cy=random()*g.h,r=radius*(0.6+random()*0.8);
      for(let y=0;y<g.h;y++)for(let x=0;x<g.w;x++){
        const d=Math.hypot(x+0.5-cx,(y+0.5-cy)*1.15)/r,i=y*g.w+x;
        if(d<1&&g.cells[i]===OPEN&&random()<1.25-d*0.6)g.cells[i]=MUD;
      }
    }
    return g;
  }
  function mulberry32(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

  const api={OPEN,WALL,MUD,MUD_COST,ALGORITHMS,grid,clone,cost,manhattan,neighbors,pathCost,search,run,maze,randomWalls,scatterMud,mulberry32};
  if(typeof module!=='undefined')module.exports=api;else root.PathSearch=api;
})(globalThis);
