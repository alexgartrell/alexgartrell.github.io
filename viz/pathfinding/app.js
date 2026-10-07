(function(){
  const S=PathSearch,$=id=>document.getElementById(id);
  const board=$('board'),ctx=board.getContext('2d');
  const W=31,H=21,GLOW=520,RATES=[5,10,20,40,80,160,400,1000,Infinity];
  const ALGOS=S.ALGORITHMS,byId=Object.fromEntries(ALGOS.map(a=>[a.id,a]));
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const fmt=new Intl.NumberFormat('en-US');

  let g=S.grid(W,H),start=0,goal=0,optimal=null;
  let algo='astar',compare=false,brush=S.WALL,rate=RATES[4];
  let lanes=[],results={},colors={},dpr=1,bw=0,bh=0,panels=[];
  let running=false,last=0,carry=0,lastVisit=-Infinity,drag=null,toastTimer=0,statusHTML='';

  function readColors(){
    const s=getComputedStyle(document.documentElement),v=n=>s.getPropertyValue(n).trim();
    colors={in:v('--in'),out:v('--out'),text:v('--text'),muted:v('--muted'),border:v('--border'),surface:v('--surface'),board:v('--board'),bg:v('--bg'),accent:v('--accent'),good:v('--good'),wall:v('--wall'),mud:v('--mud'),path:v('--path'),frontier:v('--frontier'),visited:parseFloat(v('--visited-alpha'))||0.22,mono:v('--mono'),sans:v('--sans')};
  }
  function alpha(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}
  const xy=i=>[i%W,i/W|0];

  // ---- Grid editing and presets ----------------------------------------------------------
  function optimalCost(){if(optimal===null)optimal=S.run('dijkstra',g,start,goal).cost;return optimal;}
  function gridChanged(){
    optimal=null;results={};
    // A finished search follows your edits live; a search in progress is cancelled.
    if(lanes.length&&lanes.every(l=>l.result))startRun(true);else lanes=[];
    renderResults();updateStatus();kick();
  }
  function preset(name,run=true){
    const random=Math.random,mid=(H>>1)*W;
    if(name==='maze'){g=S.maze(W,H,random,0.07);start=W+1;goal=(H-2)*W+W-2;}
    else if(name==='random'){
      start=mid+3;goal=mid+W-4;
      for(let tries=0;tries<100;tries++){
        g=S.scatterMud(S.randomWalls(W,H,random,0.3),random,3,3.4);g.cells[start]=g.cells[goal]=S.OPEN;
        if(S.run('astar',g,start,goal).found)break;
      }
    }else{g=S.grid(W,H);start=mid+4;goal=mid+W-5;}
    lanes=[];gridChanged();
    if(run&&name!=='empty')startRun();
  }

  // ---- Searching -------------------------------------------------------------------------
  function makeLane(id){return {id,gen:S.search(id,g,start,goal),state:new Uint8Array(W*H),time:new Float64Array(W*H).fill(-Infinity),result:null,progress:0,explored:0};}
  function stepLane(l,now){
    const r=l.gen.next();
    if(r.done){l.result=r.value;results[l.id]=r.value;renderResults();if(lanes.every(x=>x.result))finished();return;}
    const {node,opened}=r.value;l.state[node]=2;l.time[node]=now;l.explored++;lastVisit=now;
    for(const m of opened)if(l.state[m]!==2){l.state[m]=1;l.time[m]=now;}
  }
  function startRun(instant=false){
    lanes=(compare?ALGOS.map(a=>a.id):[algo]).map(makeLane);carry=1;
    if(instant||rate===Infinity||reducedMotion.matches){
      for(const l of lanes){while(!l.result)stepLane(l,-Infinity);l.progress=l.result.path.length;}
    }
    updateStatus();kick();
  }
  function finished(){
    updateStatus();
    if(!lanes[0].result.found){toast('No way through. Erase a wall to open a route.');}
  }
  function clearRun(){lanes=[];updateStatus();kick();}
  const pathRate=()=>Math.min(160,Math.max(28,rate*0.5));

  // ---- Readouts ----------------------------------------------------------------------------
  const num=n=>`<b>${fmt.format(n)}</b>`;
  function verdict(r){const best=optimalCost();return r.cost===best?'<span class="yes">Optimal.</span>':`<span class="no">Not optimal: the cheapest path costs ${fmt.format(best)}.</span>`;}
  function updateStatus(){
    let label,html;
    if(compare){
      label='All four, side by side';
      if(!lanes.length)html='Press Run to race all four on this grid.';
      else if(lanes.some(l=>!l.result))html=`Racing… ${lanes.map(l=>`${byId[l.id].name} ${num(l.explored)}`).join(' · ')}`;
      else if(!lanes[0].result.found)html=`<span class="no">No path.</span> The goal is walled off.`;
      else{
        const best=optimalCost(),good=lanes.filter(l=>l.result.cost===best).sort((a,b)=>a.result.explored-b.result.explored);
        const missed=lanes.filter(l=>l.result.cost!==best).map(l=>byId[l.id].name);
        html=`<b>${byId[good[0].id].name}</b> found a cheapest path (cost ${num(best)}) exploring the fewest cells, ${num(good[0].result.explored)}. `+(missed.length?`<span class="no">${missed.join(' and ')} missed it.</span>`:'<span class="yes">Everyone found an optimal path.</span>');
      }
    }else{
      const l=lanes[0];label=byId[algo].full;
      if(!l)html=`Press Run to watch ${byId[algo].name} search.`;
      else if(!l.result)html=`Exploring… ${num(l.explored)} cells so far.`;
      else if(!l.result.found)html=`<span class="no">No path.</span> Explored all ${num(l.result.explored)} reachable cells.`;
      else html=`Path of ${num(l.result.steps)} steps, cost ${num(l.result.cost)}, after exploring ${num(l.result.explored)} cells. ${verdict(l.result)}`;
    }
    $('status-label').textContent=label;
    if(html!==statusHTML){statusHTML=html;$('status').innerHTML=html;}
  }
  function renderResults(){
    const done=ALGOS.filter(a=>results[a.id]&&results[a.id].found);
    const best=done.length?optimalCost():Infinity;
    const optimalOnes=done.filter(a=>results[a.id].cost===best);
    const fewest=optimalOnes.length?Math.min(...optimalOnes.map(a=>results[a.id].explored)):-1;
    $('results').innerHTML=ALGOS.map(a=>{
      const r=results[a.id],cls=!compare&&a.id===algo?' class="current"':'';
      if(!r)return `<tr${cls}><td>${a.name}</td><td class="empty">–</td><td class="empty">–</td><td class="empty">–</td><td class="empty">–</td></tr>`;
      const ok=r.found&&r.cost===best;
      const mark=!r.found?'<span class="no">no path</span>':ok?'<span class="yes">✓ yes</span>':`<span class="no">✗ +${fmt.format(r.cost-best)}</span>`;
      return `<tr${cls}><td>${a.name}</td><td class="${ok&&r.explored===fewest?'best':''}">${fmt.format(r.explored)}</td><td>${r.found?r.steps:'–'}</td><td>${r.found?r.cost:'–'}</td><td>${mark}</td></tr>`;
    }).join('');
  }
  function toast(text){
    const t=$('toast');t.textContent=text;t.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600);
  }

  // ---- Drawing -----------------------------------------------------------------------------
  function layout(){
    if(!compare){const cs=Math.min(bw/W,bh/H);return [{x:(bw-cs*W)/2,y:(bh-cs*H)/2,cs,lane:lanes[0],label:null}];}
    const gap=Math.round(bw*0.025),cs=Math.min((bw-gap)/(2*W),(bh-gap)/(2*H+3)),lh=cs*1.5;
    const gw=cs*W,gh=cs*H+lh,ox=(bw-2*gw-gap)/2,oy=(bh-2*gh-gap)/2;
    return ALGOS.map((a,k)=>({x:ox+(k%2)*(gw+gap),y:oy+(k>>1)*(gh+gap)+lh,cs,lh,label:a,lane:lanes.find(l=>l.id===a.id)}));
  }
  function roundRect(c,x,y,w,h,r){c.beginPath();c.roundRect?c.roundRect(x,y,w,h,r):c.rect(x,y,w,h);}
  function drawPanel(p,now){
    const {x:X,y:Y,cs,lane}=p,c=ctx;
    c.save();roundRect(c,X,Y,cs*W,cs*H,Math.min(14*dpr,cs*0.8));c.fillStyle=colors.board;c.fill();c.clip();
    c.fillStyle=alpha(colors.mud,0.5);
    for(let i=0;i<W*H;i++)if(g.cells[i]===S.MUD){const [x,y]=xy(i);c.fillRect(X+x*cs,Y+y*cs,cs,cs);}
    if(lane){
      for(let i=0;i<W*H;i++){
        const st=lane.state[i];if(!st||g.cells[i]===S.WALL)continue;
        const [x,y]=xy(i),age=(now-lane.time[i])/GLOW;
        if(st===2){
          const fresh=age<1?1-age:0;
          c.fillStyle=alpha(colors.in,colors.visited+0.45*fresh*fresh);c.fillRect(X+x*cs,Y+y*cs,cs,cs);
        }else{
          const k=age<1?0.5+0.5*Math.min(1,age*3):1,s=cs*0.62*k;
          c.fillStyle=alpha(colors.frontier,0.8);roundRect(c,X+(x+0.5)*cs-s/2,Y+(y+0.5)*cs-s/2,s,s,s*0.3);c.fill();
        }
      }
    }
    if(cs>=7*dpr){
      c.strokeStyle=alpha(colors.muted,0.12);c.lineWidth=1;c.beginPath();
      for(let x=1;x<W;x++){const px=Math.round(X+x*cs)+0.5;c.moveTo(px,Y);c.lineTo(px,Y+H*cs);}
      for(let y=1;y<H;y++){const py=Math.round(Y+y*cs)+0.5;c.moveTo(X,py);c.lineTo(X+W*cs,py);}
      c.stroke();
    }
    c.fillStyle=colors.wall;
    for(let i=0;i<W*H;i++)if(g.cells[i]===S.WALL){const [x,y]=xy(i);c.fillRect(Math.floor(X+x*cs),Math.floor(Y+y*cs),Math.ceil(cs)+1,Math.ceil(cs)+1);}
    if(lane&&lane.result&&lane.result.found&&lane.progress>0){
      const path=lane.result.path,n=Math.min(path.length-1,lane.progress),whole=Math.floor(n),f=n-whole;
      const at=i=>{const [x,y]=xy(path[i]);return [X+(x+0.5)*cs,Y+(y+0.5)*cs];};
      c.strokeStyle=colors.path;c.lineWidth=Math.max(2,cs*0.34);c.lineCap='round';c.lineJoin='round';c.beginPath();
      c.moveTo(...at(0));for(let i=1;i<=whole;i++)c.lineTo(...at(i));
      if(f>0&&whole+1<path.length){const [ax,ay]=at(whole),[bx,by]=at(whole+1);c.lineTo(ax+(bx-ax)*f,ay+(by-ay)*f);}
      c.stroke();
    }
    c.restore();
    const marker=(i,isStart)=>{
      const [x,y]=xy(i),cx=X+(x+0.5)*cs,cy=Y+(y+0.5)*cs,lifted=drag&&drag.mode===(isStart?'start':'goal')?1.25:1;
      c.beginPath();c.arc(cx,cy,cs*0.4*lifted,0,Math.PI*2);
      if(isStart){c.fillStyle=colors.good;c.fill();c.lineWidth=Math.max(1.5,cs*0.08);c.strokeStyle=colors.board;c.stroke();}
      else{c.fillStyle=colors.board;c.fill();c.lineWidth=Math.max(2,cs*0.13);c.strokeStyle=colors.out;c.stroke();c.beginPath();c.arc(cx,cy,cs*0.12*lifted,0,Math.PI*2);c.fillStyle=colors.out;c.fill();}
    };
    marker(start,true);marker(goal,false);
    if(p.label){
      const size=Math.max(10*dpr,Math.min(14*dpr,p.lh*0.62)),ty=Y-p.lh*0.45;
      c.textBaseline='middle';c.font=`600 ${size}px ${colors.sans}`;c.fillStyle=colors.text;c.textAlign='left';c.fillText(p.label.name,X+2,ty);
      if(lane){
        const r=lane.result,best=r&&r.found?optimalCost():0;
        const text=!r?`${fmt.format(lane.explored)} explored`:!r.found?'no path':`${fmt.format(r.explored)} explored · cost ${r.cost}`;
        c.font=`${size*0.9}px ${colors.mono}`;c.textAlign='right';c.fillStyle=colors.muted;
        const mark=r&&r.found?(r.cost===best?' ✓':' ✗'):'';
        c.fillText(text,X+cs*W-(mark?size*1.1:2),ty);
        if(mark){c.fillStyle=r.cost===best?colors.good:colors.out;c.fillText(mark,X+cs*W-2,ty);}
      }
    }
  }
  function draw(now){
    ctx.clearRect(0,0,bw,bh);panels=layout();
    for(const p of panels)drawPanel(p,now);
  }

  // ---- Animation loop ----------------------------------------------------------------------
  function frame(now){
    const dt=Math.min(0.1,(now-last)/1000);last=now;
    const active=lanes.filter(l=>!l.result);
    if(active.length){
      carry+=rate*dt;const n=Math.min(4000,Math.floor(carry));carry-=n;
      for(const l of active)for(let k=0;k<n&&!l.result;k++)stepLane(l,now);
      updateStatus();
    }
    let tracing=false;
    for(const l of lanes)if(l.result&&l.progress<l.result.path.length){l.progress=Math.min(l.result.path.length,l.progress+pathRate()*dt);tracing=true;}
    draw(now);
    if(lanes.some(l=>!l.result)||tracing||now-lastVisit<GLOW)requestAnimationFrame(frame);else running=false;
  }
  function kick(){if(!running){running=true;last=performance.now();requestAnimationFrame(frame);}}

  // ---- Pointer editing ---------------------------------------------------------------------
  function cellAt(e){
    const r=board.getBoundingClientRect(),px=(e.clientX-r.left)*bw/r.width,py=(e.clientY-r.top)*bh/r.height;
    for(const p of panels){
      const x=Math.floor((px-p.x)/p.cs),y=Math.floor((py-p.y)/p.cs);
      if(x>=0&&y>=0&&x<W&&y<H)return y*W+x;
    }
    return -1;
  }
  function paint(i){
    if(i<0||i===start||i===goal)return false;
    const v=drag.mode==='erase'?S.OPEN:brush;
    if(drag.mode==='erase'?g.cells[i]===S.OPEN:g.cells[i]===v)return false;
    g.cells[i]=v;return true;
  }
  // Paint every cell on the segment between pointer samples so fast drags leave no gaps.
  function paintLine(a,b){
    const [ax,ay]=xy(a),[bx,by]=xy(b),n=Math.max(Math.abs(bx-ax),Math.abs(by-ay));let changed=false;
    for(let k=0;k<=n;k++){const t=n?k/n:0;changed=paint(Math.round(ay+(by-ay)*t)*W+Math.round(ax+(bx-ax)*t))||changed;}
    return changed;
  }
  board.addEventListener('pointerdown',e=>{
    const i=cellAt(e);if(i<0)return;
    e.preventDefault();board.setPointerCapture(e.pointerId);
    if(i===start||i===goal){drag={mode:i===start?'start':'goal'};board.className='grabbing';}
    else{drag={mode:g.cells[i]===brush||g.cells[i]===S.WALL?'erase':'paint',last:i};if(paint(i))gridChanged();}
    kick();
  });
  board.addEventListener('pointermove',e=>{
    const i=cellAt(e);
    if(!drag){board.className=i>=0&&(i===start||i===goal)?'grab':'';return;}
    if(i<0)return;
    if(drag.mode==='start'||drag.mode==='goal'){
      if(g.cells[i]===S.WALL||i===start||i===goal)return;
      if(drag.mode==='start')start=i;else goal=i;
      gridChanged();
    }else if(i!==drag.last){const changed=paintLine(drag.last,i);drag.last=i;if(changed)gridChanged();}
  });
  const endDrag=()=>{if(drag){drag=null;board.className='';kick();}};
  board.addEventListener('pointerup',endDrag);board.addEventListener('pointercancel',endDrag);

  // ---- Controls ----------------------------------------------------------------------------
  const algosEl=$('algos');
  ALGOS.forEach((a,k)=>{const b=document.createElement('button');b.type='button';b.dataset.algo=a.id;b.textContent=a.name;b.title=`${a.full} (${k+1})`;b.onclick=()=>selectAlgo(a.id);algosEl.appendChild(b);});
  function syncButtons(){
    algosEl.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(!compare&&b.dataset.algo===algo)));
    algosEl.classList.toggle('dim',compare);
    $('compare').setAttribute('aria-pressed',String(compare));
    document.querySelectorAll('[data-brush]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.brush)===brush)));
  }
  function selectAlgo(id){
    algo=id;compare=false;syncButtons();renderResults();
    startRun();
  }
  function setCompare(on){
    compare=on;syncButtons();renderResults();startRun();
  }
  function setRate(){const r=RATES[$('speed').value];rate=r;$('speed-label').textContent=r===Infinity?'Instant':`${fmt.format(r)} cells / s`;}

  $('run').onclick=()=>startRun();
  $('compare').onclick=()=>setCompare(!compare);
  $('clear').onclick=clearRun;
  document.querySelectorAll('[data-brush]').forEach(b=>b.onclick=()=>{brush=Number(b.dataset.brush);syncButtons();});
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>preset(b.dataset.preset));
  $('speed').addEventListener('input',setRate);
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.target.matches('input,button,select,textarea'))return;
    const k=e.key.toLowerCase();
    if(e.key===' '||e.key==='Enter'){e.preventDefault();startRun();}
    else if(k>='1'&&k<='4')selectAlgo(ALGOS[Number(k)-1].id);
    else if(k==='c')setCompare(!compare);
    else if(k==='m')preset('maze');
    else if(k==='r')preset('random');
    else if(k==='e')preset('empty');
  });

  function resize(){
    dpr=Math.min(2,window.devicePixelRatio||1);
    const r=board.getBoundingClientRect();
    bw=board.width=Math.round(r.width*dpr);bh=board.height=Math.round(r.height*dpr);
    kick();
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{readColors();kick();});
  new ResizeObserver(resize).observe(document.querySelector('.board-frame'));
  readColors();setRate();syncButtons();resize();preset('random');
})();
