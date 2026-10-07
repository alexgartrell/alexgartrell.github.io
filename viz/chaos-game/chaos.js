(function(root){
  // Regular k-gon, first vertex at the top (turned by `turn` radians), centered and scaled to fill [-0.98, 0.98]².
  function polygon(k,turn=0){
    const v=[];for(let i=0;i<k;i++){const a=Math.PI/2+turn+2*Math.PI*i/k;v.push([Math.cos(a),Math.sin(a)]);}
    const ys=v.map(p=>p[1]),mid=(Math.max(...ys)+Math.min(...ys))/2;
    const fit=0.98/Math.max(...v.map(([x,y])=>Math.max(Math.abs(x),Math.abs(y-mid))));
    return v.map(([x,y])=>[x*fit,(y-mid)*fit]);
  }
  // The jump ratio at which the k copies of the polygon just touch (the "kissing" ratio):
  // r = 1 − 1 / (2 (1 + Σ_{j=1}^{⌊k/4⌋} cos(2πj/k))). Gives 1/2 for a triangle, 0.618 for a pentagon.
  function optimalRatio(k){let s=0;for(let j=1;j<=Math.floor(k/4);j++)s+=Math.cos(2*Math.PI*j/k);return 1-1/(2*(1+s));}

  // Rules restrict which vertex may follow the previous one.
  const RULES={
    any:{name:'Any vertex',allowed:()=>true},
    'no-repeat':{name:'Never the same vertex twice',allowed:(i,prev)=>i!==prev},
    'no-neighbor':{name:'Not a neighbor of the last vertex',allowed:(i,prev,k)=>prev<0||(i!==(prev+1)%k&&i!==(prev+k-1)%k)},
  };
  function allowedVertices(k,prev,rule){const ok=[];for(let i=0;i<k;i++)if(RULES[rule].allowed(i,prev,k))ok.push(i);return ok;}
  function chooseVertex(k,prev,rule,random){
    if(rule==='any'||prev<0&&rule!=='no-neighbor')return Math.floor(random()*k);
    const ok=allowedVertices(k,prev,rule);return ok[Math.floor(random()*ok.length)];
  }
  // One move of the chaos game: pick a vertex, jump a fraction r of the way toward it.
  function step(state,vertices,r,rule,random){
    const i=chooseVertex(vertices.length,state.prev,rule,random),v=vertices[i];
    state.x+=r*(v[0]-state.x);state.y+=r*(v[1]-state.y);state.prev=i;return i;
  }
  function start(random){return {x:random()*1.6-0.8,y:random()*1.6-0.8,prev:-1};}

  // Barnsley fern: four affine maps [a, b, c, d, e, f] applied as (x, y) → (ax + by + e, cx + dy + f).
  const FERN=[
    {name:'Stem',p:0.01,m:[0,0,0,0.16,0,0]},
    {name:'Smaller leaflets',p:0.85,m:[0.85,0.04,-0.04,0.85,0,1.6]},
    {name:'Left leaflet',p:0.07,m:[0.2,-0.26,0.23,0.22,0,1.6]},
    {name:'Right leaflet',p:0.07,m:[-0.15,0.28,0.26,0.24,0,0.44]},
  ];
  const FERN_BOUNDS={x0:-2.1820,x1:2.6558,y0:0,y1:9.9983};
  function fernMap(random){let u=random(),i=0;while(i<FERN.length-1&&u>=FERN[i].p){u-=FERN[i].p;i++;}return i;}
  function fernStep(state,random){
    const i=fernMap(random),[a,b,c,d,e,f]=FERN[i].m,x=state.x,y=state.y;
    state.x=a*x+b*y+e;state.y=c*x+d*y+f;state.prev=i;return i;
  }

  const PRESETS={
    triangle:{name:'Triangle',k:3,r:0.5,rule:'any'},
    square:{name:'Square',k:4,turn:Math.PI/4,r:0.5,rule:'no-repeat'},
    pentagon:{name:'Pentagon',k:5,r:optimalRatio(5),rule:'any'},
    hexagon:{name:'Hexagon',k:6,r:optimalRatio(6),rule:'any'},
    fern:{name:'Barnsley fern',fern:true},
  };

  // Barycentric test: is (x, y) strictly inside triangle abc?
  function inTriangle(x,y,a,b,c){
    const d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
    const l1=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/d,l2=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/d;
    return l1>0&&l2>0&&1-l1-l2>0;
  }
  // Small seeded generator so runs can be reproduced in tests.
  function mulberry32(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  const api={polygon,optimalRatio,RULES,allowedVertices,chooseVertex,step,start,FERN,FERN_BOUNDS,fernMap,fernStep,PRESETS,inTriangle,mulberry32};
  if(typeof module!=='undefined')module.exports=api;else root.ChaosGame=api;
})(globalThis);
