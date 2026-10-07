(function(){
  const G=Galton,$=id=>document.getElementById(id);
  const board=$('board'),ctx=board.getContext('2d');
  const RATES=[1,2,5,10,20,50,100,200,400];
  const DROP=0.3,HOP=0.12,BURST_RATE=400,MAX_FLIGHT=1500,PEG_FLASH=260,BIN_FLASH=420;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const fmt=new Intl.NumberFormat('en-US');

  let rows=12,p=0.5,pmf=G.binomial(rows,p),counts=new Array(rows+1).fill(0),total=0;
  let balls=[],queue=0,playing=false,rate=RATES[4],carry=0,running=false,last=0;
  let pegHit=new Float64Array(0),binHit=new Float64Array(0),lastFlash=-1e9;
  let colors={},dpr=1,W=0,H=0,L={},unit=0,dirty=true;

  function readColors(){
    const s=getComputedStyle(document.documentElement),v=n=>s.getPropertyValue(n).trim();
    colors={in:v('--in'),out:v('--out'),text:v('--text'),muted:v('--muted'),border:v('--border'),surface:v('--surface'),board:v('--board'),bg:v('--bg'),accent:v('--accent'),good:v('--good')};
  }
  function alpha(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}

  // Peg r·k sits in row r (0 at the top), k pegs from the left. Row `rows` is the mouth of the bins.
  function layout(){
    const top=H*0.11,binTop=H*0.6,dy=(binTop-top)/rows,dx=Math.min(W*0.92/(rows+1),dy*1.25);
    const ballR=Math.min(dx*0.2,dy*0.28,W*0.016),pegR=Math.max(1.5*dpr,ballR*0.5);
    L={cx:W/2,top,binTop,floor:H*0.905,dx,dy,ballR,pegR,dia:2*ballR};
    if(!unit)unit=L.dia;
  }
  const pegX=(r,k)=>L.cx+(k-r/2)*L.dx,pegY=r=>L.top+r*L.dy,contactY=r=>pegY(r)-L.pegR-L.ballR*0.9;
  const pegIndex=(r,k)=>r*(r+1)/2+k;

  // Where a ball is at time `now`: a short free fall onto the top peg, a parabolic hop per row, then a drop into its bin.
  function place(b,now){
    const t=(now-b.t0)/1000,dy=L.dy,h=b.hf*dy;
    if(t<DROP){const s=t/DROP;return [L.cx+b.jx*(1-s),H*0.03+(contactY(0)-H*0.03)*s*s,-1];}
    const u=t-DROP,seg=Math.floor(u/b.hop);
    if(seg<rows){
      const s=u/b.hop-seg,x0=pegX(seg,b.route[seg]),x1=pegX(seg+1,b.route[seg+1]);
      return [x0+(x1-x0)*s,contactY(seg)+dy*s-4*h*s*(1-s),seg];
    }
    const tf=u-rows*b.hop,v0=(dy+4*h)/b.hop,g=8*h/(b.hop*b.hop);
    return [pegX(rows,b.route[rows]),contactY(rows)+v0*tf+0.5*g*tf*tf,rows];
  }
  const pileTop=k=>L.floor-counts[k]*unit-L.ballR;

  function land(k,now){counts[k]++;total++;binHit[k]=now;lastFlash=now;dirty=true;}
  function spawn(n,now,dt){
    for(let i=0;i<n;i++){
      if(reducedMotion.matches||balls.length>=MAX_FLIGHT){land(G.drop(rows,p,Math.random),now);continue;}
      balls.push({route:G.route(rows,p,Math.random),t0:now-Math.random()*dt*1000,hop:HOP*(0.88+Math.random()*0.24),hf:0.22+Math.random()*0.12,jx:(Math.random()-0.5)*L.dx*0.5,seg:-1});
    }
  }
  function instant(n,now){for(let i=0;i<n;i++)counts[G.drop(rows,p,Math.random)]++;total+=n;binHit.fill(now);lastFlash=now;dirty=true;}
  function step(now){
    const keep=[];
    for(const b of balls){
      const [x,y,seg]=place(b,now);
      for(let r=b.seg+1;r<=Math.min(seg,rows-1);r++){pegHit[pegIndex(r,b.route[r])]=now;lastFlash=now;}
      b.seg=seg;b.x=x;b.y=y;
      const k=b.route[rows];
      if(seg===rows&&y>=pileTop(k))land(k,now);else keep.push(b);
    }
    balls=keep;
  }

  function targetUnit(){
    const most=Math.max(1,...counts,total*Math.max(...pmf));
    return Math.min(L.dia,(L.floor-L.binTop-L.dia)/most);
  }
  function roundRectTop(x,y,w,h,r){r=Math.min(r,w/2,h);ctx.moveTo(x,y+h);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h);ctx.closePath();}
  function draw(now){
    const {cx,dx,floor,binTop,ballR,pegR,dia}=L,s=dpr;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle=colors.board;ctx.beginPath();ctx.roundRect(0,0,W,H,14*s);ctx.fill();
    // Funnel and the per-peg odds.
    ctx.strokeStyle=alpha(colors.muted,0.6);ctx.lineWidth=1.5*s;ctx.lineCap='round';ctx.beginPath();
    ctx.moveTo(cx-dx*0.9-ballR*3,H*0.012);ctx.lineTo(cx-ballR*1.8,H*0.068);ctx.moveTo(cx+dx*0.9+ballR*3,H*0.012);ctx.lineTo(cx+ballR*1.8,H*0.068);ctx.stroke();
    ctx.font=`${11*s}px ui-monospace, SFMono-Regular, Menlo, monospace`;ctx.textBaseline='middle';ctx.fillStyle=colors.muted;
    ctx.textAlign='right';ctx.fillText(`← ${(1-p).toFixed(2)}`,cx-Math.max(dx*0.7,pegR+10*s),pegY(0));
    ctx.textAlign='left';ctx.fillText(`${p.toFixed(2)} →`,cx+Math.max(dx*0.7,pegR+10*s),pegY(0));
    // Pegs flash when struck.
    for(let r=0;r<rows;r++)for(let k=0;k<=r;k++){
      const f=Math.max(0,1-(now-pegHit[pegIndex(r,k)])/PEG_FLASH),x=pegX(r,k),y=pegY(r);
      if(f>0){ctx.fillStyle=alpha(colors.accent,0.25*f);ctx.beginPath();ctx.arc(x,y,pegR*(2+1.5*f),0,Math.PI*2);ctx.fill();}
      ctx.fillStyle=f>0?colors.accent:alpha(colors.muted,0.75);ctx.beginPath();ctx.arc(x,y,pegR*(1+0.35*f),0,Math.PI*2);ctx.fill();
    }
    // Bins.
    const left=cx-(rows/2+0.5)*dx,right=cx+(rows/2+0.5)*dx;
    ctx.strokeStyle=alpha(colors.muted,0.45);ctx.lineWidth=s;ctx.beginPath();
    for(let k=0;k<=rows+1;k++){const x=left+k*dx;ctx.moveTo(x,binTop-L.dy*0.25);ctx.lineTo(x,floor);}
    ctx.stroke();ctx.strokeStyle=alpha(colors.muted,0.8);ctx.lineWidth=1.5*s;ctx.beginPath();ctx.moveTo(left,floor);ctx.lineTo(right,floor);ctx.stroke();
    const circles=unit>=dia*0.995;
    for(let k=0;k<=rows;k++){
      const c=counts[k];if(!c)continue;
      const x=pegX(rows,k),f=Math.max(0,1-(now-binHit[k])/BIN_FLASH);
      if(circles){
        ctx.fillStyle=alpha(colors.in,0.8+0.2*f);ctx.beginPath();
        for(let j=0;j<c;j++){const y=floor-(j+0.5)*dia;ctx.moveTo(x+ballR*0.92,y);ctx.arc(x,y,ballR*0.92,0,Math.PI*2);}
        ctx.fill();
      }else{
        const w=Math.min(dx*0.78,dx-3*s),h=c*unit;
        ctx.fillStyle=alpha(colors.in,0.55+0.35*f);ctx.beginPath();roundRectTop(x-w/2,floor-h,w,h,Math.min(ballR,6*s));ctx.fill();
      }
    }
    // Expected counts: binomial ticks and the normal curve, scaled to the balls that have landed.
    const th=G.theory(rows,p);
    if(total){
      ctx.save();ctx.beginPath();ctx.rect(0,binTop-L.dy,W,floor-binTop+L.dy);ctx.clip();
      ctx.setLineDash([5*s,4*s]);ctx.strokeStyle=alpha(colors.good,0.85);ctx.lineWidth=1.5*s;ctx.beginPath();
      for(let i=0;i<=240;i++){const k=-0.5+(rows+1)*i/240,y=floor-total*G.normalPdf(k,th.mean,th.sd)*unit,x=pegX(rows,k);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
      ctx.stroke();ctx.setLineDash([]);
      ctx.strokeStyle=colors.good;ctx.lineWidth=2.5*s;ctx.beginPath();
      for(let k=0;k<=rows;k++){const x=pegX(rows,k),y=floor-total*pmf[k]*unit,w=Math.min(dx*0.62,dx-4*s)/2;ctx.moveTo(x-w,y);ctx.lineTo(x+w,y);}
      ctx.stroke();ctx.restore();
    }
    // Mean markers under the floor, then bin numbers.
    const tri=(x,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x,floor+3*s);ctx.lineTo(x-5*s,floor+11*s);ctx.lineTo(x+5*s,floor+11*s);ctx.closePath();ctx.fill();};
    tri(pegX(rows,th.mean),colors.good);
    const st=G.stats(counts);if(st.total)tri(pegX(rows,st.mean),colors.in);
    ctx.fillStyle=colors.muted;ctx.textAlign='center';ctx.textBaseline='top';ctx.font=`${(dx<20*s?9:11)*s}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    const every=dx<14*s?2:1;
    for(let k=0;k<=rows;k+=every)ctx.fillText(String(k),pegX(rows,k),floor+15*s);
    // Balls in flight.
    ctx.fillStyle=colors.in;ctx.beginPath();
    for(const b of balls){ctx.moveTo(b.x+ballR,b.y);ctx.arc(b.x,b.y,ballR,0,Math.PI*2);}
    ctx.fill();
    ctx.fillStyle=alpha(colors.bg,0.45);ctx.beginPath();
    for(const b of balls){ctx.moveTo(b.x-ballR*0.25+ballR*0.3,b.y-ballR*0.35);ctx.arc(b.x-ballR*0.25,b.y-ballR*0.35,ballR*0.3,0,Math.PI*2);}
    ctx.fill();
  }

  const f2=v=>Number.isFinite(v)?v.toFixed(2):'–';
  function updateReadout(){
    const st=G.stats(counts),th=G.theory(rows,p),P=p.toFixed(2);
    $('total').textContent=fmt.format(total);
    $('mean').textContent=f2(st.mean);$('sd').textContent=f2(st.sd);$('mean-t').textContent=f2(th.mean);$('sd-t').textContent=f2(th.sd);
    $('formula').innerHTML=`np = ${rows} × ${P} = <b class="g">${f2(th.mean)}</b><br>√(np(1 − p)) = √(${rows} × ${P} × ${(1-p).toFixed(2)}) = <b class="g">${f2(th.sd)}</b>`;
    if(total<2){$('verdict').textContent='Watch the pile grow.';return;}
    const se=th.sd/Math.sqrt(total),z=Math.abs(st.mean-th.mean)/se;
    $('verdict').textContent=`Mean is ${Math.abs(st.mean-th.mean).toFixed(2)} from np, ${z.toFixed(1)} standard errors (σ/√N = ${se.toPrecision(2)}). ${z<2?'Well within the noise.':z<3?'A little unusual.':'Rare, but it happens.'}`;
  }

  function frame(now){
    const dt=Math.min(0.1,(now-last)/1000);last=now;
    let n=0;
    if(playing){carry+=rate*dt;n=Math.floor(carry);carry-=n;}
    if(queue){const take=Math.min(queue,Math.max(1,Math.round(BURST_RATE*dt)));queue-=take;n+=take;}
    if(n)spawn(n,now,dt);
    step(now);
    const target=targetUnit(),moving=Math.abs(target-unit)/target>1e-3;
    if(moving)unit*=reducedMotion.matches?target/unit:Math.pow(target/unit,0.12);
    draw(now);
    if(dirty){updateReadout();dirty=false;}
    if(playing||queue||balls.length||moving||now-lastFlash<BIN_FLASH)requestAnimationFrame(frame);else running=false;
  }
  function kick(){if(!running){running=true;last=performance.now();requestAnimationFrame(frame);}}

  function setPlaying(on){
    playing=on;carry=on?1:0;const b=$('play');b.setAttribute('aria-pressed',String(on));
    b.querySelector('.icon').textContent=on?'❚❚':'▶';b.querySelector('.text').textContent=on?'Pause':'Play';kick();
  }
  function reset(){
    pmf=G.binomial(rows,p);counts=new Array(rows+1).fill(0);total=0;balls=[];queue=0;
    pegHit=new Float64Array(pegIndex(rows,0)).fill(-1e9);binHit=new Float64Array(rows+1).fill(-1e9);
    if(W)layout();unit=L.dia||0;dirty=true;kick();
  }
  function setBoard(){
    p=Number($('p').value);rows=Number($('rows').value);
    $('p-label').textContent=`p = ${p.toFixed(2)}`;$('rows-label').textContent=`n = ${rows}`;
    document.querySelectorAll('[data-p]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.p)===p&&Number(b.dataset.rows)===rows)));
    reset();
  }
  function setRate(){rate=RATES[$('rate').value];$('rate-label').textContent=`${rate} / s`;}
  function burst(n,isInstant){if(isInstant||reducedMotion.matches&&n>1)instant(n,performance.now());else queue+=n;kick();}
  function resize(){
    dpr=Math.min(2,window.devicePixelRatio||1);
    const r=board.getBoundingClientRect(),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);
    if(w&&h&&(w!==W||h!==H)){const old=L.dia;W=board.width=w;H=board.height=h;layout();unit=old?unit*L.dia/old:L.dia;}
    dirty=true;kick();
  }

  $('play').onclick=()=>setPlaying(!playing);
  $('reset').onclick=reset;
  document.querySelectorAll('[data-burst]').forEach(b=>b.onclick=()=>burst(Number(b.dataset.burst),b.hasAttribute('data-instant')));
  document.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{$('p').value=b.dataset.p;$('rows').value=b.dataset.rows;setBoard();});
  board.addEventListener('click',()=>burst(1));
  $('rate').addEventListener('input',setRate);
  $('p').addEventListener('input',setBoard);$('rows').addEventListener('input',setBoard);
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.target.matches('input,button,select,textarea'))return;
    if(e.key===' '){e.preventDefault();setPlaying(!playing);}
    else if(e.key==='b'||e.key==='B')burst(500);
    else if(e.key==='r'||e.key==='R')reset();
    else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();$('p').value=Math.min(0.95,Math.max(0.05,p+(e.key==='ArrowRight'?0.05:-0.05))).toFixed(2);setBoard();}
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{readColors();dirty=true;kick();});
  new ResizeObserver(resize).observe(document.querySelector('.board-frame'));
  readColors();setRate();setBoard();resize();setPlaying(true);
})();
