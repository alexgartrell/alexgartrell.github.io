(function(){
  const B=BuffonNeedle,$=id=>document.getElementById(id);
  const board=$('board'),chart=$('chart'),hint=$('board-hint'),bctx=board.getContext('2d'),cctx=chart.getContext('2d');
  const RATES=[1,3,10,30,100,300,1000,3000,10000,30000,100000];
  // The floor is STRIPS boards wide, measured in units of the line spacing t.
  const STRIPS=5,T=1,STORE_CAP=200000,FRAME_CAP=50000,PAINT_CAP=40000,FALL_MS=520,FLASH_MS=750;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const fmt=new Intl.NumberFormat('en-US'),compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});

  let len=Number($('length').value),tally=B.tally(len,T),stored=0;
  const xs=new Float32Array(STORE_CAP),ys=new Float32Array(STORE_CAP),ts=new Float32Array(STORE_CAP);
  let samples=[],nextSample=1,bestDecimals=0;
  let playing=false,rate=RATES[2],carry=0,pending=0,falling=[],flashes=[],running=false,last=0;
  let colors={},dpr=1,size=0,layer=document.createElement('canvas'),lctx=layer.getContext('2d');
  let view={x:2,y:1.2},dirty=true,toastTimer=0;

  // Board geometry: needle centres land in [0, STRIPS)², and the floor extends half a spacing past the outer
  // lines so that every needle (ℓ ≤ t) lies fully on it.
  const pad=()=>size*0.035,side=()=>size-2*pad(),unit=()=>side()/(STRIPS+1),toPx=v=>pad()+(v+0.5)*unit();
  // Early needles are bold; later ones thin out and fade so the lines and the density pattern stay readable.
  const width=i=>unit()*Math.max(0.007,0.032/Math.pow(1+i/200,0.45));
  const opacity=i=>Math.max(0.1,Math.min(0.92,0.92*Math.sqrt(2000/(i+2000))));

  function readColors(){
    const s=getComputedStyle(document.documentElement),v=n=>s.getPropertyValue(n).trim();
    colors={in:v('--in'),out:v('--out'),text:v('--text'),muted:v('--muted'),border:v('--border'),surface:v('--surface'),board:v('--board'),bg:v('--bg'),accent:v('--accent'),good:v('--good')};
  }
  function alpha(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}

  function paintBase(ctx){
    const p=pad(),u=unit();
    ctx.clearRect(0,0,size,size);
    ctx.fillStyle=colors.board;ctx.fillRect(p,p,side(),side());
    ctx.fillStyle=alpha(colors.muted,0.06);
    for(let k=0;k<STRIPS;k+=2)ctx.fillRect(p,toPx(k),side(),u);
  }
  // Draws needles [from, to) from parallel arrays indexed from 0; clear ones first so crossings sit on top.
  // Long runs are split into chunks that grow with the count, so width and opacity fade smoothly.
  // Past PAINT_CAP the floor would saturate into a blanket, so later needles are counted but not drawn
  // (except ones that visibly tumbled in, which stay where they landed).
  function paintNeedles(ctx,from,to,X,Y,TH,always){
    if(!always)to=Math.min(to,PAINT_CAP);if(to<=from)return;
    const h=len/2*unit();
    ctx.save();ctx.beginPath();ctx.rect(pad(),pad(),side(),side());ctx.clip();ctx.lineCap='round';
    for(let a=from;a<to;){
      const b=Math.min(to,a+Math.max(250,Math.floor(a/8))),o=opacity(a);
      ctx.lineWidth=width(a);
      for(const hit of [false,true]){
        ctx.strokeStyle=hit?alpha(colors.out,o):alpha(colors.in,o*0.55);
        ctx.beginPath();
        for(let i=a;i<b;i++){
          const k=i-from,y=Y[k],th=TH[k];
          if(B.crosses(y,th,len,T)!==hit)continue;
          const dx=Math.cos(th)*h,dy=Math.sin(th)*h,cx=toPx(X[k]),cy=toPx(y);
          ctx.moveTo(cx-dx,cy-dy);ctx.lineTo(cx+dx,cy+dy);
        }
        ctx.stroke();
      }
      a=b;
    }
    ctx.restore();
  }
  function rebuildLayer(){
    const old=layer;layer=document.createElement('canvas');layer.width=layer.height=size;lctx=layer.getContext('2d');
    paintBase(lctx);
    if(stored===tally.total)paintNeedles(lctx,0,stored,xs,ys,ts);
    else if(old.width)lctx.drawImage(old,0,0,size,size);
  }

  function record(x,y,th){
    const i=tally.total;B.add(tally,y,th);
    if(stored<STORE_CAP&&stored===i){xs[i]=x;ys[i]=y;ts[i]=th;stored++;}
    if(tally.crossings&&tally.total>=nextSample){samples.push([tally.total,B.estimate(tally)]);nextSample=Math.max(tally.total+1,Math.ceil(tally.total*1.01));}
  }
  const scratchX=new Float32Array(FRAME_CAP),scratchY=new Float32Array(FRAME_CAP),scratchT=new Float32Array(FRAME_CAP);
  function dropNow(n){
    for(let start=0;start<n;start+=FRAME_CAP){
      const count=Math.min(FRAME_CAP,n-start),first=tally.total;
      for(let k=0;k<count;k++){
        const x=Math.random()*STRIPS,y=Math.random()*STRIPS,th=Math.random()*Math.PI;
        scratchX[k]=x;scratchY[k]=y;scratchT[k]=th;record(x,y,th);
      }
      paintNeedles(lctx,first,first+count,scratchX,scratchY,scratchT);
    }
    dirty=true;
  }
  // A needle in the air: it tumbles down and only counts once it lands.
  function dropAnimated(now){
    const y=Math.random()*STRIPS,th=Math.random()*Math.PI;
    falling.push({x:Math.random()*STRIPS,y,th,t:now,spin:(Math.random()<0.5?-1:1)*(0.7+Math.random()*1.2),hit:B.crosses(y,th,len,T)});
  }
  function land(f,now){
    const i=tally.total;record(f.x,f.y,f.th);
    scratchX[0]=f.x;scratchY[0]=f.y;scratchT[0]=f.th;paintNeedles(lctx,i,i+1,scratchX,scratchY,scratchT,true);
    f.t=now;flashes.push(f);dirty=true;
  }
  // Small drops tumble in one at a time; fast play and big bursts land instantly.
  function drop(n,now){
    if(n<=3&&(!playing||rate<=30)&&!reducedMotion.matches)for(let k=0;k<n;k++)dropAnimated(now);else dropNow(n);
    hint.classList.add('gone');
  }

  function strokeNeedle(ctx,cx,cy,th,h){const dx=Math.cos(th)*h,dy=Math.sin(th)*h;ctx.beginPath();ctx.moveTo(cx-dx,cy-dy);ctx.lineTo(cx+dx,cy+dy);ctx.stroke();}
  function drawBoard(now){
    const p=pad(),l=side(),u=unit(),h=len/2*u,w=Math.max(2.5*dpr,width(Math.min(tally.total,400)));
    bctx.clearRect(0,0,size,size);bctx.drawImage(layer,0,0);
    bctx.strokeStyle=colors.text;bctx.globalAlpha=0.75;bctx.lineWidth=Math.max(1,size/380);bctx.beginPath();
    for(let k=0;k<=STRIPS;k++){const y=toPx(k);bctx.moveTo(p,y);bctx.lineTo(p+l,y);}
    bctx.stroke();bctx.globalAlpha=1;bctx.lineCap='round';
    bctx.save();bctx.beginPath();bctx.rect(p,p,l,l);bctx.clip();
    // Just-landed needles glow, and a crossing pings the line it hit.
    flashes=flashes.filter(f=>now-f.t<FLASH_MS);
    for(const f of flashes){
      const q=(now-f.t)/FLASH_MS,e=1-Math.pow(1-q,3),c=f.hit?colors.out:colors.in,cx=toPx(f.x),cy=toPx(f.y);
      bctx.strokeStyle=alpha(c,0.3*(1-q));bctx.lineWidth=w*(1.5+3*(1-q));strokeNeedle(bctx,cx,cy,f.th,h);
      bctx.strokeStyle=alpha(c,1-q*0.6);bctx.lineWidth=w;strokeNeedle(bctx,cx,cy,f.th,h);
      if(f.hit)for(const [x,y] of B.crossingPoints(f.x,f.y,f.th,len,T)){
        bctx.strokeStyle=alpha(colors.out,0.9*(1-q));bctx.lineWidth=Math.max(1.5,size/320)*(1-q*0.5);
        bctx.beginPath();bctx.arc(toPx(x),toPx(y),u*(0.04+0.2*e),0,Math.PI*2);bctx.stroke();
      }
    }
    // Needles still in the air: a shadow sharpens as each one falls, then it settles with a little spin.
    for(const f of falling){
      const s=Math.min(1,(now-f.t)/FALL_MS),z=1-s*s,cx=toPx(f.x),cy=toPx(f.y);
      bctx.strokeStyle=alpha(colors.text,0.06+0.16*(1-z));bctx.lineWidth=w*(1+2.5*z);
      strokeNeedle(bctx,cx+z*u*0.05,cy+z*u*0.08,f.th+f.spin*z*0.5,h*(1+0.15*z));
      bctx.strokeStyle=alpha(colors.text,0.55+0.3*(1-z));bctx.lineWidth=w*(1+0.5*z);
      strokeNeedle(bctx,cx-z*u*0.12,cy-z*u*0.4,f.th+f.spin*z,h*(1+0.4*z));
    }
    bctx.restore();bctx.lineCap='butt';
  }

  function niceStep(span){const raw=span/4,pow=10**Math.floor(Math.log10(raw)),f=raw/pow;return (f<1.5?1:f<3.5?2:f<7.5?5:10)*pow;}
  const se=n=>B.standardError(n,len,T);
  function chartTarget(){
    const total=tally.total,x=Math.max(2,Math.log10(Math.max(1,total)));
    const floor=total/30;let dev=0;
    for(let i=samples.length-1;i>=0&&samples[i][0]>=floor;i--)if(Number.isFinite(samples[i][1]))dev=Math.max(dev,Math.abs(samples[i][1]-Math.PI));
    const y=Math.min(1.2,Math.max(0.0015,1.25*Math.max(dev,1.96*se(Math.max(1,floor)))));
    return {x,y};
  }
  function drawChart(){
    const w=chart.width,h=chart.height,s=dpr,L=48*s,R=14*s,T=10*s,Bm=24*s,pw=w-L-R,ph=h-T-Bm;
    const X=n=>L+Math.log10(n)/view.x*pw,Y=v=>T+ph/2-(v-Math.PI)/view.y*(ph/2);
    cctx.clearRect(0,0,w,h);cctx.font=`${11*s}px ui-monospace, SFMono-Regular, Menlo, monospace`;cctx.lineWidth=s;
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
    // 95% band: π ± 1.96 standard errors for this needle length.
    const steps=80,top=[],bottom=[];
    for(let i=0;i<=steps;i++){const n=10**(view.x*i/steps),e=1.96*se(n);top.push([X(n),Y(Math.PI+e)]);bottom.push([X(n),Y(Math.PI-e)]);}
    cctx.beginPath();top.forEach(([x,y],i)=>i?cctx.lineTo(x,y):cctx.moveTo(x,y));bottom.reverse().forEach(([x,y])=>cctx.lineTo(x,y));cctx.closePath();
    cctx.fillStyle=alpha(colors.accent,0.1);cctx.fill();
    cctx.setLineDash([5*s,4*s]);cctx.strokeStyle=colors.good;cctx.lineWidth=1.5*s;cctx.beginPath();cctx.moveTo(L,Y(Math.PI));cctx.lineTo(w-R,Y(Math.PI));cctx.stroke();cctx.setLineDash([]);
    if(samples.length){
      cctx.strokeStyle=colors.accent;cctx.lineWidth=2*s;cctx.lineJoin='round';cctx.beginPath();
      // Early estimates can be wild (one crossing in a handful of needles); lift the pen rather than draw off-chart spikes.
      const shown=v=>Number.isFinite(v)&&Math.abs(v-Math.PI)<=view.y*1.1;
      let down=false;
      for(const [n,v] of samples){if(!shown(v)){down=false;continue;}down?cctx.lineTo(X(n),Y(v)):cctx.moveTo(X(n),Y(v));down=true;}
      const est=B.estimate(tally),end=[X(tally.total),Y(est)];if(down&&shown(est))cctx.lineTo(...end);cctx.stroke();
      cctx.fillStyle=colors.accent;cctx.beginPath();cctx.arc(...end,4*s,0,Math.PI*2);cctx.fill();
      cctx.strokeStyle=colors.surface;cctx.lineWidth=2*s;cctx.stroke();
    }
    cctx.restore();
    cctx.fillStyle=colors.good;cctx.textAlign='right';cctx.textBaseline='bottom';cctx.fillText('π',w-R-4*s,Y(Math.PI)-3*s);
  }

  function updateReadout(){
    const t=tally,est=B.estimate(t),l=len.toFixed(2);
    $('total').textContent=fmt.format(t.total);$('crossing').textContent=fmt.format(t.crossings);$('clear').textContent=fmt.format(B.clear(t));
    const theory=`theory 2ℓ ÷ πt = <b>${(B.crossProbability(len,T)*100).toFixed(2)}%</b>`;
    $('rate').innerHTML=t.total?`Crossing rate <b>${(t.crossings/t.total*100).toFixed(2)}%</b> · ${theory}`:`Each needle crosses with chance ${theory}`;
    const el=$('estimate');
    if(!t.crossings){
      el.textContent='–.––––––';$('accuracy').textContent=t.total?'No crossings yet, so no estimate.':'No needles yet.';
      $('formula').textContent=`π ≈ 2ℓ × needles ÷ (t × crossings), with ℓ = ${l} t`;return;
    }
    const text=est.toFixed(6),md=B.matchingDecimals(est),okLen=md?2+Math.min(md,6):0;
    el.innerHTML=`<span class="ok">${text.slice(0,okLen)}</span>${text.slice(okLen)}`;
    const err=Math.abs(est-Math.PI);
    $('accuracy').textContent=`${md?`${md} correct decimal${md>1?'s':''} · `:''}off by ${err.toPrecision(2)} (${(err/Math.PI*100).toPrecision(2)}%) · typical ±${se(t.total).toPrecision(2)}`;
    $('formula').innerHTML=`π ≈ 2 × ${l} × <b>${fmt.format(t.total)}</b> ÷ (1 × <b class="o">${fmt.format(t.crossings)}</b>) = <b class="r">${est.toFixed(5)}</b>`;
    if(md>bestDecimals){bestDecimals=md;celebrate(md);}
  }
  const MILESTONES=['','3.1 — first decimal locked in','3.14 — Buffon would be proud','3.141 — three decimals from falling needles!','3.1415 — four decimals. Patience pays.','3.14159 — five decimals. Lazzarini, is that you?','Six or more decimals. Buy a lottery ticket.'];
  function toast(text){
    const el=$('toast');el.textContent=text;el.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);
  }
  function celebrate(md){
    const el=$('estimate');toast(MILESTONES[Math.min(md,6)]);
    el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');
  }

  function frame(now){
    const dt=Math.min(0.1,(now-last)/1000);last=now;
    let n=0;
    if(playing){carry+=rate*dt;n=Math.floor(carry);carry-=n;}
    if(pending){const take=Math.min(pending,Math.max(2000,Math.ceil(pending/12)),FRAME_CAP);pending-=take;n+=take;}
    if(n)drop(n,now);
    if(falling.length){const done=falling.filter(f=>now-f.t>=FALL_MS);if(done.length){falling=falling.filter(f=>now-f.t<FALL_MS);done.forEach(f=>land(f,now));}}
    drawBoard(now);
    const target=chartTarget(),k=reducedMotion.matches?1:0.14;
    const moving=Math.abs(target.x-view.x)>1e-3||Math.abs(target.y-view.y)/target.y>1e-3;
    if(moving){view.x+=(target.x-view.x)*k;view.y*=Math.pow(target.y/view.y,k);dirty=true;}
    if(dirty){updateReadout();drawChart();dirty=false;}
    if(playing||pending||falling.length||flashes.length||moving)requestAnimationFrame(frame);else running=false;
  }
  function kick(){if(!running){running=true;last=performance.now();requestAnimationFrame(frame);}}

  function setPlaying(on){
    playing=on;carry=on?1:0;const b=$('play');b.setAttribute('aria-pressed',String(on));
    b.querySelector('.icon').textContent=on?'❚❚':'▶';b.querySelector('.text').textContent=on?'Pause':'Play';
    if(on)hint.classList.add('gone');kick();
  }
  function reset(){
    tally=B.tally(len,T);stored=0;samples=[];nextSample=1;bestDecimals=0;pending=0;falling=[];flashes=[];view={x:2,y:1.2};
    paintBase(lctx);if(!playing)hint.classList.remove('gone');dirty=true;kick();
  }
  function burst(n){pending+=n;kick();}

  function resize(){
    dpr=Math.min(2,window.devicePixelRatio||1);
    const b=board.getBoundingClientRect(),c=chart.getBoundingClientRect();
    const nextSize=Math.round(b.width*dpr);
    if(nextSize&&nextSize!==size){size=board.width=board.height=nextSize;rebuildLayer();}
    chart.width=Math.round(c.width*dpr);chart.height=Math.round(c.height*dpr);
    dirty=true;kick();
  }
  function setRate(){rate=RATES[$('speed').value];$('speed-label').textContent=`${rate>=1000?compact.format(rate):rate} / s`;}
  function setLength(){
    const v=Number($('length').value);
    $('length-label').textContent=`ℓ = ${v.toFixed(2)} t`;$('mini-needle').setAttribute('y2',String(40-28*v));
    if(v===len)return;
    const had=tally.total>0;len=v;reset();
    if(had)toast('New needle length, so the count starts fresh');
  }

  $('play').onclick=()=>setPlaying(!playing);
  $('reset').onclick=reset;
  document.querySelectorAll('[data-burst]').forEach(b=>b.onclick=()=>burst(Number(b.dataset.burst)));
  board.addEventListener('click',()=>burst(1));hint.onclick=()=>burst(1);
  $('speed').addEventListener('input',setRate);
  $('length').addEventListener('input',setLength);
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.target.matches('input,button,select,textarea'))return;
    if(e.key===' '){e.preventDefault();setPlaying(!playing);}
    else if(e.key==='n'||e.key==='N')burst(1);
    else if(e.key==='r'||e.key==='R')reset();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{readColors();rebuildLayer();dirty=true;kick();});
  new ResizeObserver(resize).observe(document.querySelector('.board-frame'));
  new ResizeObserver(resize).observe(chart);
  readColors();setRate();setLength();resize();
})();
