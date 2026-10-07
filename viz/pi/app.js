(function(){
  const P=PiEstimator,$=id=>document.getElementById(id);
  const board=$('board'),chart=$('chart'),hint=$('board-hint'),bctx=board.getContext('2d'),cctx=chart.getContext('2d');
  const RATES=[1,3,10,30,100,300,1000,3000,10000,30000,100000];
  const STORE_CAP=250000,FRAME_CAP=60000,CIRCLE_LIMIT=20000;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const fmt=new Intl.NumberFormat('en-US'),compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});

  let tally=P.tally(),stored=0,xs=new Float32Array(STORE_CAP),ys=new Float32Array(STORE_CAP);
  let samples=[],nextSample=1,bestDecimals=0;
  let playing=false,rate=RATES[3],carry=0,pending=0,ripples=[],running=false,last=0;
  let colors={},dpr=1,size=0,layer=document.createElement('canvas'),lctx=layer.getContext('2d');
  let view={x:2,y:1.2},dirty=true,toastTimer=0;

  // Board geometry: the square [-1, 1]² fills the canvas with a small margin.
  const pad=()=>size*0.035,side=()=>size-2*pad();
  const toPx=v=>pad()+(v+1)/2*side(),toPy=v=>pad()+(1-v)/2*side();
  // Early darts are large and satisfying; later ones shrink so density reads clearly.
  const radius=i=>side()*Math.max(0.0016,0.0105/Math.pow(1+i/300,0.4));

  function readColors(){
    const s=getComputedStyle(document.documentElement),v=n=>s.getPropertyValue(n).trim();
    colors={in:v('--in'),out:v('--out'),text:v('--text'),muted:v('--muted'),border:v('--border'),surface:v('--surface'),board:v('--board'),bg:v('--bg'),accent:v('--accent'),good:v('--good')};
  }
  function alpha(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}

  function paintBase(ctx){
    const p=pad(),l=side(),c=size/2;
    ctx.clearRect(0,0,size,size);
    ctx.fillStyle=colors.board;ctx.fillRect(p,p,l,l);
    ctx.fillStyle=alpha(colors.out,0.07);ctx.fillRect(p,p,l,l);
    ctx.fillStyle=colors.board;ctx.beginPath();ctx.arc(c,c,l/2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=alpha(colors.in,0.07);ctx.fill();
  }
  // Draws darts [from, to) using either the stored history or the scratch arrays.
  function paintDarts(ctx,from,to,px,py){
    ctx.save();ctx.beginPath();ctx.rect(pad(),pad(),side(),side());ctx.clip();
    for(const hit of [true,false]){
      ctx.fillStyle=alpha(hit?colors.in:colors.out,from<CIRCLE_LIMIT?0.78:0.35);
      let path=null;
      for(let i=from;i<to;i++){
        const x=px[i-from],y=py[i-from];
        if(P.inside(x,y)!==hit)continue;
        const r=radius(i),X=toPx(x),Y=toPy(y);
        if(i<CIRCLE_LIMIT){path??=new Path2D();path.moveTo(X+r,Y);path.arc(X,Y,r,0,Math.PI*2);}
        else ctx.fillRect(X-r,Y-r,2*r,2*r);
      }
      if(path)ctx.fill(path);
    }
    ctx.restore();
  }
  function rebuildLayer(){
    const old=layer;layer=document.createElement('canvas');layer.width=layer.height=size;lctx=layer.getContext('2d');
    paintBase(lctx);
    if(stored===tally.total)paintDarts(lctx,0,stored,xs,ys);
    else if(old.width)lctx.drawImage(old,0,0,size,size);
  }

  const scratchX=new Float32Array(FRAME_CAP),scratchY=new Float32Array(FRAME_CAP);
  function throwDarts(n,now){
    for(let start=0;start<n;start+=FRAME_CAP){
      const count=Math.min(FRAME_CAP,n-start),first=tally.total;
      for(let k=0;k<count;k++){
        const x=Math.random()*2-1,y=Math.random()*2-1;
        scratchX[k]=x;scratchY[k]=y;P.add(tally,x,y);
        if(stored<STORE_CAP&&stored===first+k){xs[stored]=x;ys[stored]=y;stored++;}
        if(tally.total>=nextSample){samples.push([tally.total,P.estimate(tally)]);nextSample=Math.max(tally.total+1,Math.ceil(tally.total*1.01));}
      }
      paintDarts(lctx,first,first+count,scratchX,scratchY);
      if(count<=3&&!reducedMotion.matches)for(let k=0;k<count;k++){ripples.push({x:scratchX[k],y:scratchY[k],hit:P.inside(scratchX[k],scratchY[k]),t:now,r:radius(first+k)});}
    }
    if(ripples.length>40)ripples.splice(0,ripples.length-40);
    hint.classList.add('gone');dirty=true;
  }

  function drawBoard(now){
    const p=pad(),l=side(),c=size/2;
    bctx.clearRect(0,0,size,size);bctx.drawImage(layer,0,0);
    bctx.lineWidth=Math.max(1,size/400);
    bctx.strokeStyle=colors.muted;bctx.globalAlpha=0.55;bctx.strokeRect(p,p,l,l);
    bctx.globalAlpha=0.9;bctx.strokeStyle=colors.text;bctx.beginPath();bctx.arc(c,c,l/2,0,Math.PI*2);bctx.stroke();bctx.globalAlpha=1;
    ripples=ripples.filter(r=>now-r.t<650);
    for(const r of ripples){
      const t=(now-r.t)/650,e=1-Math.pow(1-t,3);
      bctx.strokeStyle=alpha(r.hit?colors.in:colors.out,0.9*(1-t));bctx.lineWidth=Math.max(1.5,size/350)*(1-t*0.5);
      bctx.beginPath();bctx.arc(toPx(r.x),toPy(r.y),r.r*(1.2+e*5),0,Math.PI*2);bctx.stroke();
    }
  }

  function niceStep(span){const raw=span/4,pow=10**Math.floor(Math.log10(raw)),f=raw/pow;return (f<1.5?1:f<3.5?2:f<7.5?5:10)*pow;}
  function chartTarget(){
    const total=tally.total,x=Math.max(2,Math.log10(Math.max(1,total)));
    const floor=total/30;let dev=0;
    for(let i=samples.length-1;i>=0&&samples[i][0]>=floor;i--)dev=Math.max(dev,Math.abs(samples[i][1]-Math.PI));
    const y=Math.min(1.2,Math.max(0.0015,1.25*Math.max(dev,1.96*P.standardError(Math.max(1,floor)))));
    return {x,y};
  }
  function drawChart(){
    const w=chart.width,h=chart.height,s=dpr,L=48*s,R=14*s,T=10*s,B=24*s,pw=w-L-R,ph=h-T-B;
    const X=n=>L+Math.log10(n)/view.x*pw,Y=v=>T+ph/2-(v-Math.PI)/view.y*(ph/2);
    cctx.clearRect(0,0,w,h);cctx.font=`${11*s}px ui-monospace, SFMono-Regular, Menlo, monospace`;cctx.lineWidth=s;
    // Gridlines and labels.
    const step=niceStep(2*view.y),dec=Math.max(0,-Math.floor(Math.log10(step)+1e-9));
    cctx.textAlign='right';cctx.textBaseline='middle';
    for(let v=Math.ceil((Math.PI-view.y)/step)*step;v<=Math.PI+view.y;v+=step){
      const y=Y(v);cctx.strokeStyle=colors.border;cctx.beginPath();cctx.moveTo(L,y);cctx.lineTo(w-R,y);cctx.stroke();
      cctx.fillStyle=colors.muted;cctx.fillText(v.toFixed(dec),L-6*s,y);
    }
    cctx.textAlign='center';cctx.textBaseline='top';
    for(let k=0;k<=Math.floor(view.x);k++){
      const x=X(10**k);cctx.strokeStyle=colors.border;cctx.beginPath();cctx.moveTo(x,T);cctx.lineTo(x,T+ph);cctx.stroke();
      cctx.fillStyle=colors.muted;cctx.fillText(k<3?String(10**k):compact.format(10**k),x,T+ph+6*s);
    }
    cctx.save();cctx.beginPath();cctx.rect(L,T,pw,ph);cctx.clip();
    // 95% band: π ± 1.96 standard errors.
    const steps=80,top=[],bottom=[];
    for(let i=0;i<=steps;i++){const n=10**(view.x*i/steps),e=1.96*P.standardError(n);top.push([X(n),Y(Math.PI+e)]);bottom.push([X(n),Y(Math.PI-e)]);}
    cctx.beginPath();top.forEach(([x,y],i)=>i?cctx.lineTo(x,y):cctx.moveTo(x,y));bottom.reverse().forEach(([x,y])=>cctx.lineTo(x,y));cctx.closePath();
    cctx.fillStyle=alpha(colors.accent,0.1);cctx.fill();
    cctx.setLineDash([5*s,4*s]);cctx.strokeStyle=colors.good;cctx.lineWidth=1.5*s;cctx.beginPath();cctx.moveTo(L,Y(Math.PI));cctx.lineTo(w-R,Y(Math.PI));cctx.stroke();cctx.setLineDash([]);
    if(samples.length){
      cctx.strokeStyle=colors.accent;cctx.lineWidth=2*s;cctx.lineJoin='round';cctx.beginPath();
      samples.forEach(([n,v],i)=>i?cctx.lineTo(X(n),Y(v)):cctx.moveTo(X(n),Y(v)));
      const end=[X(tally.total),Y(P.estimate(tally))];cctx.lineTo(...end);cctx.stroke();
      cctx.fillStyle=colors.accent;cctx.beginPath();cctx.arc(...end,4*s,0,Math.PI*2);cctx.fill();
      cctx.strokeStyle=colors.surface;cctx.lineWidth=2*s;cctx.stroke();
    }
    cctx.restore();
    cctx.fillStyle=colors.good;cctx.textAlign='right';cctx.textBaseline='bottom';cctx.fillText('π',w-R-4*s,Y(Math.PI)-3*s);
  }

  function updateReadout(){
    const t=tally,est=P.estimate(t),out=P.outside(t);
    $('total').textContent=fmt.format(t.total);$('inside').textContent=fmt.format(t.inside);$('outside').textContent=fmt.format(out);
    const el=$('estimate');
    if(!t.total){el.textContent='–.––––––';$('accuracy').textContent='No darts yet.';$('formula').textContent='π ≈ 4 × (1 − outside ÷ darts)';return;}
    const text=est.toFixed(6),md=P.matchingDecimals(est),okLen=md?2+Math.min(md,6):0;
    el.innerHTML=`<span class="ok">${text.slice(0,okLen)}</span>${text.slice(okLen)}`;
    const err=Math.abs(est-Math.PI);
    $('accuracy').textContent=`${md?`${md} correct decimal${md>1?'s':''} · `:''}off by ${err.toPrecision(2)} (${(err/Math.PI*100).toPrecision(2)}%) · typical ±${P.standardError(t.total).toPrecision(2)}`;
    $('formula').innerHTML=`π ≈ 4 × (1 − <b class="o">${fmt.format(out)}</b> ÷ <b>${fmt.format(t.total)}</b>) = 4 × ${(1-out/t.total).toFixed(5)} = <b class="r">${est.toFixed(5)}</b>`;
    if(md>bestDecimals){bestDecimals=md;celebrate(md);}
  }
  const MILESTONES=['','3.1 — first decimal locked in','3.14 — that’s a respectable pie','3.141 — three decimals!','3.1415 — four decimals. Patience pays.','3.14159 — five decimals. That’s luck.','Six or more decimals. Buy a lottery ticket.'];
  function celebrate(md){
    const toast=$('toast'),el=$('estimate');
    toast.textContent=MILESTONES[Math.min(md,6)];toast.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2600);
    el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');
  }

  function frame(now){
    const dt=Math.min(0.1,(now-last)/1000);last=now;
    let n=0;
    if(playing){carry+=rate*dt;n=Math.floor(carry);carry-=n;}
    if(pending){const take=Math.min(pending,Math.max(2000,Math.ceil(pending/12)),FRAME_CAP);pending-=take;n+=take;}
    if(n)throwDarts(n,now);
    drawBoard(now);
    const target=chartTarget(),k=reducedMotion.matches?1:0.14;
    const moving=Math.abs(target.x-view.x)>1e-3||Math.abs(target.y-view.y)/target.y>1e-3;
    if(moving){view.x+=(target.x-view.x)*k;view.y*=Math.pow(target.y/view.y,k);dirty=true;}
    if(dirty){updateReadout();drawChart();dirty=false;}
    if(playing||pending||ripples.length||moving)requestAnimationFrame(frame);else running=false;
  }
  function kick(){if(!running){running=true;last=performance.now();requestAnimationFrame(frame);}}

  function setPlaying(on){
    playing=on;carry=on?1:0;const b=$('play');b.setAttribute('aria-pressed',String(on));
    b.querySelector('.icon').textContent=on?'❚❚':'▶';b.querySelector('.text').textContent=on?'Pause':'Play';
    if(on)hint.classList.add('gone');kick();
  }
  function reset(){
    tally=P.tally();stored=0;samples=[];nextSample=1;bestDecimals=0;pending=0;ripples=[];view={x:2,y:1.2};
    paintBase(lctx);if(!playing)hint.classList.remove('gone');dirty=true;kick();
  }
  function burst(n){pending+=n;kick();}

  function resize(){
    dpr=Math.min(2,window.devicePixelRatio||1);
    const b=board.getBoundingClientRect(),c=chart.getBoundingClientRect();
    const nextSize=Math.round(b.width*dpr);
    if(nextSize&&nextSize!==size){size=board.width=board.height=nextSize;rebuildLayer();ripples=[];}
    chart.width=Math.round(c.width*dpr);chart.height=Math.round(c.height*dpr);
    dirty=true;kick();
  }
  function setRate(){rate=RATES[$('speed').value];$('speed-label').textContent=`${rate>=1000?compact.format(rate):rate} / s`;}

  $('play').onclick=()=>setPlaying(!playing);
  $('reset').onclick=reset;
  document.querySelectorAll('[data-burst]').forEach(b=>b.onclick=()=>burst(Number(b.dataset.burst)));
  board.addEventListener('click',()=>burst(1));hint.onclick=()=>burst(1);
  $('speed').addEventListener('input',setRate);
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.target.matches('input,button,select,textarea'))return;
    if(e.key===' '){e.preventDefault();setPlaying(!playing);}
    else if(e.key==='r'||e.key==='R')reset();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{readColors();rebuildLayer();dirty=true;kick();});
  new ResizeObserver(resize).observe(document.querySelector('.board-frame'));
  new ResizeObserver(resize).observe(chart);
  readColors();setRate();resize();
})();
