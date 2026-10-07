(function(){
  const C=ChaosGame,$=id=>document.getElementById(id);
  const board=$('board'),hint=$('board-hint'),bctx=board.getContext('2d');
  const RATES=[1,2,5,10,30,100,300,1000,3000,10000,30000,100000],ANIMATE_MAX=10,RAMP_TO=9;
  const STORE_CAP=1200000,FRAME_CAP=100000,DRAG_POINTS=30000,EDIT_POINTS=80000,SCALE=0.86,LETTERS='ABCDEF',FERN_SHORT=['Stem','Body','Left','Right'];
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const fmt=new Intl.NumberFormat('en-US'),compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});

  let preset='triangle',cfg={},vertices=[],st=null,total=0,stored=0;
  const xs=new Float32Array(STORE_CAP),ys=new Float32Array(STORE_CAP),vs=new Uint8Array(STORE_CAP);
  let playing=false,rate=RATES[1],carry=0,pending=0,anim=null,ripples=[],ramp=null,running=false,last=0,lastJump=null;
  let dragging=-1,dragDirty=false,colors={},dpr=1,size=0,layer=document.createElement('canvas'),lctx=layer.getContext('2d'),dirty=true,toastTimer=0;

  // World coordinates span [-1, 1]² with y pointing up.
  const pad=()=>size*0.035,side=()=>size-2*pad();
  const toPx=v=>pad()+(v+1)/2*side(),toPy=v=>pad()+(1-v)/2*side();
  const fromPx=X=>(X-pad())/side()*2-1,fromPy=Y=>1-(Y-pad())/side()*2;
  // Early points are large so the first jumps read clearly; later ones shrink so density shows.
  const radius=i=>side()*Math.max(0.0011,0.0075/Math.pow(1+i/120,0.45));
  const pos=()=>cfg.fern?[(st.x-0.237)*0.19,st.y*0.19-0.95]:[st.x,st.y];
  const vColor=i=>colors.v[i%colors.v.length];
  const ratioText=r=>Math.abs(r-0.5)<5e-4?'½':Math.abs(r-2/3)<5e-4?'⅔':r.toFixed(3);

  function readColors(){
    const s=getComputedStyle(document.documentElement),v=n=>s.getPropertyValue(n).trim();
    colors={text:v('--text'),muted:v('--muted'),border:v('--border'),board:v('--board'),bg:v('--bg'),accent:v('--accent'),v:[0,1,2,3,4,5].map(i=>v(`--v${i}`))};
  }
  function alpha(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}
  function toast(text){const t=$('toast');t.textContent=text;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600);}

  // ----- Points -----
  // The first jumps of a bulk run are still converging, so they are drawn small rather than as big strays.
  function paintPoints(ctx,from,count,px,py,pv){
    const a=from<3000?0.9:from<60000?0.6:0.4,groups=cfg.fern?4:vertices.length;
    for(let g=0;g<groups;g++){
      ctx.fillStyle=alpha(vColor(g),a);let path=null;
      for(let k=0;k<count;k++){
        if(pv[k]!==g)continue;
        const i=from+k,r=radius(count>1&&i<20?4000:i),X=toPx(px[k]),Y=toPy(py[k]);
        if(i<3000){path??=new Path2D();path.moveTo(X+r,Y);path.arc(X,Y,r,0,Math.PI*2);}else ctx.fillRect(X-r,Y-r,2*r,2*r);
      }
      if(path)ctx.fill(path);
    }
  }
  function rebuildLayer(){
    const old=layer;layer=document.createElement('canvas');layer.width=layer.height=size;lctx=layer.getContext('2d');
    if(stored===total){for(let s=0;s<stored;s+=FRAME_CAP){const n=Math.min(FRAME_CAP,stored-s);paintPoints(lctx,s,n,xs.subarray(s,s+n),ys.subarray(s,s+n),vs.subarray(s,s+n));}}
    else if(old.width)lctx.drawImage(old,0,0,size,size);
    dirty=true;
  }
  function advance(){return cfg.fern?C.fernStep(st,Math.random):C.step(st,vertices,cfg.r,cfg.rule,Math.random);}
  function store(x,y,v){if(stored<STORE_CAP&&stored===total){xs[stored]=x;ys[stored]=y;vs[stored]=v;stored++;}total++;}
  const sx=new Float32Array(FRAME_CAP),sy=new Float32Array(FRAME_CAP),sv=new Uint8Array(FRAME_CAP);
  function addPoints(n){
    for(let s=0;s<n;s+=FRAME_CAP){
      const count=Math.min(FRAME_CAP,n-s),first=total;let from=null;
      for(let k=0;k<count;k++){
        if(k===count-1)from=pos();
        const v=advance(),[x,y]=pos();sx[k]=x;sy[k]=y;sv[k]=v;store(x,y,v);
        if(k===count-1)lastJump={from,to:[x,y],v};
      }
      paintPoints(lctx,first,count,sx,sy,sv);
    }
    hint.classList.add('gone');dirty=true;
  }
  // A single animated jump: the point travels toward its corner and lands r of the way there.
  function startJump(now,dur){
    const from=pos(),v=advance(),to=pos();anim={from,to,v,t0:now,dur};hint.classList.add('gone');
  }
  function landJump(now){
    const {from,to,v}=anim;anim=null;
    sx[0]=to[0];sy[0]=to[1];sv[0]=v;paintPoints(lctx,total,1,sx,sy,sv);store(to[0],to[1],v);
    lastJump={from,to,v};
    if(!reducedMotion.matches)ripples.push({x:to[0],y:to[1],v,t:now,r:radius(total)});
    dirty=true;
  }

  // ----- Drawing -----
  function drawBoard(now){
    bctx.clearRect(0,0,size,size);
    bctx.fillStyle=colors.board;bctx.fillRect(0,0,size,size);
    bctx.drawImage(layer,0,0);
    const lw=Math.max(1,size/500);
    if(!cfg.fern){
      bctx.strokeStyle=alpha(colors.muted,0.45);bctx.lineWidth=lw;bctx.setLineDash([4*lw,5*lw]);bctx.beginPath();
      vertices.forEach(([x,y],i)=>i?bctx.lineTo(toPx(x),toPy(y)):bctx.moveTo(toPx(x),toPy(y)));bctx.closePath();bctx.stroke();bctx.setLineDash([]);
    }
    ripples=ripples.filter(r=>now-r.t<600);
    for(const r of ripples){
      const t=(now-r.t)/600,e=1-Math.pow(1-t,3);
      bctx.strokeStyle=alpha(vColor(r.v),0.9*(1-t));bctx.lineWidth=Math.max(1.5,size/350)*(1-t*0.5);
      bctx.beginPath();bctx.arc(toPx(r.x),toPy(r.y),r.r*(1.2+e*4),0,Math.PI*2);bctx.stroke();
    }
    // The jump in flight: a dashed line to the corner, the path so far, and the landing spot.
    if(anim){
      const raw=Math.min(1,(now-anim.t0)/anim.dur),t=Math.min(1,raw/0.75),e=t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
      const col=vColor(anim.v),[fx,fy]=anim.from,[tx,ty]=anim.to,target=cfg.fern?anim.to:vertices[anim.v];
      const cx=fx+(tx-fx)*e,cy=fy+(ty-fy)*e;
      bctx.strokeStyle=alpha(col,0.75);bctx.lineWidth=1.5*lw;bctx.setLineDash([5*lw,5*lw]);
      bctx.beginPath();bctx.moveTo(toPx(fx),toPy(fy));bctx.lineTo(toPx(target[0]),toPy(target[1]));bctx.stroke();bctx.setLineDash([]);
      bctx.strokeStyle=col;bctx.lineWidth=3*lw;bctx.beginPath();bctx.moveTo(toPx(fx),toPy(fy));bctx.lineTo(toPx(cx),toPy(cy));bctx.stroke();
      bctx.strokeStyle=alpha(colors.text,0.6);bctx.lineWidth=lw*1.5;bctx.beginPath();bctx.arc(toPx(tx),toPy(ty),size*0.011,0,Math.PI*2);bctx.stroke();
      if(!cfg.fern){bctx.strokeStyle=alpha(col,0.5*(1-t));bctx.lineWidth=2*lw;bctx.beginPath();bctx.arc(toPx(target[0]),toPy(target[1]),size*(0.02+0.03*t),0,Math.PI*2);bctx.stroke();}
      dot(cx,cy,col);
    }else if(total&&!cfg.fern&&rate<=ANIMATE_MAX&&!pending)dot(...pos(),colors.text);
    if(!cfg.fern){
      const cxm=vertices.reduce((s,v)=>s+v[0],0)/vertices.length,cym=vertices.reduce((s,v)=>s+v[1],0)/vertices.length;
      bctx.font=`600 ${Math.round(size*0.03)}px ui-monospace, SFMono-Regular, Menlo, monospace`;bctx.textAlign='center';bctx.textBaseline='middle';
      vertices.forEach(([x,y],i)=>{
        const X=toPx(x),Y=toPy(y),hot=i===dragging;
        bctx.fillStyle=vColor(i);bctx.beginPath();bctx.arc(X,Y,size*(hot?0.019:0.014),0,Math.PI*2);bctx.fill();
        bctx.strokeStyle=colors.board;bctx.lineWidth=2.5*lw;bctx.stroke();
        const dx=x-cxm,dy=y-cym,d=Math.hypot(dx,dy)||1;
        bctx.fillStyle=colors.text;bctx.fillText(LETTERS[i],toPx(x+dx/d*0.075),toPy(y+dy/d*0.075));
      });
    }
  }
  function dot(x,y,col){
    bctx.fillStyle=col;bctx.beginPath();bctx.arc(toPx(x),toPy(y),size*0.009,0,Math.PI*2);bctx.fill();
    bctx.strokeStyle=colors.board;bctx.lineWidth=Math.max(1.5,size/300);bctx.stroke();
  }
  const fmtNum=v=>(v<0?'−':'')+Math.abs(v).toFixed(3);
  const pt=([x,y])=>`(${fmtNum(x)}, ${fmtNum(y)})`;
  function updateReadout(){
    $('total').textContent=fmt.format(total);
    const j=lastJump;
    if(cfg.fern){
      $('last').innerHTML=j?`<i class="swatch" style="background:${vColor(j.v)}"></i>${FERN_SHORT[j.v]}`:'–';
      if(j){
        const f=C.FERN[j.v],[a,b,c,d,e,g]=f.m;
        const lin=terms=>{let out='';for(const [k,sym] of terms){if(!k)continue;const mag=Math.abs(k)+sym;out+=out?(k<0?' − ':' + ')+mag:(k<0?'−':'')+mag;}return out||'0';};
        const [fx,fy]=[lin([[a,'x'],[b,'y'],[e,'']]),lin([[c,'x'],[d,'y'],[g,'']])];
        $('formula').innerHTML=`<i style="color:${vColor(j.v)}">${f.name}</i>, picked ${Math.round(f.p*100)}% of the time:<br>(x, y) → (${fx}, ${fy})`;
      }else $('formula').innerHTML='Each step applies one of four affine maps<br>(x, y) → (ax + by + e, cx + dy + f)';
      return;
    }
    $('last').innerHTML=j?`<i class="swatch" style="background:${vColor(j.v)}"></i>${LETTERS[j.v]}`:'–';
    $('formula').innerHTML=j?`p ← p + ${ratioText(cfg.r)} × (<i style="color:${vColor(j.v)}">${LETTERS[j.v]}</i> − p)<br>${pt(j.from)} → <b>${pt(j.to)}</b>`
      :`p ← p + r × (corner − p)<br>Start anywhere. Jump ${ratioText(cfg.r)} of the way to a random corner.`;
  }

  // ----- Loop -----
  function frame(now){
    const dt=Math.min(0.1,(now-last)/1000);last=now;
    if(dragDirty){dragDirty=false;regenerate(DRAG_POINTS);}
    const slow=rate<=ANIMATE_MAX&&!reducedMotion.matches;
    if(anim&&now-anim.t0>=anim.dur)landJump(now);
    if(playing){
      if(slow){if(!anim)startJump(now,1000/rate);}
      else{carry+=rate*dt;const n=Math.floor(carry);carry-=n;if(n)addPoints(n);}
      if(ramp&&now>=ramp.next){
        const idx=Number($('speed').value);
        if(idx<RAMP_TO){$('speed').value=idx+1;setRate();ramp.next=now+(idx<3?2600:1400);}else ramp=null;
      }
    }
    if(pending){const take=Math.min(pending,Math.max(2000,Math.ceil(pending/12)),FRAME_CAP);pending-=take;addPoints(take);}
    drawBoard(now);
    if(dirty){updateReadout();dirty=false;}
    if(playing||pending||anim||ripples.length||dragDirty)requestAnimationFrame(frame);else running=false;
  }
  function kick(){if(!running){running=true;last=performance.now();requestAnimationFrame(frame);}}

  function setPlaying(on){
    playing=on;carry=on?1:0;const b=$('play');b.setAttribute('aria-pressed',String(on));
    b.querySelector('.icon').textContent=on?'❚❚':'▶';b.querySelector('.text').textContent=on?'Pause':'Play';
    if(on){hint.classList.add('gone');if(!total&&!anim&&Number($('speed').value)<RAMP_TO)ramp={next:performance.now()+3200};}
    else ramp=null;
    kick();
  }
  function clearPoints(){
    total=stored=0;pending=0;anim=null;ripples=[];lastJump=null;carry=0;
    st=cfg.fern?{x:0,y:0,prev:-1}:C.start(Math.random);
    if(!cfg.fern){st.x*=SCALE*0.6;st.y*=SCALE*0.6;}
    lctx.clearRect(0,0,size,size);dirty=true;
  }
  function reset(){clearPoints();ramp=null;if(!playing)hint.classList.remove('gone');kick();}
  // Edits redraw the picture straight away so you can see what the change did.
  function regenerate(n){clearPoints();addPoints(n);kick();}
  function burst(n){
    if(n===1&&!reducedMotion.matches){if(anim)landJump(performance.now());startJump(performance.now(),650);kick();return;}
    pending+=n;kick();
  }

  function applyPreset(key,quiet){
    preset=key;cfg={...C.PRESETS[key]};
    document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===key)));
    vertices=cfg.fern?[]:C.polygon(cfg.k,cfg.turn).map(([x,y])=>[x*SCALE,y*SCALE]);
    $('tuning').classList.toggle('off',!!cfg.fern);$('r').disabled=$('rule').disabled=!!cfg.fern;
    if(!cfg.fern){$('r').value=cfg.r;$('rule').value=cfg.rule;}
    $('last-label').textContent=cfg.fern?'Last map':'Last corner';$('ratio-label').textContent=cfg.fern?'Maps':'Jump r';
    updateRatio();buildLegend();
    if(quiet)clearPoints();else regenerate(EDIT_POINTS);
  }
  function updateRatio(){
    const text=cfg.fern?'4':cfg.r.toFixed(3);$('ratio').textContent=text;$('r-label').textContent=cfg.fern?'–':text;
  }
  function buildLegend(){
    const items=cfg.fern?C.FERN.map((f,i)=>`<span><i class="swatch" style="background:var(--v${i})"></i>${f.name}</span>`)
      :vertices.map((_,i)=>`<span><i class="swatch" style="background:var(--v${i})"></i>Toward <b>${LETTERS[i]}</b></span>`);
    $('legend').innerHTML=items.join('');
  }

  function resize(){
    dpr=Math.min(2,window.devicePixelRatio||1);
    const b=board.getBoundingClientRect(),next=Math.round(b.width*dpr);
    if(next&&next!==size){size=board.width=board.height=next;rebuildLayer();ripples=[];}
    dirty=true;kick();
  }
  function setRate(){rate=RATES[$('speed').value];$('speed-label').textContent=`${rate>=1000?compact.format(rate):rate} / s`;}

  // ----- Input -----
  function eventPoint(e){const r=board.getBoundingClientRect();return [(e.clientX-r.left)*dpr,(e.clientY-r.top)*dpr];}
  function vertexAt(e){
    if(cfg.fern)return -1;
    const [X,Y]=eventPoint(e),reach=Math.max(22*dpr,size*0.04);let best=-1,bestD=reach;
    vertices.forEach(([x,y],i)=>{const d=Math.hypot(toPx(x)-X,toPy(y)-Y);if(d<bestD){bestD=d;best=i;}});
    return best;
  }
  board.addEventListener('pointerdown',e=>{
    const i=vertexAt(e);
    if(i<0){burst(1);return;}
    dragging=i;try{board.setPointerCapture(e.pointerId);}catch{}board.classList.add('grabbing');e.preventDefault();dirty=true;kick();
  });
  board.addEventListener('pointermove',e=>{
    if(dragging<0){board.classList.toggle('grab',vertexAt(e)>=0);return;}
    const [X,Y]=eventPoint(e),clamp=v=>Math.max(-0.95,Math.min(0.95,v));
    vertices[dragging]=[clamp(fromPx(X)),clamp(fromPy(Y))];dragDirty=true;kick();
  });
  const endDrag=()=>{if(dragging<0)return;dragging=-1;board.classList.remove('grabbing');regenerate(EDIT_POINTS);};
  board.addEventListener('pointerup',endDrag);board.addEventListener('pointercancel',endDrag);

  $('play').onclick=()=>setPlaying(!playing);
  hint.onclick=()=>setPlaying(true);
  $('reset').onclick=reset;
  document.querySelectorAll('[data-burst]').forEach(b=>b.onclick=()=>burst(Number(b.dataset.burst)));
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>applyPreset(b.dataset.preset));
  $('speed').addEventListener('input',()=>{ramp=null;setRate();});
  $('r').addEventListener('input',()=>{cfg.r=Number($('r').value);updateRatio();regenerate(EDIT_POINTS);});
  $('rule').addEventListener('change',()=>{cfg.rule=$('rule').value;regenerate(EDIT_POINTS);});
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.target.matches('input,button,select,textarea'))return;
    const keys=Object.keys(C.PRESETS),n=Number(e.key);
    if(e.key===' '){e.preventDefault();setPlaying(!playing);}
    else if(e.key==='r'||e.key==='R')reset();
    else if(n>=1&&n<=keys.length)applyPreset(keys[n-1]);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{readColors();rebuildLayer();kick();});
  new ResizeObserver(resize).observe(document.querySelector('.board-frame'));
  readColors();setRate();applyPreset('triangle',true);resize();
})();
