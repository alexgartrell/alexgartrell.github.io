(function(){
  const P=DoublePendulum,$=id=>document.getElementById(id);
  const board=$('board'),chart=$('chart'),bctx=board.getContext('2d'),cctx=chart.getContext('2d');
  const GRAVITY=[[0.62,'Pluto'],[1.62,'Moon'],[3.71,'Mars'],[9.81,'Earth'],[11.15,'Neptune'],[24.79,'Jupiter']];
  const SPEEDS=[0.1,0.25,0.5,1,1.5,2],H=1/1000,TRAIL=90,THRESHOLD=0.1,SAMPLE_DT=1/30,MAX_SAMPLES=6000;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)'),darkScheme=matchMedia('(prefers-color-scheme: dark)');
  const SUP={'-':'⁻',0:'⁰',1:'¹',2:'²',3:'³',4:'⁴',5:'⁵',6:'⁶',7:'⁷',8:'⁸',9:'⁹'};
  const sup=n=>String(n).split('').map(c=>SUP[c]).join('');
  // 3.2e-7 → "3.2×10⁻⁷"
  function sci(v,digits=1){
    if(!Number.isFinite(v))return '–';if(v===0)return '0';
    const e=Math.floor(Math.log10(Math.abs(v))),m=v/10**e,ms=m.toFixed(digits);
    if(ms.startsWith('10')){return sci(10**(e+1)*Math.sign(v),digits);}
    return e>=-2&&e<=2?v.toPrecision(digits+1):`${ms==='1.0'||ms==='1'?'':`${ms}×`}10${sup(e)}`;
  }

  let p=P.params(),start={t1:1.9,t2:2.5},count=20,eps=1e-6,speed=1;
  let states=[],E0=[],trails=[],t=0,divergedAt=null,samples=[],nextSample=0;
  let playing=false,running=false,last=0,drag=null,hover=false,colors={},dpr=1,size=0,toastTimer=0;

  function readColors(){
    const s=getComputedStyle(document.documentElement),v=n=>s.getPropertyValue(n).trim();
    colors={text:v('--text'),muted:v('--muted'),border:v('--border'),surface:v('--surface'),board:v('--board'),bg:v('--bg'),accent:v('--accent'),out:v('--out'),good:v('--good')};
    colors.dark=darkScheme.matches;buildPalette();
  }
  // A gradient from blue through violet and pink to orange, one color per pendulum.
  function buildPalette(){
    const stops=colors.dark?[[210,90,68],[275,80,72],[335,85,70],[25,95,65]]:[[210,72,50],[275,62,55],[335,70,55],[25,85,52]];
    colors.pend=Array.from({length:count},(_,i)=>{
      const u=count>1?i/(count-1)*(stops.length-1):0,k=Math.min(stops.length-2,Math.floor(u)),f=u-k,[h0,s0,l0]=stops[k],[h1,s1,l1]=stops[k+1];
      let dh=h1-h0;if(dh<-180)dh+=360;
      return `hsl(${(h0+dh*f+360)%360} ${s0+(s1-s0)*f}% ${l0+(l1-l0)*f}%)`;
    });
  }
  function alpha(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}
  function toast(text){const el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800);}

  // ----- Simulation -----
  function restart(){
    states=P.fan(count,start.t1,start.t2,eps);E0=states.map(s=>P.energy(s,p));
    trails=states.map(()=>({x:new Float32Array(TRAIL),y:new Float32Array(TRAIL),n:0,head:0}));
    t=0;divergedAt=null;samples=[];nextSample=0;record();buildPalette();updateLegend();
    const el=$('together');el.classList.remove('diverged');
  }
  function record(){
    const sp=P.spread(states,p);
    if(t>=nextSample){
      if(samples.length>=MAX_SAMPLES)samples=samples.filter((_,i)=>i%2===0);
      samples.push([t,Math.max(sp,1e-15)]);nextSample=t+SAMPLE_DT;
    }
    if(divergedAt===null&&sp>THRESHOLD){
      divergedAt=t;const el=$('together');el.classList.add('diverged');el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');
      toast(`Diverged after ${t.toFixed(1)} s, from a start ${sci(eps)} rad apart`);
    }
  }
  function pushTrail(){
    states.forEach((s,i)=>{const [,,x,y]=P.positions(s,p),tr=trails[i];tr.x[tr.head]=x;tr.y[tr.head]=y;tr.head=(tr.head+1)%TRAIL;tr.n=Math.min(TRAIL,tr.n+1);});
  }
  function step(simTime){
    const n=Math.max(1,Math.round(simTime/H)),h=simTime/n;
    for(let k=0;k<n;k++){for(const s of states)P.rk4(s,p,h);t+=h;if(k%8===7||k===n-1)record();}
    pushTrail();
  }

  // ----- Board -----
  const scale=()=>size*0.225,ox=()=>size/2,oy=()=>size*0.5;
  const X=x=>ox()+x*scale(),Y=y=>oy()+y*scale();
  function drawBoard(){
    bctx.clearRect(0,0,size,size);bctx.fillStyle=colors.board;bctx.fillRect(0,0,size,size);
    const lw=Math.max(1,size/600);
    // Reach circle: the outer bob can never leave it.
    bctx.strokeStyle=alpha(colors.muted,0.25);bctx.lineWidth=lw;bctx.setLineDash([3*lw,6*lw]);
    bctx.beginPath();bctx.arc(ox(),oy(),(p.l1+p.l2)*scale(),0,Math.PI*2);bctx.stroke();bctx.setLineDash([]);
    // Fading trails, oldest segments faintest.
    const BANDS=9;bctx.lineCap='round';bctx.lineJoin='round';bctx.lineWidth=Math.max(1.2,size/520);
    for(let i=states.length-1;i>=0;i--){
      const tr=trails[i];if(tr.n<2)continue;bctx.strokeStyle=colors.pend[i];
      const per=Math.ceil((tr.n-1)/BANDS);
      for(let b=0;b<BANDS;b++){
        const from=b*per,to=Math.min(tr.n-1,(b+1)*per);if(from>=to)break;
        bctx.globalAlpha=0.08+0.62*((b+1)/BANDS)**1.6;bctx.beginPath();
        for(let k=from;k<=to;k++){const j=(tr.head-tr.n+k+TRAIL)%TRAIL;k===from?bctx.moveTo(X(tr.x[j]),Y(tr.y[j])):bctx.lineTo(X(tr.x[j]),Y(tr.y[j]));}
        bctx.stroke();
      }
    }
    bctx.globalAlpha=1;
    // Rods and bobs, first pendulum on top.
    const r1=size*0.014,r2=size*0.019;
    for(let i=states.length-1;i>=0;i--){
      const [x1,y1,x2,y2]=P.positions(states[i],p),col=colors.pend[i];
      bctx.strokeStyle=col;bctx.globalAlpha=0.55;bctx.lineWidth=Math.max(1.5,size/280);
      bctx.beginPath();bctx.moveTo(ox(),oy());bctx.lineTo(X(x1),Y(y1));bctx.lineTo(X(x2),Y(y2));bctx.stroke();bctx.globalAlpha=1;
      bctx.fillStyle=col;bctx.strokeStyle=colors.board;bctx.lineWidth=Math.max(1.5,size/400);
      bctx.beginPath();bctx.arc(X(x1),Y(y1),r1,0,Math.PI*2);bctx.fill();bctx.stroke();
      bctx.beginPath();bctx.arc(X(x2),Y(y2),r2,0,Math.PI*2);bctx.fill();bctx.stroke();
    }
    if(drag||hover){
      const [x1,y1,x2,y2]=P.positions(states[0],p),[hx,hy]=(drag?drag.bob:hover)===1?[x1,y1]:[x2,y2];
      bctx.strokeStyle=alpha(colors.accent,0.6);bctx.lineWidth=2*lw;bctx.beginPath();bctx.arc(X(hx),Y(hy),size*0.034,0,Math.PI*2);bctx.stroke();
    }
    bctx.fillStyle=colors.text;bctx.beginPath();bctx.arc(ox(),oy(),size*0.008,0,Math.PI*2);bctx.fill();
  }

  // ----- Chart -----
  function drawChart(){
    const w=chart.width,h=chart.height,s=dpr,L=52*s,R=14*s,T=10*s,B=24*s,pw=w-L-R,ph=h-T-B;
    const s0=samples.length?samples[0][1]:eps,yMin=Math.floor(Math.log10(Math.max(1e-15,s0))-0.3),yMax=Math.log10(5);
    const xMax=Math.max(10,Math.ceil((t+0.5)/5)*5);
    const Xc=v=>L+v/xMax*pw,Yc=v=>T+(yMax-Math.log10(v))/(yMax-yMin)*ph;
    cctx.clearRect(0,0,w,h);cctx.font=`${11*s}px ui-monospace, SFMono-Regular, Menlo, monospace`;cctx.lineWidth=s;
    cctx.textAlign='right';cctx.textBaseline='middle';
    const every=Math.max(1,Math.ceil((yMax-yMin)/6));
    for(let e=Math.ceil(yMin);e<=yMax;e++){
      if((e-Math.ceil(yMin))%every&&e!==0)continue;
      const y=Yc(10**e);cctx.strokeStyle=colors.border;cctx.beginPath();cctx.moveTo(L,y);cctx.lineTo(w-R,y);cctx.stroke();
      cctx.fillStyle=colors.muted;cctx.fillText(e===0?'1 m':e===-1?'10 cm':e===-2?'1 cm':e===-3?'1 mm':`10${sup(e)} m`,L-6*s,y);
    }
    cctx.textAlign='center';cctx.textBaseline='top';
    const xStep=xMax<=20?2:xMax<=60?10:20;
    for(let v=0;v<=xMax;v+=xStep){const x=Xc(v);cctx.strokeStyle=colors.border;cctx.beginPath();cctx.moveTo(x,T);cctx.lineTo(x,T+ph);cctx.stroke();cctx.fillStyle=colors.muted;cctx.fillText(`${v} s`,x,T+ph+6*s);}
    cctx.save();cctx.beginPath();cctx.rect(L,T,pw,ph);cctx.clip();
    cctx.setLineDash([5*s,4*s]);cctx.strokeStyle=colors.out;cctx.lineWidth=1.5*s;cctx.beginPath();cctx.moveTo(L,Yc(THRESHOLD));cctx.lineTo(w-R,Yc(THRESHOLD));cctx.stroke();
    if(divergedAt!==null){cctx.strokeStyle=alpha(colors.out,0.6);cctx.beginPath();cctx.moveTo(Xc(divergedAt),T);cctx.lineTo(Xc(divergedAt),T+ph);cctx.stroke();}
    cctx.setLineDash([]);
    const fit=lyapunov();
    if(fit){cctx.strokeStyle=alpha(colors.muted,0.7);cctx.lineWidth=1.5*s;cctx.setLineDash([2*s,4*s]);cctx.beginPath();cctx.moveTo(Xc(fit.t0),Yc(Math.exp(fit.a+fit.b*fit.t0)));cctx.lineTo(Xc(fit.t1),Yc(Math.exp(fit.a+fit.b*fit.t1)));cctx.stroke();cctx.setLineDash([]);}
    if(samples.length){
      cctx.strokeStyle=colors.accent;cctx.lineWidth=2*s;cctx.lineJoin='round';cctx.beginPath();
      samples.forEach(([x,v],i)=>i?cctx.lineTo(Xc(x),Yc(v)):cctx.moveTo(Xc(x),Yc(v)));cctx.stroke();
      const [lx,lv]=samples[samples.length-1];cctx.fillStyle=colors.accent;cctx.beginPath();cctx.arc(Xc(lx),Yc(lv),4*s,0,Math.PI*2);cctx.fill();cctx.strokeStyle=colors.surface;cctx.lineWidth=2*s;cctx.stroke();
    }
    cctx.restore();
    cctx.fillStyle=colors.text;cctx.textAlign='right';cctx.textBaseline='bottom';cctx.fillText('10 cm',w-R-4*s,Yc(THRESHOLD)-3*s);
  }
  // Least-squares slope of ln(gap) against time while the gap is still small: the Lyapunov exponent.
  function lyapunov(){
    const end=divergedAt??t,t0=Math.min(1,end*0.2),pts=samples.filter(([x,v])=>x>=t0&&x<=end&&v<THRESHOLD);
    if(pts.length<20||end-t0<2)return null;
    let sx=0,sy=0,sxx=0,sxy=0;for(const [x,v] of pts){const y=Math.log(v);sx+=x;sy+=y;sxx+=x*x;sxy+=x*y;}
    const n=pts.length,b=(n*sxy-sx*sy)/(n*sxx-sx*sx),a=(sy-b*sx)/n;
    return b>0.05?{a,b,t0:pts[0][0],t1:pts[n-1][0]}:null;
  }

  // ----- Readout -----
  function updateReadout(){
    const sp=P.spread(states,p),el=$('together');
    let worst=0;states.forEach((s,i)=>worst=Math.max(worst,Math.abs(P.energy(s,p)-E0[i])/Math.max(1e-9,Math.abs(E0[i]))));
    $('time').textContent=`${t.toFixed(1)} s`;$('spread').textContent=sp<1e-3?`${sci(sp)} m`:sp<1?`${(sp*100).toFixed(sp<0.1?1:0)} cm`:`${sp.toFixed(2)} m`;
    $('drift').textContent=sci(worst);
    if(divergedAt===null){$('together-label').textContent='Swinging together for';el.textContent=`${t.toFixed(1)} s`;$('together-note').textContent=`Outer bobs all within 10 cm. Started ${sci(eps)} rad apart.`;}
    else{$('together-label').textContent='Diverged after';el.textContent=`${divergedAt.toFixed(2)} s`;$('together-note').textContent=`The outer bobs drifted more than 10 cm apart.`;}
    const s=states[0],[t1,t2,w1,w2]=s,{m1,m2,l1,l2,g}=p;
    const kin=0.5*m1*l1*l1*w1*w1+0.5*m2*(l1*l1*w1*w1+l2*l2*w2*w2+2*l1*l2*w1*w2*Math.cos(t1-t2)),E=P.energy(s,p);
    $('formula').innerHTML=`E = kinetic + potential<br><b>${E.toFixed(6)} J</b> = ${kin.toFixed(3)} ${E-kin<0?'−':'+'} ${Math.abs(E-kin).toFixed(3)}<br>Worst drift <b class="good">${sci(worst)}</b> of the starting energy`;
    const fit=lyapunov();
    $('chart-note').innerHTML=fit?`The gap grows like e<sup>λt</sup> with <b>λ ≈ ${fit.b.toFixed(2)} per second</b>: it multiplies by 10 every ${(Math.LN10/fit.b).toFixed(1)} s. The vertical axis is logarithmic, so that growth is a straight line (dotted fit).`
      :'The vertical axis is logarithmic, so exponential growth shows up as a straight line.';
  }
  function updateLegend(){$('eps-legend').textContent=`+0 … +${sci(eps*(count-1))} rad`;}

  // ----- Loop -----
  function frame(now){
    const dt=Math.min(0.05,(now-last)/1000);last=now;
    if(playing&&!drag)step(dt*speed);
    drawBoard();drawChart();updateReadout();
    if(playing&&!drag)requestAnimationFrame(frame);else running=false;
  }
  function kick(){if(!running){running=true;last=performance.now();requestAnimationFrame(frame);}}
  function redraw(){if(!running){drawBoard();drawChart();updateReadout();}}
  function setPlaying(on){
    playing=on;const b=$('play');b.setAttribute('aria-pressed',String(on));
    b.querySelector('.icon').textContent=on?'❚❚':'▶';b.querySelector('.text').textContent=on?'Pause':'Play';
    if(on)kick();
  }
  function reset(){restart();redraw();}
  function shuffle(){
    const sign=()=>Math.random()<0.5?-1:1;
    start={t1:sign()*(1.4+Math.random()*1.5),t2:sign()*(1.2+Math.random()*1.9)};restart();redraw();setPlaying(true);
  }

  // ----- Dragging -----
  function eventPoint(e){const r=board.getBoundingClientRect();return [((e.clientX-r.left)*dpr-ox())/scale(),((e.clientY-r.top)*dpr-oy())/scale()];}
  function bobAt(e){
    const [x,y]=eventPoint(e),[x1,y1,x2,y2]=P.positions(states[0],p),reach=Math.max(26*dpr,size*0.05)/scale();
    const d1=Math.hypot(x-x1,y-y1),d2=Math.hypot(x-x2,y-y2);
    return d2<reach&&d2<=d1?2:d1<reach?1:0;
  }
  board.addEventListener('pointerdown',e=>{
    const bob=bobAt(e);if(!bob)return;
    drag={bob,wasPlaying:playing};try{board.setPointerCapture(e.pointerId);}catch{}
    board.classList.add('grabbing');e.preventDefault();moveDrag(e);
  });
  function moveDrag(e){
    const [x,y]=eventPoint(e);
    if(drag.bob===1)start={t1:P.aim(x,y),t2:start.t2};
    else{const [x1,y1]=P.positions(P.state(start.t1,start.t2),p);start={t1:start.t1,t2:P.aim(x,y,x1,y1)};}
    restart();redraw();
  }
  board.addEventListener('pointermove',e=>{
    if(drag){moveDrag(e);return;}
    const bob=bobAt(e);if(bob!==(hover||0)){hover=bob||false;board.classList.toggle('grab',!!bob);redraw();}
  });
  const endDrag=()=>{if(!drag)return;drag=null;board.classList.remove('grabbing');setPlaying(true);};
  board.addEventListener('pointerup',endDrag);board.addEventListener('pointercancel',endDrag);
  board.addEventListener('pointerleave',()=>{if(hover&&!drag){hover=false;board.classList.remove('grab');redraw();}});

  // ----- Controls -----
  function setCount(){count=Number($('count').value);$('count-label').textContent=count;}
  function setEps(){const e=Number($('eps').value);eps=10**e;$('eps-label').textContent=`10${sup(e)} rad`;}
  function setGravity(){
    const [g,name]=GRAVITY[$('g').value];p={...p,g};$('g-label').textContent=`${g.toFixed(2)} m/s² · ${name}`;
    // Changing g changes the potential energy, so measure drift from here on.
    E0=states.map(s=>P.energy(s,p));
  }
  function setSpeed(){speed=SPEEDS[$('speed').value];$('speed-label').textContent=`${speed}×`;}

  $('play').onclick=()=>setPlaying(!playing);
  $('reset').onclick=reset;
  $('random').onclick=shuffle;
  $('count').addEventListener('input',()=>{setCount();restart();redraw();});
  $('eps').addEventListener('input',()=>{setEps();restart();redraw();});
  $('g').addEventListener('input',()=>{setGravity();redraw();});
  $('speed').addEventListener('input',setSpeed);
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.target.matches('input,button,select,textarea'))return;
    if(e.key===' '){e.preventDefault();setPlaying(!playing);}
    else if(e.key==='r'||e.key==='R')reset();
    else if(e.key==='s'||e.key==='S')shuffle();
  });
  function resize(){
    dpr=Math.min(2,window.devicePixelRatio||1);
    const b=board.getBoundingClientRect(),c=chart.getBoundingClientRect();
    size=board.width=board.height=Math.round(b.width*dpr)||size;
    chart.width=Math.round(c.width*dpr);chart.height=Math.round(c.height*dpr);redraw();
  }
  darkScheme.addEventListener('change',()=>{readColors();redraw();});
  new ResizeObserver(resize).observe(document.querySelector('.board-frame'));
  new ResizeObserver(resize).observe(chart);
  setCount();setEps();setSpeed();readColors();setGravity();restart();resize();
  // Start swinging right away, unless the reader prefers less motion.
  if(!reducedMotion.matches)setPlaying(true);
})();
