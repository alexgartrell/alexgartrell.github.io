(function(){
  const F=Fourier,$=id=>document.getElementById(id);
  const board=$('board'),ctx=board.getContext('2d'),hint=$('board-hint');
  const N=256,PERIODS=[24,16,11,8,5.5,3.5,2],GHOST=640,TRAIL=0.8,TRAIL_STEPS=320,BUILD_MS=10000;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const fmt=new Intl.NumberFormat('en-US');

  let samples=[],terms=[],center=[0,0],extent=1,count=1,current='heart';
  let ghost=[],t=0,traced=0,playing=false,showCircles=true,period=PERIODS[3],building=null,drawing=null;
  let colors={},dpr=1,size=0,running=false,last=0,toastTimer=0;

  function readColors(){
    const s=getComputedStyle(document.documentElement),v=n=>s.getPropertyValue(n).trim();
    colors={text:v('--text'),muted:v('--muted'),border:v('--border'),board:v('--board'),accent:v('--accent'),pen:v('--pen'),shape:v('--shape')};
  }
  function alpha(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}

  // Math coordinates (y up, shapes within the unit circle) to canvas pixels.
  const scale=()=>size*0.44;
  const toPx=(x,y)=>[size/2+x*scale(),size/2-y*scale()];
  const fromPx=(px,py)=>[(px-size/2)/scale(),(size/2-py)/scale()];
  const at=(tt,n=count)=>{const [x,y]=F.evaluate(terms,tt,n);return [x+center[0],y+center[1]];};

  // ---- Shape and term count ----------------------------------------------------------------
  function setShape(points,name){
    samples=F.resample(points,N);
    const all=F.dft(samples),dc=all.find(c=>c.freq===0);
    center=[dc.re,dc.im];terms=F.byAmplitude(all.filter(c=>c.freq!==0));
    extent=Math.max(...samples.map(([x,y])=>Math.hypot(x-center[0],y-center[1])))||1;
    current=name;t=0;traced=0;
    document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===name)));
    $('samples').textContent=fmt.format(N);
  }
  const toSlider=n=>Math.round(Math.log(n)/Math.log(terms.length)*1000);
  const fromSlider=v=>Math.max(1,Math.min(terms.length,Math.round(Math.pow(terms.length,v/1000))));
  function setCount(n,moveSlider=true){
    count=Math.max(1,Math.min(terms.length,n));
    ghost=Array.from({length:GHOST},(_,i)=>at(i/GHOST));
    if(moveSlider)$('terms').value=toSlider(count);
    updateReadout();kick();
  }
  function startBuild(){
    if(reducedMotion.matches){setCount(terms.length);return;}
    building={start:performance.now()};setCount(1);setPlaying(true);
  }
  function stopBuild(){building=null;}
  function choose(name){stopBuild();setShape(F.PRESETS[name](),name);startBuild();setCount(count);}

  // ---- Readouts ------------------------------------------------------------------------------
  function updateReadout(){
    const M=terms.length,recon=F.reconstruct(terms,N,count).map(([x,y])=>[x+center[0],y+center[1]]);
    const err=F.meanDistance(recon,samples)/extent,energy=F.energy(terms,count);
    $('terms-big').innerHTML=`${fmt.format(count)}<span class="of">of ${fmt.format(M)}</span>`;
    $('terms-label').textContent=`${count} of ${M}`;
    $('energy').textContent=energy>0.9999&&count<M?'>99.99%':`${(energy*100).toFixed(energy>0.99?2:1)}%`;
    $('error').textContent=count===M?'0%':`${(err*100).toFixed(err<0.1?2:1)}%`;
    $('quality').textContent=count===M?'Every circle: exact at all 256 sample points.'
      :count===1?'One circle: the best single-circle fit to the shape.'
      :err<0.01?'Hard to tell apart from the original.'
      :err<0.03?'Close. The sharpest corners are still soft.'
      :err<0.08?'The outline is taking shape.'
      :'A rough blob so far. Add circles.';
    const top=terms.slice(0,3).map(c=>`<b class="r">${(c.amp/extent).toFixed(2)}</b> (k = ${c.freq>0?'':'−'}${Math.abs(c.freq)})`);
    $('formula').innerHTML=`z(t) = Σ c<sub>k</sub> e<sup>2πikt</sup><span class="terms">largest radii: ${top.join(', ')}</span>`;
  }
  function toast(text){
    const el=$('toast');el.textContent=text;el.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);
  }

  // ---- Drawing -------------------------------------------------------------------------------
  function strokeLoop(points,closed){
    ctx.beginPath();points.forEach(([x,y],i)=>{const [px,py]=toPx(x,y);i?ctx.lineTo(px,py):ctx.moveTo(px,py);});if(closed)ctx.closePath();ctx.stroke();
  }
  function draw(){
    const s=dpr;ctx.clearRect(0,0,size,size);ctx.fillStyle=colors.board;ctx.fillRect(0,0,size,size);
    ctx.lineJoin='round';ctx.lineCap='round';
    if(drawing){
      ctx.lineWidth=3*s;ctx.strokeStyle=colors.pen;strokeLoop(drawing,false);
      if(drawing.length>2){ctx.setLineDash([4*s,6*s]);ctx.lineWidth=1.5*s;ctx.strokeStyle=alpha(colors.pen,0.6);strokeLoop([drawing.at(-1),drawing[0]],false);ctx.setLineDash([]);}
      return;
    }
    ctx.setLineDash([4*s,5*s]);ctx.lineWidth=1.5*s;ctx.strokeStyle=colors.shape;strokeLoop(samples,true);ctx.setLineDash([]);
    ctx.lineWidth=2*s;ctx.strokeStyle=alpha(colors.accent,0.22);strokeLoop(ghost,true);
    // Trail: the last part of the loop, fading out behind the pen.
    const span=Math.min(TRAIL,traced),steps=Math.max(2,Math.round(TRAIL_STEPS*span/TRAIL)),pts=[];
    for(let i=0;i<=steps;i++)pts.push(at(t-span+span*i/steps));
    ctx.lineWidth=3*s;
    const chunks=24;
    for(let c=0;c<chunks;c++){
      const a=Math.floor(c*steps/chunks),b=Math.floor((c+1)*steps/chunks);if(b<=a)continue;
      ctx.strokeStyle=alpha(colors.accent,0.12+0.88*Math.pow((c+1)/chunks,1.5));strokeLoop(pts.slice(a,b+1),false);
    }
    // The chain of circles, biggest first, each centered on the tip of the one before.
    let [x,y]=center;
    if(showCircles){
      const circles=new Path2D(),arms=new Path2D(),R=scale();
      arms.moveTo(...toPx(x,y));
      for(let i=0;i<count;i++){
        const c=terms[i],r=c.amp*R,[px,py]=toPx(x,y);
        if(r>0.6*s){circles.moveTo(px+r,py);circles.arc(px,py,r,0,Math.PI*2);}
        const a=F.TAU*c.freq*t+c.phase;x+=c.amp*Math.cos(a);y+=c.amp*Math.sin(a);arms.lineTo(...toPx(x,y));
      }
      ctx.lineWidth=1*s;ctx.strokeStyle=alpha(colors.muted,0.32);ctx.stroke(circles);
      ctx.lineWidth=1.25*s;ctx.strokeStyle=alpha(colors.text,0.7);ctx.stroke(arms);
      const [cx,cy]=toPx(...center);ctx.fillStyle=colors.text;ctx.beginPath();ctx.arc(cx,cy,2.5*s,0,Math.PI*2);ctx.fill();
    }else[x,y]=at(t);
    const [px,py]=toPx(x,y);
    ctx.fillStyle=colors.pen;ctx.beginPath();ctx.arc(px,py,5*s,0,Math.PI*2);ctx.fill();
    ctx.lineWidth=2*s;ctx.strokeStyle=colors.board;ctx.stroke();
  }

  // ---- Animation loop ------------------------------------------------------------------------
  function frame(now){
    const dt=Math.min(0.1,(now-last)/1000);last=now;
    if(playing&&!drawing){const d=dt/period;t=(t+d)%1;traced+=d;}
    if(building){
      const p=Math.min(1,(now-building.start)/BUILD_MS),n=Math.max(1,Math.round(Math.pow(terms.length,p*p*(3-2*p))));
      if(n!==count)setCount(n);
      if(p>=1)stopBuild();
    }
    draw();
    if((playing||building)&&!document.hidden)requestAnimationFrame(frame);else running=false;
  }
  function kick(){if(!running){running=true;last=performance.now();requestAnimationFrame(frame);}}
  function setPlaying(on){
    playing=on;const b=$('play');b.setAttribute('aria-pressed',String(on));
    b.querySelector('.icon').textContent=on?'❚❚':'▶';b.querySelector('.text').textContent=on?'Pause':'Play';kick();
  }
  function setCircles(on){showCircles=on;const b=$('circles');b.setAttribute('aria-pressed',String(on));b.textContent=on?'Circles on':'Circles off';kick();}

  // ---- Drawing your own shape -----------------------------------------------------------------
  function pointFrom(e){const r=board.getBoundingClientRect();return fromPx((e.clientX-r.left)*size/r.width,(e.clientY-r.top)*size/r.height);}
  board.addEventListener('pointerdown',e=>{
    e.preventDefault();board.setPointerCapture(e.pointerId);
    drawing=[pointFrom(e)];stopBuild();hint.classList.add('gone');kick();
  });
  board.addEventListener('pointermove',e=>{
    if(!drawing)return;
    const p=pointFrom(e),q=drawing.at(-1);
    if(Math.hypot(p[0]-q[0],p[1]-q[1])*scale()>2*dpr){drawing.push(p);draw();}
  });
  function finishDrawing(){
    if(!drawing)return;
    const pts=drawing;drawing=null;
    if(pts.length<6||F.perimeter(pts)<0.5){toast('Draw a bigger loop, then let go.');kick();draw();return;}
    setShape(pts,'yours');startBuild();setCount(count);
  }
  board.addEventListener('pointerup',finishDrawing);
  board.addEventListener('pointercancel',()=>{drawing=null;draw();});

  // ---- Controls ------------------------------------------------------------------------------
  function setSpeed(){period=PERIODS[$('speed').value];$('speed-label').textContent=`${period} s / loop`;}
  $('terms').addEventListener('input',e=>{stopBuild();setCount(fromSlider(Number(e.target.value)),false);});
  $('play').onclick=()=>setPlaying(!playing);
  $('build').onclick=startBuild;
  $('circles').onclick=()=>setCircles(!showCircles);
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>choose(b.dataset.preset));
  $('speed').addEventListener('input',setSpeed);
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.target.matches('input,button,select,textarea'))return;
    const k=e.key.toLowerCase(),names=Object.keys(F.PRESETS);
    if(e.key===' '){e.preventDefault();setPlaying(!playing);}
    else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();stopBuild();setCount(count+(e.key==='ArrowRight'?1:-1));}
    else if(k==='b')startBuild();
    else if(k==='h')setCircles(!showCircles);
    else if(k>='1'&&k<=String(names.length))choose(names[Number(k)-1]);
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)kick();});

  function resize(){
    dpr=Math.min(2,window.devicePixelRatio||1);
    const n=Math.round(board.getBoundingClientRect().width*dpr);
    if(n&&n!==size){size=board.width=board.height=n;}
    kick();draw();
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{readColors();draw();});
  new ResizeObserver(resize).observe(document.querySelector('.board-frame'));
  readColors();setSpeed();setShape(F.PRESETS.heart(),'heart');setCount(1);resize();
  if(reducedMotion.matches)setCount(terms.length);else startBuild();
  setTimeout(()=>hint.classList.add('gone'),9000);
})();
