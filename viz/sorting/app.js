(function(){
  const S=Sorts,$=id=>document.getElementById(id);
  const race=$('race'),hint=$('board-hint');
  const RATES=[10,20,40,80,120,240,480,1000,2500,6000],ORDER=['bubble','insertion','selection','merge','quick','heap'];
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const fmt=new Intl.NumberFormat('en-US');
  const ordinal=n=>n+(['th','st','nd','rd'][n%100>10&&n%100<14?0:n%10]||'th');

  let lanes=[],input=[],inputType='random',size=48,ticks=0;
  let playing=false,rate=RATES[4],carry=0,running=false,last=0,dirty=true;
  let colors={},dpr=1,audio=null,toastTimer=0;

  function readColors(){
    const s=getComputedStyle(document.documentElement),v=n=>s.getPropertyValue(n).trim();
    colors={accent:v('--accent'),out:v('--out'),text:v('--text'),muted:v('--muted'),border:v('--border'),board:v('--board'),good:v('--good')};
  }

  // One lane per algorithm: its own copy of the input, a generator of events, and DOM for its counts.
  function buildLanes(){
    for(const key of ORDER){
      const el=document.createElement('section');el.className='lane';
      el.innerHTML=`<div class="lane-head"><span class="lane-name">${S.ALGORITHMS[key].name}<span class="lane-big">${S.ALGORITHMS[key].big}</span></span><span class="place"></span></div>
        <canvas role="img" aria-label="${S.ALGORITHMS[key].name} bars"></canvas>
        <div class="lane-stats"><span><b class="c">0</b> compares</span><span><b class="w">0</b> writes</span></div>`;
      race.appendChild(el);
      const canvas=el.querySelector('canvas');
      lanes.push({key,el,canvas,ctx:canvas.getContext('2d'),place:el.querySelector('.place'),c:el.querySelector('.c'),w:el.querySelector('.w')});
      new ResizeObserver(()=>resizeLane(lanes.find(l=>l.key===key))).observe(canvas);
    }
  }
  function resetLanes(){
    for(const l of lanes){
      l.a=input.slice();l.gen=S.ALGORITHMS[l.key].sort(l.a);l.compares=l.writes=l.steps=0;l.marks=[];
      l.done=false;l.finishTick=0;l.rank=0;l.doneAt=0;l.el.classList.remove('done','winner');l.place.textContent='';
    }
    ticks=0;dirty=true;
  }
  function newInput(){input=S.makeInput(inputType,size,Math.random);resetLanes();renderPodium();setStatus('Same bars, same clock. Press start.');hint.classList.remove('gone');setPlaying(false);kick();}

  // Advances every unfinished lane by one event, so all of them spend time at the same rate.
  function tick(now){
    ticks++;let finished=0;
    for(const l of lanes){
      if(l.done)continue;
      const {value:e,done}=l.gen.next();
      if(done){finish(l,now);finished++;continue;}
      l.steps++;
      if(e.type==='compare')l.compares++;else l.writes+=e.type==='swap'?2:1;
      l.marks.push(e);if(l.marks.length>3)l.marks.shift();
    }
    dirty=true;
    if(finished&&lanes.every(l=>l.done))allDone();
  }
  function finish(l,now){
    l.done=true;l.finishTick=l.steps;l.marks=[];l.doneAt=reducedMotion.matches?0:now;
    l.rank=1+lanes.filter(o=>o.done&&o!==l&&o.finishTick<l.finishTick).length;
    l.place.textContent=ordinal(l.rank);l.el.classList.add('done');if(l.rank===1)l.el.classList.add('winner');
    renderPodium(l.key);
    if(lanes.filter(o=>o.done).length===1)setStatus(`${S.ALGORITHMS[l.key].name} wins in ${fmt.format(l.finishTick)} ticks.`);
  }
  function allDone(){
    setPlaying(false);
    const byTicks=lanes.slice().sort((x,y)=>x.finishTick-y.finishTick),first=byTicks[0],lastLane=byTicks[byTicks.length-1];
    const ratio=lastLane.finishTick/Math.max(1,first.finishTick);
    setStatus(`${S.ALGORITHMS[first.key].name} won. ${S.ALGORITHMS[lastLane.key].name} took ${ratio.toFixed(1)}× as long.`);
    toast(`${S.ALGORITHMS[first.key].name} wins · press start for a new race`);
    $('play').querySelector('.text').textContent='Race again';
  }

  function renderPodium(fresh){
    const done=lanes.filter(l=>l.done).sort((x,y)=>x.finishTick-y.finishTick);
    const rows=done.map(l=>`<li class="${l.key===fresh?'new':''}"><span class="pos">${ordinal(l.rank)}</span><span class="who">${S.ALGORITHMS[l.key].name}</span><span class="when">${fmt.format(l.finishTick)} ticks</span></li>`);
    const left=lanes.length-done.length;
    if(left)rows.push(`<li class="pending"><span class="pos">${done.length?'…':'—'}</span><span class="who">${done.length?`${left} still sorting`:'Finish order appears here'}</span><span class="when"></span></li>`);
    $('podium').innerHTML=rows.join('');
  }
  function setStatus(t){$('status').textContent=t;}

  function drawLane(l,now){
    const {ctx,canvas:{width:w,height:h}}=l,n=l.a.length,max=Math.max(...input),bw=w/n,gap=n<=64?Math.max(1,bw*0.18):0;
    ctx.clearRect(0,0,w,h);
    const hot=new Map();
    for(const e of l.marks){const c=e.type==='compare'?colors.accent:colors.out;hot.set(e.i,c);if(e.j!==undefined)hot.set(e.j,c);}
    // When a lane finishes, a green sweep runs across its bars.
    const sweep=l.done?(l.doneAt?Math.min(1,(now-l.doneAt)/500):1):0;
    for(let i=0;i<n;i++){
      const bh=Math.max(dpr,l.a[i]/max*(h-2*dpr)),x=i*bw;
      const green=l.done&&i/n<=sweep;
      ctx.fillStyle=hot.get(i)||(green?colors.good:colors.muted);
      ctx.globalAlpha=hot.has(i)||green?1:0.42;
      ctx.fillRect(x+gap/2,h-bh,Math.max(1,bw-gap),bh);
    }
    ctx.globalAlpha=1;
    l.c.textContent=fmt.format(l.compares);l.w.textContent=fmt.format(l.writes);
    return l.done&&sweep<1;
  }

  function beep(){
    if(!audio||!$('sound').checked)return;
    const t=audio.currentTime,active=lanes.filter(l=>!l.done&&l.marks.length);
    for(const l of active.slice(0,3)){
      const e=l.marks[l.marks.length-1],v=l.a[e.i]/Math.max(...input);
      const o=audio.createOscillator(),g=audio.createGain();
      o.type='triangle';o.frequency.value=180+v*720;
      g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.05/active.length**0.5,t+0.005);g.gain.exponentialRampToValueAtTime(0.0001,t+0.07);
      o.connect(g).connect(audio.destination);o.start(t);o.stop(t+0.08);
    }
  }

  function frame(now){
    const dt=Math.min(0.1,(now-last)/1000);last=now;
    if(playing){carry+=rate*dt;let n=Math.floor(carry);carry-=n;while(n-->0&&playing)tick(now);if(dirty)beep();}
    let animating=false;
    if(dirty||lanes.some(l=>l.done&&l.doneAt&&now-l.doneAt<600)){for(const l of lanes)animating=drawLane(l,now)||animating;$('ticks').textContent=fmt.format(ticks);dirty=false;}
    if(playing||animating)requestAnimationFrame(frame);else running=false;
  }
  function kick(){if(!running){running=true;last=performance.now();requestAnimationFrame(frame);}}

  function setPlaying(on){
    if(on&&lanes.every(l=>l.done)){newInput();}
    playing=on;carry=on?1:0;const b=$('play');b.setAttribute('aria-pressed',String(on));
    b.querySelector('.icon').textContent=on?'❚❚':'▶';b.querySelector('.text').textContent=on?'Pause':ticks?'Resume':'Start';
    if(on){hint.classList.add('gone');if(!ticks)setStatus('Racing…');}
    kick();
  }
  function step(){
    if(lanes.every(l=>l.done))return;
    setPlaying(false);hint.classList.add('gone');tick(performance.now());beep();
    $('play').querySelector('.text').textContent='Resume';kick();
  }

  function toast(text){
    const t=$('toast');t.textContent=text;t.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2800);
  }

  function resizeLane(l){
    if(!l)return;
    dpr=Math.min(2,window.devicePixelRatio||1);
    const r=l.canvas.getBoundingClientRect();l.canvas.width=Math.round(r.width*dpr);l.canvas.height=Math.round(r.height*dpr);
    dirty=true;kick();
  }
  function setRate(){rate=RATES[$('speed').value];$('speed-label').textContent=`${fmt.format(rate)} ticks / s`;}
  function setSize(){size=Number($('size').value);$('size-label').textContent=size;}

  $('play').onclick=()=>setPlaying(!playing);
  hint.onclick=()=>setPlaying(true);
  $('step').onclick=step;$('shuffle').onclick=newInput;
  document.querySelectorAll('[data-input]').forEach(b=>b.onclick=()=>{
    inputType=b.dataset.input;document.querySelectorAll('[data-input]').forEach(o=>o.setAttribute('aria-pressed',String(o===b)));newInput();
  });
  $('speed').addEventListener('input',setRate);
  $('size').addEventListener('input',()=>{setSize();newInput();});
  $('sound').addEventListener('change',e=>{
    if(e.target.checked&&!audio){const A=window.AudioContext||window.webkitAudioContext;if(A)audio=new A();}
    if(audio&&e.target.checked)audio.resume();
  });
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.target.matches('input,button,select,textarea'))return;
    const k=e.key.toLowerCase();
    if(k===' '){e.preventDefault();setPlaying(!playing);}
    else if(k==='s'||k==='arrowright')step();
    else if(k==='r')newInput();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{readColors();dirty=true;kick();});
  readColors();setRate();setSize();buildLanes();newInput();
})();
