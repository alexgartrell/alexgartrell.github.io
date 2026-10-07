(function(root){
  // Conway's rules, B3/S23: a dead cell with exactly 3 live neighbours is born,
  // a live cell with 2 or 3 live neighbours survives, and every other cell is dead next generation.
  function grid(w,h){return {w,h,cells:new Uint8Array(w*h)};}
  function get(g,x,y,wrap){
    if(x<0||x>=g.w||y<0||y>=g.h){if(!wrap)return 0;x=(x%g.w+g.w)%g.w;y=(y%g.h+g.h)%g.h;}
    return g.cells[y*g.w+x];
  }
  function neighbours(g,x,y,wrap){
    let n=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)n+=get(g,x+dx,y+dy,wrap);
    return n;
  }
  // Writes the next generation into `out` (reused when it has the same shape) and returns it with birth and death counts.
  function step(g,wrap,out){
    const {w,h,cells}=g,o=out&&out!==g&&out.w===w&&out.h===h?out:grid(w,h),next=o.cells;
    let born=0,died=0,pop=0;
    for(let y=0;y<h;y++){
      const edgeY=y===0||y===h-1;
      for(let x=0;x<w;x++){
        const i=y*w+x;let n;
        if(edgeY||x===0||x===w-1)n=neighbours(g,x,y,wrap);
        else{const a=i-w,b=i+w;n=cells[a-1]+cells[a]+cells[a+1]+cells[i-1]+cells[i+1]+cells[b-1]+cells[b]+cells[b+1];}
        const alive=cells[i],v=n===3||(alive&&n===2)?1:0;
        next[i]=v;pop+=v;if(v&&!alive)born++;else if(!v&&alive)died++;
      }
    }
    o.born=born;o.died=died;o.population=pop;
    return o;
  }
  function population(g){let n=0;for(const c of g.cells)n+=c;return n;}
  // Patterns are plain text: 'O' for a live cell, anything else for a dead one.
  function parse(text){
    const rows=text.trim().split('\n').map(r=>r.trim()),cells=[];
    rows.forEach((r,y)=>{for(let x=0;x<r.length;x++)if(r[x]==='O')cells.push([x,y]);});
    return {w:Math.max(...rows.map(r=>r.length)),h:rows.length,cells};
  }
  // Stamps a pattern with its top-left corner at (x, y), wrapping around the edges.
  function place(g,pattern,x,y){
    for(const [px,py] of pattern.cells){const X=((x+px)%g.w+g.w)%g.w,Y=((y+py)%g.h+g.h)%g.h;g.cells[Y*g.w+X]=1;}
    return g;
  }
  function center(g,pattern){return place(g,pattern,Math.floor((g.w-pattern.w)/2),Math.floor((g.h-pattern.h)/2));}
  function randomFill(g,density,random){for(let i=0;i<g.cells.length;i++)g.cells[i]=random()<density?1:0;return g;}
  // FNV-1a over the live cell indices; equal grids hash equally, so repeats reveal still lifes and oscillators.
  function hash(g){
    let h=0x811c9dc5;
    for(let i=0;i<g.cells.length;i++)if(g.cells[i]){h^=i&0xffff;h=Math.imul(h,16777619);h^=i>>>16;h=Math.imul(h,16777619);}
    return h>>>0;
  }
  function equal(a,b){if(a.w!==b.w||a.h!==b.h)return false;for(let i=0;i<a.cells.length;i++)if(a.cells[i]!==b.cells[i])return false;return true;}
  function mulberry32(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

  const PATTERNS={
    glider:{name:'Glider',text:`
.O.
..O
OOO`},
    lwss:{name:'LWSS',text:`
.O..O
O....
O...O
OOOO.`},
    pulsar:{name:'Pulsar',text:`
..OOO...OOO..
.............
O....O.O....O
O....O.O....O
O....O.O....O
..OOO...OOO..
.............
..OOO...OOO..
O....O.O....O
O....O.O....O
O....O.O....O
.............
..OOO...OOO..`},
    gun:{name:'Glider gun',text:`
........................O...........
......................O.O...........
............OO......OO............OO
...........O...O....OO............OO
OO........O.....O...OO..............
OO........O...O.OO....O.O...........
..........O.....O.......O...........
...........O...O....................
............OO......................`},
    rpentomino:{name:'R-pentomino',text:`
.OO
OO.
.O.`},
    acorn:{name:'Acorn',text:`
.O.....
...O...
OO..OOO`},
  };
  for(const k in PATTERNS)Object.assign(PATTERNS[k],parse(PATTERNS[k].text));

  const api={grid,get,neighbours,step,population,parse,place,center,randomFill,hash,equal,mulberry32,PATTERNS};
  if(typeof module!=='undefined')module.exports=api;else root.Life=api;
})(globalThis);
