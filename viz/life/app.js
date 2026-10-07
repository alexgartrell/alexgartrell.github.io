(function(){
  const L=Life,$=id=>document.getElementById(id);
  const board=$('board'),spark=$('spark'),ctx=board.getContext('2d'),sctx=spark.getContext('2d');
  const COLS=64,ROWS=64,RATES=[1,2,4,8,15,30,60],HISTORY=240,FADE=0.9;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const fmt=new Intl.NumberFormat('en-US');

  let g=L.grid(COLS,ROWS),spare=L.grid(COLS,ROWS),glow=new Float32Array(COLS*ROWS);
  let generation=0,born=0,died=0,history=[],peak=0,seen=[],settled=false;
  let playing=false,rate=RATES[4],carry=0,running=false,last=0,dirty=true;
  let colors={},dpr=1,size=0,cell=1,hover=-1,drawing=null,toastTimer=0;

  function readColors(){
    const s=getComputedStyle(document.documentElement),v=n=>s.getPropertyValue(n).trim();
    colors={accent:v('--accent'),out:v('--out'),text:v('--text'),muted:v('--muted'),border:v('--border'),board:v('--board'),bg:v('--bg'),good:v('--good')};
  }
  function alpha(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}

  // Live cells keep full glow; dead ones fade out over FADE seconds, leaving an afterglow trail.
  function decay(dt){
    const fade=reducedMotion.matches?Infinity:dt/FADE;let any=false;
    for(let i=0;i<glow.length;i++){
      if(g.cells[i])glow[i]=1;
      else if(glow[i]>0){glow[i]=Math.max(0,glow[i]-fade);if(glow[i])any=true;}
    }
    return any;
  }

  function draw(){
    const gap=Math.max(0.6*dpr,cell*0.12),r=cell*0.22;
    ctx.fillStyle=colors.board;ctx.fillRect(0,0,size,size);
    if(cell>=6*dpr){
      ctx.strokeStyle=colors.border;ctx.lineWidth=1;ctx.globalAlpha=0.55;ctx.beginPath();
      for(let k=1;k<COLS;k++){const p=Math.round(k*cell)+0.5;ctx.moveTo(p,0);ctx.lineTo(p,size);ctx.moveTo(0,p);ctx.lineTo(size,p);}
      ctx.stroke();ctx.globalAlpha=1;
    }
    const rect=(path,i)=>{
      const x=(i%COLS)*cell+gap/2,y=Math.floor(i/COLS)*cell+gap/2,s=cell-gap;
      if(path.roundRect&&cell>=5*dpr)path.roundRect(x,y,s,s,r);else path.rect(x,y,s,s);
    };
    // Embers are bucketed by brightness so each bucket is a single fill.
    const BUCKETS=6,embers=Array.from({length:BUCKETS},()=>new Path2D()),alive=new Path2D();
    for(let i=0;i<glow.length;i++){
      if(g.cells[i])rect(alive,i);
      else if(glow[i]>0)rect(embers[Math.min(BUCKETS-1,Math.floor(glow[i]*BUCKETS))],i);
    }
    embers.forEach((p,b)=>{ctx.fillStyle=alpha(colors.out,0.62*Math.pow((b+1)/BUCKETS,1.6));ctx.fill(p);});
    ctx.fillStyle=colors.accent;ctx.fill(alive);
    if(hover>=0&&!drawing){
      ctx.strokeStyle=alpha(colors.text,0.45);ctx.lineWidth=Math.max(1,dpr);
      ctx.strokeRect((hover%COLS)*cell+gap/2,Math.floor(hover/COLS)*cell+gap/2,cell-gap,cell-gap);
    }
  }

  function drawSpark(){
    const w=spark.width,h=spark.height,p=6*dpr;
    sctx.clearRect(0,0,w,h);
    if(history.length<2)return;
    const span=Math.min(HISTORY,Math.max(60,history.length))-1,max=Math.max(1,...history),X=i=>p+i/span*(w-2*p),Y=v=>h-p-v/max*(h-2*p);
    sctx.beginPath();history.forEach((v,i)=>i?sctx.lineTo(X(i),Y(v)):sctx.moveTo(X(i),Y(v)));
    sctx.lineJoin='round';sctx.lineWidth=1.75*dpr;sctx.strokeStyle=colors.accent;sctx.stroke();
    sctx.lineTo(X(history.length-1),h-p);sctx.lineTo(X(0),h-p);sctx.closePath();sctx.fillStyle=alpha(colors.accent,0.12);sctx.fill();
    const lx=X(history.length-1),ly=Y(history[history.length-1]);
    sctx.fillStyle=colors.accent;sctx.beginPath();sctx.arc(lx,ly,3*dpr,0,Math.PI*2);sctx.fill();
  }

  function updateReadout(){
    const pop=L.population(g);
    $('generation').textContent=fmt.format(generation);$('population').textContent=fmt.format(pop);
    $('born').textContent=fmt.format(born);$('died').textContent=fmt.format(died);
    $('peak').textContent=peak?`· peak ${fmt.format(peak)}`:'';
  }

  function record(pop){history.push(pop);if(history.length>HISTORY)history.shift();peak=Math.max(peak,pop);}
  // Remembers recent states; a repeat means the pattern has become a still life or an oscillator.
  function checkSettled(){
    if(settled)return;
    const h=L.hash(g),pop=L.population(g);
    if(!pop){settled=true;toast(`Everything died at generation ${fmt.format(generation)}.`);setPlaying(false);return;}
    const hit=seen.find(s=>s.h===h&&s.pop===pop);
    if(hit){
      const period=generation-hit.gen;settled=true;
      if(period===1){toast(`Settled into still lifes at generation ${fmt.format(generation-1)}.`);setPlaying(false);}
      else toast(`Repeating every ${period} generations since generation ${fmt.format(hit.gen)}.`);
      return;
    }
    seen.push({h,pop,gen:generation});if(seen.length>64)seen.shift();
  }
  function advance(){
    const next=L.step(g,$('wrap').checked,spare);spare=g;g=next;
    generation++;born=g.born;died=g.died;record(g.population);checkSettled();dirty=true;
  }
  function edited(){seen=[];settled=false;born=died=0;history.length&&(history[history.length-1]=L.population(g));dirty=true;kick();}

  function frame(now){
    const dt=Math.min(0.1,(now-last)/1000);last=now;
    if(playing){carry+=rate*dt;let n=Math.min(4,Math.floor(carry));carry-=Math.floor(carry);while(n-->0&&playing)advance();}
    const glowing=decay(dt);
    draw();
    if(dirty){updateReadout();drawSpark();dirty=false;}
    if(playing||glowing||drawing)requestAnimationFrame(frame);else running=false;
  }
  function kick(){if(!running){running=true;last=performance.now();requestAnimationFrame(frame);}}

  function setPlaying(on){
    playing=on;carry=on?1:0;const b=$('play');b.setAttribute('aria-pressed',String(on));
    b.querySelector('.icon').textContent=on?'❚❚':'▶';b.querySelector('.text').textContent=on?'Pause':'Play';kick();
  }
  function restart(){generation=0;born=died=0;history=[];peak=0;record(L.population(g));seen=[];settled=false;dirty=true;kick();}
  function clear(){g.cells.fill(0);restart();}
  function load(name){g.cells.fill(0);L.center(g,L.PATTERNS[name]);restart();}
  function randomize(){L.randomFill(g,0.28,Math.random);restart();}
  function step(){setPlaying(false);advance();kick();}

  function toast(text){
    const t=$('toast');t.textContent=text;t.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2800);
  }

  function cellAt(e){
    const b=board.getBoundingClientRect(),x=Math.floor((e.clientX-b.left)/b.width*COLS),y=Math.floor((e.clientY-b.top)/b.height*ROWS);
    return x>=0&&x<COLS&&y>=0&&y<ROWS?[x,y]:null;
  }
  // Paints every cell on the straight line between two cells so fast drags leave no gaps.
  function paintLine([x0,y0],[x1,y1],value){
    const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));
    for(let k=0;k<=n;k++){const t=n?k/n:0;g.cells[Math.round(y0+(y1-y0)*t)*COLS+Math.round(x0+(x1-x0)*t)]=value;}
    edited();
  }
  board.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    const c=cellAt(e);if(!c)return;
    e.preventDefault();try{board.setPointerCapture(e.pointerId);}catch(err){}
    drawing={value:g.cells[c[1]*COLS+c[0]]?0:1,last:c};paintLine(c,c,drawing.value);
  });
  board.addEventListener('pointermove',e=>{
    const c=cellAt(e);
    if(drawing){if(c){paintLine(drawing.last,c,drawing.value);drawing.last=c;}return;}
    const h=c&&e.pointerType==='mouse'?c[1]*COLS+c[0]:-1;
    if(h!==hover){hover=h;dirty=true;kick();}
  });
  const stopDrawing=()=>{drawing=null;kick();};
  board.addEventListener('pointerup',stopDrawing);board.addEventListener('pointercancel',stopDrawing);
  board.addEventListener('pointerleave',()=>{if(hover>=0){hover=-1;kick();}});

  function resize(){
    dpr=Math.min(2,window.devicePixelRatio||1);
    const b=board.getBoundingClientRect(),s=spark.getBoundingClientRect();
    const next=Math.round(b.width*dpr);
    if(next&&next!==size){size=board.width=board.height=next;cell=size/COLS;}
    spark.width=Math.round(s.width*dpr);spark.height=Math.round(s.height*dpr);
    dirty=true;kick();
  }
  function setRate(){rate=RATES[$('speed').value];$('speed-label').textContent=`${rate} gen / s`;}

  $('play').onclick=()=>setPlaying(!playing);
  $('step').onclick=step;$('clear').onclick=clear;$('random').onclick=randomize;
  $('wrap').addEventListener('change',()=>{seen=[];settled=false;});
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>load(b.dataset.preset));
  $('speed').addEventListener('input',setRate);
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.target.matches('input,button,select,textarea'))return;
    const k=e.key.toLowerCase();
    if(k===' '){e.preventDefault();setPlaying(!playing);}
    else if(k==='s'||k==='arrowright')step();
    else if(k==='r')randomize();
    else if(k==='c')clear();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{readColors();dirty=true;kick();});
  new ResizeObserver(resize).observe(document.querySelector('.board-frame'));
  new ResizeObserver(resize).observe(spark);
  readColors();setRate();
  L.place(g,L.PATTERNS.gun,4,5);restart();resize();
  if(!reducedMotion.matches)setPlaying(true);
})();
