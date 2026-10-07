(function(){
  const M=MontyHall,$=id=>document.getElementById(id);
  const doorsEl=$('doors'),frame=document.querySelector('.doors-frame'),chart=$('chart'),cctx=chart.getContext('2d');
  const RATES=[1,3,10,30,100,300,1000,3000,10000,100000],FRAME_CAP=200000;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const fmt=new Intl.NumberFormat('en-US'),compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
  const pct=v=>Number.isFinite(v)?`${Math.round(v*100)}%`:'–';

  let n=3,game=null,phase='pick',timers=[],mine=M.tally(),streak=0;
  let sim=M.tally(),samples=[],nextSample=1,playing=false,rate=RATES[3],carry=0,pending=0,running=false,last=0;
  let colors={},dpr=1,view=2,dirty=true,toastTimer=0;

  function readColors(){
    const s=getComputedStyle(document.documentElement),v=k=>s.getPropertyValue(k).trim();
    colors={in:v('--in'),out:v('--out'),text:v('--text'),muted:v('--muted'),border:v('--border'),surface:v('--surface'),accent:v('--accent')};
  }
  function alpha(hex,a){const x=parseInt(hex.slice(1),16);return `rgba(${x>>16&255},${x>>8&255},${x&255},${a})`;}
  function toast(text){const t=$('toast');t.textContent=text;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600);}
  const later=(ms,fn)=>timers.push(setTimeout(fn,reducedMotion.matches?0:ms));
  const doorName=d=>`door ${d+1}`;

  // ----- Doors -----
  function buildDoors(){
    doorsEl.textContent='';
    for(let d=0;d<n;d++){
      const b=document.createElement('button');b.type='button';b.className='door';b.dataset.door=d;b.setAttribute('aria-label',`Door ${d+1}`);
      b.innerHTML=`<span class="prize" aria-hidden="true"></span><span class="leaf"><span class="num">${d+1}</span><span class="knob"></span></span><span class="tag"></span>`;
      b.onclick=()=>clickDoor(d);doorsEl.appendChild(b);
    }
    layoutDoors();
  }
  // Pick the column count that makes the doors as large as possible inside the frame.
  function layoutDoors(){
    const r=frame.getBoundingClientRect();if(!r.width)return;
    const pad=Math.max(16,r.width*0.06),W=r.width-2*pad,H=r.height-2*pad-(n<=12?18:0);
    let best={w:0,cols:n,gap:0};
    for(let cols=1;cols<=n;cols++){
      const rows=Math.ceil(n/cols),gap=Math.max(4,Math.min(20,W*0.12/cols));
      const w=Math.min((W-(cols-1)*gap)/cols,((H-(rows-1)*gap*1.4)/rows)/1.6);
      if(w>best.w)best={w,cols,gap};
    }
    doorsEl.style.setProperty('--cols',best.cols);doorsEl.style.setProperty('--door-w',`${Math.floor(best.w)}px`);
    doorsEl.style.setProperty('--gap',`${Math.floor(best.gap)}px ${Math.floor(best.gap*1.4)}px`);
    doorsEl.classList.toggle('tiny',best.w<46);
  }
  const doorEl=d=>doorsEl.children[d];
  function openDoor(d){const el=doorEl(d),car=d===game.car;el.querySelector('.prize').textContent=car?'🚗':'🐐';el.classList.add('open',car?'car-open':'goat-open');el.setAttribute('aria-label',`Door ${d+1}: ${car?'car':'goat'}`);}
  function setTag(d,text){doorEl(d).querySelector('.tag').textContent=text;}
  function setStatus(html,pop){const s=$('status');s.innerHTML=html;if(pop){s.classList.remove('pop');void s.offsetWidth;s.classList.add('pop');}}
  function setButtons(){
    const deciding=phase==='decide';$('stay').disabled=$('switch').disabled=!deciding;
    $('stay').hidden=$('switch').hidden=phase==='reveal';$('again').hidden=phase!=='reveal';
    $('stay').textContent=deciding?`Stay with ${game.pick+1}`:'Stay';$('switch').textContent=deciding?`Switch to ${game.kept+1}`:'Switch';
    for(const el of doorsEl.children)el.disabled=phase==='hosting'||el.classList.contains('goat-open')&&phase!=='reveal';
  }

  function newGame(){
    timers.forEach(clearTimeout);timers=[];
    game=M.newGame(n,Math.random);phase='pick';buildDoors();
    setStatus(n===3?'Pick a door. One of them hides a car.':`Pick one of the ${n} doors. One of them hides a car.`);setButtons();
  }
  function clickDoor(d){
    if(phase==='pick')choose(d);
    else if(phase==='decide'){if(d===game.pick)decide(false);else if(d===game.kept)decide(true);}
    else if(phase==='reveal')newGame();
  }
  function choose(d){
    M.choose(game,d,Math.random);phase='hosting';
    doorEl(d).classList.add('picked');setTag(d,'Your pick');setButtons();
    setStatus(`You picked <b>${doorName(d)}</b>. The host, who knows where the car is, opens ${n===3?'a door':`${n-2} doors`}…`);
    const k=game.opened.length,step=Math.min(320,900/k);
    game.opened.forEach((g,i)=>later(450+i*step,()=>openDoor(g)));
    later(450+k*step+350,()=>{
      phase='decide';doorEl(game.kept).classList.add('offer');setTag(game.kept,'Switch?');setButtons();
      const shown=n===3?`He opened <b>${doorName(game.opened[0])}</b>: a goat.`:`He opened <b>${n-2}</b> doors: all goats.`;
      setStatus(`${shown} Stay with <b>${doorName(game.pick)}</b>, or switch to <b>${doorName(game.kept)}</b>?`,true);
    });
  }
  function decide(doSwitch){
    const win=M.decide(game,doSwitch),other=doSwitch?game.pick:game.kept;phase='reveal';
    M.record(mine,doSwitch?'switch':'stay',win);
    doorEl(other).classList.remove('offer');doorEl(game.pick).classList.remove('picked');doorEl(game.final).classList.add('picked');
    setTag(game.pick,'');setTag(game.kept,'');setTag(game.final,doSwitch?'Switched':'Stayed');setButtons();
    for(const el of doorsEl.children)el.disabled=false;
    openDoor(game.final);
    later(700,()=>openDoor(other));
    const verb=doSwitch?'switched':'stayed';
    setStatus(win?`<span class="win">You ${verb} and won the car!</span>`:`<span class="lose">You ${verb} and got a goat.</span> The car was behind ${doorName(game.car)}.`,true);
    updateMine();
    const total=mine.stay.games+mine.switch.games;
    streak=win&&doSwitch?streak+1:0;
    if(total===10)toast(`10 games in. Switching: ${pct(M.rate(mine.switch))}. Staying: ${pct(M.rate(mine.stay))}.`);
    else if(streak===3)toast('Three switches, three cars. Not a coincidence.');
    $('again').focus({preventScroll:true});
  }
  function updateMine(){
    for(const s of ['switch','stay']){
      const t=mine[s],r=M.rate(t);
      $(`bar-${s}`).style.width=t.games?`${r*100}%`:'0';$(`rate-${s}`).textContent=pct(r);
      $(`mark-${s}`).style.left=`${M.winProbability(n,s)*100}%`;$(`${s}-wins`).textContent=`${fmt.format(t.wins)} / ${fmt.format(t.games)}`;
    }
    $('games').textContent=fmt.format(mine.stay.games+mine.switch.games);
    $('formula').innerHTML=`Staying wins <b class="st">1 in ${n}</b>. Switching wins <b class="sw">${n-1} in ${n}</b>. The dashed marks show these odds.`;
  }

  // ----- Simulation -----
  function simulate(k){
    for(let i=0;i<k;i++){
      M.record(sim,'stay',M.play(n,'stay',Math.random));M.record(sim,'switch',M.play(n,'switch',Math.random));
      const g=sim.stay.games;
      if(g>=nextSample){samples.push([g,M.rate(sim.stay),M.rate(sim.switch)]);nextSample=Math.max(g+1,Math.ceil(g*1.01));}
    }
    dirty=true;
  }
  function niceLabel(v){return v===1/3?'1/3':v===2/3?'2/3':v===0?'0':v===1?'1':`${Math.round(v*100)}%`;}
  function drawChart(){
    const w=chart.width,h=chart.height,s=dpr,L=40*s,R=40*s,T=12*s,B=24*s,pw=w-L-R,ph=h-T-B;
    const X=g=>L+Math.log10(g)/view*pw,Y=v=>T+(1-v)*ph;
    cctx.clearRect(0,0,w,h);cctx.font=`${11*s}px ui-monospace, SFMono-Regular, Menlo, monospace`;cctx.lineWidth=s;
    cctx.textAlign='right';cctx.textBaseline='middle';
    for(const v of [0,0.25,0.5,0.75,1]){
      const y=Y(v);cctx.strokeStyle=colors.border;cctx.beginPath();cctx.moveTo(L,y);cctx.lineTo(w-R,y);cctx.stroke();
      cctx.fillStyle=colors.muted;cctx.fillText(`${v*100}%`,L-6*s,y);
    }
    cctx.textAlign='center';cctx.textBaseline='top';
    for(let k=0;k<=Math.floor(view+1e-9);k++){
      const x=X(10**k);cctx.strokeStyle=colors.border;cctx.beginPath();cctx.moveTo(x,T);cctx.lineTo(x,T+ph);cctx.stroke();
      cctx.fillStyle=colors.muted;cctx.fillText(k<3?String(10**k):compact.format(10**k),x,T+ph+6*s);
    }
    const series=[['stay',1,colors.out],['switch',2,colors.in]];
    cctx.save();cctx.beginPath();cctx.rect(L,T,pw,ph);cctx.clip();
    for(const [name,,color] of series){
      const p=M.winProbability(n,name),steps=80,top=[],bottom=[];
      for(let i=0;i<=steps;i++){const g=10**(view*i/steps),e=1.96*M.standardError(p,g);top.push([X(g),Y(Math.min(1,p+e))]);bottom.push([X(g),Y(Math.max(0,p-e))]);}
      cctx.beginPath();top.forEach(([x,y],i)=>i?cctx.lineTo(x,y):cctx.moveTo(x,y));bottom.reverse().forEach(([x,y])=>cctx.lineTo(x,y));cctx.closePath();
      cctx.fillStyle=alpha(color,0.1);cctx.fill();
      cctx.setLineDash([5*s,4*s]);cctx.strokeStyle=colors.muted;cctx.lineWidth=1.5*s;cctx.beginPath();cctx.moveTo(L,Y(p));cctx.lineTo(w-R,Y(p));cctx.stroke();cctx.setLineDash([]);
    }
    if(samples.length){
      for(const [name,idx,color] of series){
        cctx.strokeStyle=color;cctx.lineWidth=2*s;cctx.lineJoin='round';cctx.beginPath();
        samples.forEach((row,i)=>i?cctx.lineTo(X(row[0]),Y(row[idx])):cctx.moveTo(X(row[0]),Y(row[idx])));
        const end=[X(sim[name].games),Y(M.rate(sim[name]))];cctx.lineTo(...end);cctx.stroke();
        cctx.fillStyle=color;cctx.beginPath();cctx.arc(...end,4*s,0,Math.PI*2);cctx.fill();cctx.strokeStyle=colors.surface;cctx.lineWidth=2*s;cctx.stroke();
      }
    }
    cctx.restore();
    cctx.textAlign='left';cctx.textBaseline='middle';cctx.fillStyle=colors.text;
    for(const [name] of series){const p=M.winProbability(n,name);cctx.fillText(n===3?niceLabel(p):`${(p*100).toFixed(p>0.98||p<0.02?0:1).replace(/\.0$/,'')}%`,w-R+6*s,Y(p));}
    if(!samples.length){
      cctx.textAlign='center';cctx.fillStyle=colors.muted;cctx.font=`${13*s}px ${getComputedStyle(document.body).fontFamily}`;
      cctx.fillText('Press Simulate to play thousands of games',L+pw/2,T+ph*0.5);
    }
  }
  function updateNote(){
    const g=sim.stay.games;
    $('sim-note').innerHTML=g?`After <b>${fmt.format(g)}</b> game${g>1?'s':''} each: switching won <b class="sw">${(M.rate(sim.switch)*100).toFixed(1)}%</b>, staying won <b class="st">${(M.rate(sim.stay)*100).toFixed(1)}%</b>. The axis is logarithmic.`
      :'Each simulated game plays one contestant who always stays and one who always switches. The axis is logarithmic.';
  }

  function frame_(now){
    const dt=Math.min(0.1,(now-last)/1000);last=now;
    let k=0;
    if(playing){carry+=rate*dt;k=Math.floor(carry);carry-=k;}
    if(pending){const take=Math.min(pending,Math.max(2000,Math.ceil(pending/12)),FRAME_CAP);pending-=take;k+=take;}
    if(k)simulate(k);
    const target=Math.max(2,Math.log10(Math.max(1,sim.stay.games))),moving=Math.abs(target-view)>1e-3;
    if(moving){view+=(target-view)*(reducedMotion.matches?1:0.14);dirty=true;}
    if(dirty){drawChart();updateNote();dirty=false;}
    if(playing||pending||moving)requestAnimationFrame(frame_);else running=false;
  }
  function kick(){if(!running){running=true;last=performance.now();requestAnimationFrame(frame_);}}
  function setPlaying(on){
    playing=on;carry=on?1:0;const b=$('play');b.setAttribute('aria-pressed',String(on));
    b.querySelector('.icon').textContent=on?'❚❚':'▶';b.querySelector('.text').textContent=on?'Pause':'Simulate';kick();
  }
  function resetSim(){sim=M.tally();samples=[];nextSample=1;pending=0;view=2;dirty=true;kick();}
  function setRate(){rate=RATES[$('speed').value];$('speed-label').textContent=`${rate>=1000?compact.format(rate):rate} / s`;}
  function setDoors(){
    const next=Number($('door-count').value);$('doors-label').textContent=next;if(next===n)return;
    n=next;mine=M.tally();streak=0;updateMine();resetSim();newGame();
  }

  function resize(){
    dpr=Math.min(2,window.devicePixelRatio||1);
    const c=chart.getBoundingClientRect();chart.width=Math.round(c.width*dpr);chart.height=Math.round(c.height*dpr);
    layoutDoors();dirty=true;kick();
  }

  $('stay').onclick=()=>phase==='decide'&&decide(false);
  $('switch').onclick=()=>phase==='decide'&&decide(true);
  $('again').onclick=newGame;
  $('play').onclick=()=>setPlaying(!playing);
  $('reset').onclick=resetSim;
  document.querySelectorAll('[data-burst]').forEach(b=>b.onclick=()=>{pending+=Number(b.dataset.burst);kick();});
  $('speed').addEventListener('input',setRate);
  $('door-count').addEventListener('input',setDoors);
  $('door-count').addEventListener('change',()=>{if(n>3)toast(`${n} doors: the host will open ${n-2} of them.`);});
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.target.matches('input,button,select,textarea'))return;
    const digit=Number(e.key);
    if(e.key===' '){e.preventDefault();setPlaying(!playing);}
    else if(e.key==='r'||e.key==='R')resetSim();
    else if(digit>=1&&digit<=Math.min(9,n)&&phase==='pick')choose(digit-1);
    else if((e.key==='s'||e.key==='S')&&phase==='decide')decide(false);
    else if((e.key==='w'||e.key==='W')&&phase==='decide')decide(true);
    else if(e.key==='Enter'&&phase==='reveal')newGame();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{readColors();dirty=true;kick();});
  new ResizeObserver(resize).observe(frame);
  new ResizeObserver(resize).observe(chart);
  readColors();setRate();updateMine();newGame();resize();
})();
