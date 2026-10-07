(function(){
  const M=Mandel,$=id=>document.getElementById(id);
  const board=$('board'),ctx=board.getContext('2d'),jcanvas=$('julia'),jctx=jcanvas.getContext('2d');
  const PASSES=[8,2,1],BAND=16,LUT_SIZE=2048,JULIA_ITER=200,JULIA_SPAN=3.2;
  const HOME={x:-0.6,y:0,zoom:1};
  const PRESETS={
    seahorse:{x:-0.7453,y:0.1127,zoom:160,name:'Seahorse Valley'},
    elephant:{x:0.2820,y:0.0090,zoom:160,name:'Elephant Valley'},
    minibrot:{x:-1.7690,y:0,zoom:42,name:'A mini-brot on the real axis'},
    spiral:{x:-0.761574,y:-0.0847596,zoom:2500,name:'A spiral'},
  };
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const fmt=new Intl.NumberFormat('en-US');

  let view={...HOME},shown=null,anim=null,needRender=true,W=0,H=0,dpr=1;
  let floor=0,juliaFloor=0,palette='classic',lut=M.lut(palette,LUT_SIZE),inside=M.insideColor(palette),offset=0,cycling=false;
  let job=null,jobId=0,base=null,workers=[],idle=[],useMain=false,mainTimer=0;
  let pointers=new Map(),gesture=null,juliaC=[HOME.x,HOME.y],juliaDirty=true,julia=null;
  let running=false,last=0,dirty=true,toastTimer=0,warnedLimit=false;

  // ——— Workers: rebuilt from the tested module's own source, so there is one copy of the math.
  function makeWorkers(){
    try{
      const src=`const M=(${M.factory.toString()})();onmessage=e=>{const p=e.data,out=new Float32Array((p.y1-p.y0)*p.gw);M.renderRows(p,p.y0,p.y1,out);postMessage({id:p.id,pass:p.pass,y0:p.y0,y1:p.y1,out},[out.buffer]);};`;
      const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));
      const n=Math.max(2,Math.min(8,(navigator.hardwareConcurrency||4)-1));
      for(let i=0;i<n;i++){
        const w=new Worker(url);
        w.onmessage=e=>{idle.push(w);receive(e.data);dispatch();};
        w.onerror=e=>{e.preventDefault();toMainThread();};
        workers.push(w);idle.push(w);
      }
    }catch(err){toMainThread();}
  }
  function toMainThread(){if(useMain)return;useMain=true;workers.forEach(w=>w.terminate());workers=[];idle=[];needRender=true;kick();}

  // ——— Progressive render: a coarse pass (8×8 blocks), then 2×2, then every pixel, each split into bands.
  function startRender(){
    if(!W)return;
    if(shown&&job)base={canvas:snapshot(),view:{...shown},w:W,h:H};
    const ps=M.pixelSize(view,W,H),maxIter=M.iterationsForZoom(view.zoom);floor=M.sampleFloor(view,W,H,maxIter);
    const id=++jobId,passes=PASSES.map((s,k)=>{
      const gw=Math.ceil(W/s),gh=Math.ceil(H/s),canvas=document.createElement('canvas');canvas.width=gw;canvas.height=gh;
      const c=canvas.getContext('2d'),img=c.createImageData(gw,gh);
      return {k,s,gw,gh,canvas,ctx:c,img,u32:new Uint32Array(img.data.buffer),buf:new Float32Array(gw*gh).fill(NaN),rows:0};
    });
    const queue=[];
    for(const p of passes){
      const bands=[];for(let y0=0;y0<p.gh;y0+=BAND)bands.push(y0);
      bands.sort((a,b)=>Math.abs(a+BAND/2-p.gh/2)-Math.abs(b+BAND/2-p.gh/2));
      for(const y0 of bands)queue.push({id,pass:p.k,y0,y1:Math.min(p.gh,y0+BAND),x:view.x,y:view.y,ps,W,H,s:p.s,gw:p.gw,maxIter,eps:Math.max(4e-16,Math.min(1e-10,ps*1e-3))});
    }
    const total=passes.reduce((n,p)=>n+p.gh,0);
    job={id,view:{...view},w:W,h:H,maxIter,passes,queue,total,doneRows:0,t0:performance.now(),ms:0};
    $('busy').classList.add('on');$('busy').firstChild.style.width='0%';
    dirty=true;dispatch();
  }
  function dispatch(){
    if(!job)return;
    if(useMain){if(!mainTimer)mainTimer=setTimeout(mainSlice,0);return;}
    while(idle.length&&job.queue.length)idle.pop().postMessage(job.queue.shift());
  }
  // Fallback when Workers are unavailable: compute bands on the main thread in ~12 ms slices.
  function mainSlice(){
    mainTimer=0;const end=performance.now()+12;
    while(job&&job.queue.length&&performance.now()<end){
      const p=job.queue.shift(),out=new Float32Array((p.y1-p.y0)*p.gw);
      M.renderRows(p,p.y0,p.y1,out);receive({id:p.id,pass:p.pass,y0:p.y0,y1:p.y1,out});
    }
    if(job&&job.queue.length)mainTimer=setTimeout(mainSlice,0);
  }
  function receive(r){
    if(!job||r.id!==job.id)return;
    const p=job.passes[r.pass];
    p.buf.set(r.out,r.y0*p.gw);colorRange(p.buf,p.u32,r.y0*p.gw,r.y1*p.gw,floor);
    p.ctx.putImageData(p.img,0,0,0,r.y0,p.gw,r.y1-r.y0);
    p.rows+=r.y1-r.y0;job.doneRows+=r.y1-r.y0;
    $('busy').firstChild.style.width=`${job.doneRows/job.total*100}%`;
    if(job.doneRows===job.total){job.ms=performance.now()-job.t0;$('busy').classList.remove('on');base=null;}
    dirty=true;kick();
  }

  function colorRange(buf,u32,from,to,f){
    const n=LUT_SIZE;
    for(let i=from;i<to;i++){const v=buf[i];u32[i]=v!==v?0:v<0?inside:lut[(M.shade(v,offset,f)*n)|0];}
  }
  function recolorAll(){
    if(job)for(const p of job.passes){colorRange(p.buf,p.u32,0,p.buf.length,floor);p.ctx.putImageData(p.img,0,0);}
    if(julia){colorRange(julia.buf,julia.u32,0,julia.buf.length,juliaFloor);jctx.putImageData(julia.img,0,0);}
  }
  function snapshot(){const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').drawImage(board,0,0);return c;}

  // Draws an image rendered for `src` (on a srcW×srcH canvas) where it belongs in the current view.
  function place(img,src,srcW,srcH,imgW,imgH){
    const pss=M.pixelSize(src,srcW,srcH),ps=M.pixelSize(view,W,H),k=pss/ps;
    const left=src.x-srcW/2*pss,top=src.y+srcH/2*pss;
    ctx.drawImage(img,0,0,img.width,img.height,(left-view.x)/ps+W/2,(view.y-top)/ps+H/2,imgW*k,imgH*k);
  }
  function draw(){
    const c=inside;ctx.fillStyle=`rgb(${c&255},${c>>8&255},${c>>16&255})`;ctx.fillRect(0,0,W,H);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    if(base)place(base.canvas,base.view,base.w,base.h,base.w,base.h);
    if(job){
      let from=0;job.passes.forEach((p,i)=>{if(p.rows===p.gh)from=i;});
      for(const p of job.passes.slice(from))if(p.rows)place(p.canvas,job.view,job.w,job.h,p.gw*p.s,p.gh*p.s);
    }
    shown={...view};
  }

  // ——— Julia preview: fix c and colour each starting point z by how fast it escapes.
  function renderJulia(){
    const n=Math.max(64,Math.min(220,Math.round(jcanvas.getBoundingClientRect().width*dpr)));
    if(!julia||julia.n!==n){jcanvas.width=jcanvas.height=n;const img=jctx.createImageData(n,n);julia={n,img,u32:new Uint32Array(img.data.buffer),buf:new Float32Array(n*n)};}
    const [cx,cy]=juliaC,s=JULIA_SPAN/n;let k=0;
    for(let y=0;y<n;y++){const zy=JULIA_SPAN/2-(y+0.5)*s;for(let x=0;x<n;x++)julia.buf[k++]=M.julia((x+0.5)*s-JULIA_SPAN/2,zy,cx,cy,JULIA_ITER);}
    juliaFloor=M.floorOf(julia.buf.filter((_,i)=>i%5===0));colorRange(julia.buf,julia.u32,0,n*n,juliaFloor);jctx.putImageData(julia.img,0,0);
  }

  const num=(v,d)=>(v<0?'−':'')+Math.abs(v).toFixed(d);
  const digits=()=>Math.max(4,Math.min(15,Math.ceil(Math.log10(view.zoom))+4));
  function zoomText(z){return z<10?`${z.toFixed(1)}×`:z<1e6?`${fmt.format(Math.round(z))}×`:`${z.toExponential(1).replace('e+',' × 10^')}`;}
  function updateReadout(){
    const d=digits();
    $('center').innerHTML=`<span>${num(view.x,d)}</span><span>${view.y<0?'−':'+'} ${Math.abs(view.y).toFixed(d)}i</span>`;
    $('zoom').textContent=zoomText(view.zoom).replace(/ × 10\^(\d+)/,(_,e)=>`e${e}`);
    $('iters').textContent=fmt.format(M.iterationsForZoom(view.zoom));
    $('time').textContent=job&&job.doneRows===job.total?`${fmt.format(Math.max(1,Math.round(job.ms)))} ms`:'…';
  }
  function showCursor(){const d=Math.min(digits(),10);$('cursor').textContent=`c = ${num(juliaC[0],d)} ${juliaC[1]<0?'−':'+'} ${Math.abs(juliaC[1]).toFixed(d)}i`;}

  function frame(now){
    const dt=Math.min(0.1,(now-last)/1000);last=now;
    if(anim){
      const t=Math.min(1,(now-anim.t0)/anim.dur),e=t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2,{from:a,to:b}=anim;
      view={x:a.x+(b.x-a.x)*e,y:a.y+(b.y-a.y)*e,zoom:a.zoom*Math.pow(b.zoom/a.zoom,e)};
      if(t>=1){view={...b};anim=null;needRender=true;}
      dirty=true;
    }
    if(needRender&&!anim){needRender=false;startRender();}
    if(cycling){offset=(offset+dt*0.05)%1;recolorAll();dirty=true;}
    if(juliaDirty){juliaDirty=false;renderJulia();showCursor();}
    if(dirty){draw();updateReadout();dirty=false;}
    if(anim||cycling||needRender)requestAnimationFrame(frame);else running=false;
  }
  function kick(){if(!running){running=true;last=performance.now();requestAnimationFrame(frame);}}

  function setView(v){
    if(v.zoom>=M.MAX_ZOOM&&!warnedLimit){warnedLimit=true;toast('That is as deep as 64-bit floating point can go.');}
    view={x:v.x,y:v.y,zoom:M.clampZoom(v.zoom)};anim=null;needRender=true;dirty=true;kick();
  }
  function animateTo(v){
    v={x:v.x,y:v.y,zoom:M.clampZoom(v.zoom)};
    if(v.zoom>=M.MAX_ZOOM&&view.zoom>=M.MAX_ZOOM){toast('That is as deep as 64-bit floating point can go.');}
    if(reducedMotion.matches){setView(v);return;}
    anim={from:{...view},to:v,t0:performance.now(),dur:340};kick();
  }
  function zoomBy(factor,px=W/2,py=H/2){
    const [x,y]=M.toComplex(view,px,py,W,H);animateTo({x,y,zoom:view.zoom*factor});
  }
  function jump(v){setView(v);if(!pointers.size){juliaC=[v.x,v.y];juliaDirty=true;}}

  // ——— Pointer input: tap to zoom, one finger or mouse to pan, two to pinch.
  const local=e=>{const r=board.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};};
  function beginGesture(){
    const pts=[...pointers.values()].map(p=>({...p}));
    gesture={v0:{...view},pts,moved:gesture?gesture.moved:false,t0:gesture?gesture.t0:performance.now()};
  }
  function moveGesture(){
    const pts=[...pointers.values()],g=gesture,v0=g.v0;
    const mid=a=>a.length>1?{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}:a[0];
    const m0=mid(g.pts),m1=mid(pts),factor=pts.length>1&&g.pts.length>1?Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)/Math.max(1,Math.hypot(g.pts[0].x-g.pts[1].x,g.pts[0].y-g.pts[1].y)):1;
    if(!g.moved&&(Math.hypot(m1.x-m0.x,m1.y-m0.y)>6*dpr||pts.length>1))g.moved=true;
    if(!g.moved)return;
    board.classList.add('dragging');
    const [px,py]=M.toComplex(v0,m0.x,m0.y,W,H),next={zoom:M.clampZoom(v0.zoom*factor)},s=M.pixelSize(next,W,H);
    setView({x:px-(m1.x-W/2)*s,y:py+(m1.y-H/2)*s,zoom:next.zoom});
  }
  board.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    try{board.setPointerCapture(e.pointerId);}catch(err){}pointers.set(e.pointerId,local(e));
    if(anim){view={...anim.to};anim=null;needRender=true;}
    if(pointers.size===1)gesture=null;beginGesture();
  });
  board.addEventListener('pointermove',e=>{
    const p=local(e);
    if(pointers.has(e.pointerId)){pointers.set(e.pointerId,p);moveGesture();}
    if(e.pointerType==='mouse'&&!pointers.size){juliaC=M.toComplex(view,p.x,p.y,W,H);juliaDirty=true;kick();}
  });
  function endPointer(e){
    if(!pointers.has(e.pointerId))return;
    const g=gesture,p=pointers.get(e.pointerId);pointers.delete(e.pointerId);
    if(pointers.size){beginGesture();return;}
    gesture=null;board.classList.remove('dragging');
    if(e.type==='pointerup'&&g&&!g.moved&&performance.now()-g.t0<800)zoomBy(e.shiftKey?0.5:2,p.x,p.y);
    if(e.pointerType!=='mouse'){juliaC=[view.x,view.y];juliaDirty=true;kick();}
  }
  board.addEventListener('pointerup',endPointer);board.addEventListener('pointercancel',endPointer);
  board.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!pointers.size){juliaC=[view.x,view.y];juliaDirty=true;kick();}});
  board.addEventListener('wheel',e=>{
    e.preventDefault();
    const p=local(e),factor=Math.exp(-e.deltaY*(e.deltaMode===1?0.05:0.0022));
    if(anim){view={...anim.to};anim=null;}
    setView(M.zoomAt(view,p.x,p.y,W,H,factor));
  },{passive:false});
  board.addEventListener('contextmenu',e=>e.preventDefault());

  function toast(text){
    const t=$('toast');t.textContent=text;t.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600);
  }

  function setPalette(name){
    palette=name;lut=M.lut(name,LUT_SIZE);inside=M.insideColor(name);
    document.querySelectorAll('[data-palette]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.palette===name)));
    recolorAll();base=null;dirty=true;kick();
  }
  function buildPalettes(){
    const box=$('palettes');
    for(const [key,p] of Object.entries(M.PALETTES)){
      const b=document.createElement('button');b.type='button';b.dataset.palette=key;
      const stops=Array.from({length:13},(_,i)=>`rgb(${M.gradient(key,i/12).join(',')}) ${(i/12*100).toFixed(1)}%`).join(',');
      b.innerHTML=`<i style="background:linear-gradient(90deg,${stops})"></i>${p.name}`;
      b.onclick=()=>setPalette(key);box.appendChild(b);
    }
  }
  function setCycling(on){cycling=on;$('cycle').checked=on;kick();}

  function resize(){
    dpr=Math.min(2,window.devicePixelRatio||1);
    const r=board.getBoundingClientRect(),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);
    if(w&&h&&(w!==W||h!==H)){W=board.width=w;H=board.height=h;base=null;job=null;needRender=true;}
    juliaDirty=true;dirty=true;kick();
  }

  $('zoom-in').onclick=()=>zoomBy(2);$('zoom-out').onclick=()=>zoomBy(0.5);$('reset').onclick=()=>jump(HOME);
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const p=PRESETS[b.dataset.preset];jump(p);toast(p.name);});
  $('cycle').addEventListener('change',e=>setCycling(e.target.checked));
  document.addEventListener('keydown',e=>{
    if(e.key==='Shift')board.classList.add('shift');
    if(e.metaKey||e.ctrlKey||e.altKey||e.target.matches('input,button,select,textarea'))return;
    const k=e.key,pan=(dx,dy)=>{const s=M.pixelSize(view,W,H)*W/6;animateTo({x:view.x+dx*s,y:view.y+dy*s,zoom:view.zoom});};
    if(k==='+'||k==='=')zoomBy(2);
    else if(k==='-'||k==='_')zoomBy(0.5);
    else if(k==='0'||k==='Home')jump(HOME);
    else if(k==='c'||k==='C')setCycling(!cycling);
    else if(k==='p'||k==='P'){const keys=Object.keys(M.PALETTES);setPalette(keys[(keys.indexOf(palette)+1)%keys.length]);}
    else if(k==='ArrowLeft')pan(-1,0);else if(k==='ArrowRight')pan(1,0);
    else if(k==='ArrowUp')pan(0,1);else if(k==='ArrowDown')pan(0,-1);
    else return;
    e.preventDefault();
  });
  document.addEventListener('keyup',e=>{if(e.key==='Shift')board.classList.remove('shift');});
  window.addEventListener('blur',()=>board.classList.remove('shift'));
  new ResizeObserver(resize).observe(document.querySelector('.board-frame'));
  buildPalettes();setPalette(palette);makeWorkers();resize();
})();
