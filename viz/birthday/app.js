(function(){
  const Bd=Birthday,$=id=>document.getElementById(id);
  const board=$('board'),chart=$('chart'),hint=$('board-hint'),bctx=board.getContext('2d'),cctx=chart.getContext('2d');
  const DAYS=Bd.DAYS,MAX_PEOPLE=DAYS+1,EVEN=Bd.firstAtLeast(0.5),P_EVEN=Bd.probShared(EVEN),GOLDEN=Math.PI*(3-Math.sqrt(5));
  const POP_MS=420,LINE_MS=520,PULSE_MS=1100,FILL_MS=170,BURST_MS=55,SIM_ROOMS=1000,SIM_MS=900;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const fmt=new Intl.NumberFormat('en-US');

  let people=[],dayCount=new Uint16Array(DAYS),dayPulse=new Float64Array(DAYS).fill(-1e9),pairsShared=0,firstMatchAt=0;
  let queue=0,filling=false,nextAt=0,spacing=0,running=false,lastActivity=-1e9;
  let firsts=[],simShown=0,simFrom=0,simStart=-1e9;
  let colors={},dpr=1,size=0,xMax=70,dirty=true,toastTimer=0;

  function readColors(){
    const s=getComputedStyle(document.documentElement),v=n=>s.getPropertyValue(n).trim();
    colors={in:v('--in'),out:v('--out'),text:v('--text'),muted:v('--muted'),border:v('--border'),surface:v('--surface'),board:v('--board'),bg:v('--bg'),accent:v('--accent'),good:v('--good')};
  }
  function alpha(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}
  const easeOut=t=>1-Math.pow(1-Math.min(1,Math.max(0,t)),3);
  const easeBack=t=>{t=Math.min(1,Math.max(0,t));const c=1.9;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);};
  const pct=p=>p<=0?'0%':p>=1?'100%':p<0.999?`${(p*100).toFixed(1)}%`:`${(p*100).toPrecision(Math.min(12,Math.ceil(-Math.log10(1-p))+2))}%`;

  // Board geometry: a calendar ring around a round room; people sit in a sunflower spiral.
  const geo=()=>{const c=size/2,ringR=size*0.4,band=size*0.026;return {c,ringR,band,roomR:ringR-band/2-size*0.075};};
  const dayAngle=d=>-Math.PI/2+(d+0.5)/DAYS*Math.PI*2;
  const targetSpacing=()=>geo().roomR/Math.sqrt(Math.max(people.length,18)+0.6);
  const seat=i=>{const r=spacing*Math.sqrt(i+0.5),a=i*GOLDEN;return [size/2+r*Math.cos(a),size/2+r*Math.sin(a)];};

  function addPerson(now){
    if(people.length>=MAX_PEOPLE){queue=0;setFilling(false);toast('366 people: a shared birthday is now guaranteed');return false;}
    const day=Math.floor(Math.random()*DAYS),before=dayCount[day];
    people.push({day,born:now});dayCount[day]++;pairsShared+=before;lastActivity=now;
    hint.classList.add('gone');dirty=true;
    if(!before)return false;
    dayPulse[day]=now;
    if(!firstMatchAt){
      firstMatchAt=people.length;
      toast(`Match! Two people born on ${Bd.label(day)}, with ${people.length} in the room`);
      const el=$('prob');el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');
    }
    return true;
  }
  function pump(now){
    while((queue||filling)&&now>=nextAt){
      const matched=addPerson(now);
      if(queue)queue--;
      if(filling&&matched){setFilling(false);if(firstMatchAt!==people.length)toast(`Another match: ${Bd.label(people[people.length-1].day)}, at ${people.length} people`);}
      nextAt=reducedMotion.matches?now:Math.max(nextAt+(filling?FILL_MS:BURST_MS),now-50);
      if(people.length>=MAX_PEOPLE){queue=0;setFilling(false);}
    }
  }

  function drawBoard(now){
    const {c,ringR,band,roomR}=geo(),s=dpr,n=people.length,inner=ringR-band/2;
    bctx.clearRect(0,0,size,size);
    bctx.fillStyle=colors.board;bctx.beginPath();bctx.arc(c,c,ringR+band/2+size*0.075,0,Math.PI*2);bctx.fill();
    bctx.fillStyle=alpha(colors.accent,0.035);bctx.beginPath();bctx.arc(c,c,roomR+size*0.03,0,Math.PI*2);bctx.fill();
    // Calendar ring: one arc per month.
    bctx.lineCap='butt';bctx.lineWidth=band;bctx.font=`500 ${11*s}px ui-monospace, SFMono-Regular, Menlo, monospace`;bctx.textAlign='center';bctx.textBaseline='middle';
    for(let m=0;m<12;m++){
      const a0=dayAngle(Bd.STARTS[m])-0.5/DAYS*Math.PI*2+0.006,a1=dayAngle(Bd.STARTS[m+1]-1)+0.5/DAYS*Math.PI*2-0.006,mid=(a0+a1)/2;
      bctx.strokeStyle=alpha(colors.muted,m%2?0.16:0.26);bctx.beginPath();bctx.arc(c,c,ringR,a0,a1);bctx.stroke();
      bctx.fillStyle=colors.muted;bctx.fillText(Bd.MONTHS[m],c+(ringR+band/2+size*0.032)*Math.cos(mid),c+(ringR+band/2+size*0.032)*Math.sin(mid));
    }
    const seats=people.map((_,i)=>seat(i)),avatarR=spacing*0.47;
    // Strings from each person to their birthday on the ring.
    bctx.lineCap='round';
    for(const shared of [false,true]){
      bctx.strokeStyle=shared?alpha(colors.out,0.8):alpha(colors.muted,n>120?0.12:0.22);bctx.lineWidth=(shared?1.6:1)*s;bctx.beginPath();
      people.forEach((p,i)=>{
        if(dayCount[p.day]>1!==shared)return;
        const g=reducedMotion.matches?1:easeOut((now-p.born-120)/LINE_MS);if(!g)return;
        const [x,y]=seats[i],a=dayAngle(p.day),tx=c+inner*Math.cos(a),ty=c+inner*Math.sin(a);
        bctx.moveTo(x,y);bctx.lineTo(x+(tx-x)*g,y+(ty-y)*g);
      });
      bctx.stroke();
    }
    // Marks on the ring, with a pulse and a date label for each shared day.
    const groups=new Map();people.forEach((p,i)=>{if(dayCount[p.day]>1){if(!groups.has(p.day))groups.set(p.day,[]);groups.get(p.day).push(i);}});
    for(let d=0;d<DAYS;d++){
      if(!dayCount[d])continue;
      const a=dayAngle(d),x=c+ringR*Math.cos(a),y=c+ringR*Math.sin(a),shared=dayCount[d]>1;
      if(shared){
        const q=(now-dayPulse[d])/PULSE_MS;
        if(q<1&&!reducedMotion.matches){bctx.strokeStyle=alpha(colors.out,0.8*(1-q));bctx.lineWidth=2*s;bctx.beginPath();bctx.arc(x,y,band*(0.6+2.2*easeOut(q)),0,Math.PI*2);bctx.stroke();}
        bctx.fillStyle=alpha(colors.out,0.25);bctx.beginPath();bctx.arc(x,y,band*0.85,0,Math.PI*2);bctx.fill();
      }
      bctx.fillStyle=shared?colors.out:colors.in;bctx.beginPath();bctx.arc(x,y,band*(shared?0.42:0.26),0,Math.PI*2);bctx.fill();
    }
    // Matching people hold hands.
    bctx.strokeStyle=colors.out;bctx.lineWidth=2.2*s;bctx.beginPath();
    for(const idx of groups.values())for(let j=1;j<idx.length;j++){const [x0,y0]=seats[idx[j-1]],[x1,y1]=seats[idx[j]];bctx.moveTo(x0,y0);bctx.lineTo(x1,y1);}
    bctx.stroke();
    // People.
    const face=avatarR>=4.5*s,labels=avatarR>=9*s;
    people.forEach((p,i)=>{
      const [x,y]=seats[i],shared=dayCount[p.day]>1,e=reducedMotion.matches?1:easeBack((now-p.born)/POP_MS),r=avatarR*e;
      if(r<=0.2)return;
      if(shared&&now-dayPulse[p.day]<PULSE_MS){const q=(now-dayPulse[p.day])/PULSE_MS;bctx.fillStyle=alpha(colors.out,0.3*(1-q));bctx.beginPath();bctx.arc(x,y,r*(1.3+0.8*q),0,Math.PI*2);bctx.fill();}
      bctx.fillStyle=shared?colors.out:colors.in;bctx.beginPath();bctx.arc(x,y,r,0,Math.PI*2);bctx.fill();
      if(face){
        bctx.fillStyle=colors.bg;bctx.beginPath();
        for(const sx of [-1,1]){bctx.moveTo(x+sx*r*0.32+r*0.1,y-r*0.15);bctx.arc(x+sx*r*0.32,y-r*0.15,r*0.1,0,Math.PI*2);}
        if(shared){bctx.moveTo(x+r*0.15,y+r*0.3);bctx.arc(x,y+r*0.3,r*0.15,0,Math.PI*2);bctx.fill();}
        else{bctx.fill();bctx.strokeStyle=colors.bg;bctx.lineWidth=Math.max(1,r*0.1);bctx.beginPath();bctx.arc(x,y+r*0.02,r*0.42,0.2*Math.PI,0.8*Math.PI);bctx.stroke();}
      }
      if(labels&&e>0.9){
        bctx.fillStyle=shared?colors.out:colors.muted;bctx.font=`${shared?600:400} ${Math.min(11*s,r*0.62)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        bctx.fillText(Bd.label(p.day),x,y+r+Math.min(9*s,r*0.55));
      }
    });
    // Date labels for shared days, just inside the ring.
    bctx.font=`600 ${10.5*s}px ui-monospace, SFMono-Regular, Menlo, monospace`;bctx.fillStyle=colors.out;
    for(const d of groups.keys()){const a=dayAngle(d),R=inner-size*0.034;bctx.fillText(Bd.label(d)+(dayCount[d]>2?` ×${dayCount[d]}`:''),c+R*Math.cos(a),c+R*Math.sin(a));}
  }

  function drawChart(now){
    const w=chart.width,h=chart.height,s=dpr,L=44*s,R=16*s,T=14*s,B=26*s,pw=w-L-R,ph=h-T-B;
    const X=n=>L+n/xMax*pw,Y=v=>T+(1-v)*ph;
    cctx.clearRect(0,0,w,h);cctx.font=`${11*s}px ui-monospace, SFMono-Regular, Menlo, monospace`;cctx.lineWidth=s;
    cctx.textAlign='right';cctx.textBaseline='middle';
    for(let v=0;v<=1.0001;v+=0.25){const y=Y(v);cctx.strokeStyle=colors.border;cctx.beginPath();cctx.moveTo(L,y);cctx.lineTo(w-R,y);cctx.stroke();cctx.fillStyle=colors.muted;cctx.fillText(`${v*100}%`,L-6*s,y);}
    const step=xMax>200?50:xMax>100?20:10;
    cctx.textAlign='center';cctx.textBaseline='top';
    for(let n=0;n<=xMax;n+=step){const x=X(n);cctx.strokeStyle=colors.border;cctx.beginPath();cctx.moveTo(x,T);cctx.lineTo(x,T+ph);cctx.stroke();cctx.fillStyle=colors.muted;cctx.fillText(String(n),x,T+ph+6*s);}
    // The 23-person moment.
    const ex=X(EVEN),ey=Y(P_EVEN);
    cctx.setLineDash([4*s,4*s]);cctx.strokeStyle=alpha(colors.good,0.8);cctx.lineWidth=1.2*s;cctx.beginPath();cctx.moveTo(ex,T+ph);cctx.lineTo(ex,ey);cctx.lineTo(L,ey);cctx.stroke();cctx.setLineDash([]);
    // Exact curve.
    cctx.save();cctx.beginPath();cctx.rect(L,T-4*s,pw,ph+8*s);cctx.clip();
    cctx.strokeStyle=colors.accent;cctx.lineWidth=2.2*s;cctx.lineJoin='round';cctx.beginPath();
    for(let n=0;n<=Math.ceil(xMax);n++){const x=X(n),y=Y(Bd.probShared(n));n?cctx.lineTo(x,y):cctx.moveTo(x,y);}
    cctx.stroke();
    // Simulated rooms, as a step curve.
    const shown=Math.floor(simShown);
    if(shown){
      const e=Bd.empirical(firsts.slice(0,shown),Math.ceil(xMax));
      cctx.strokeStyle=colors.out;cctx.lineWidth=1.8*s;cctx.beginPath();cctx.moveTo(X(0),Y(0));
      for(let n=1;n<e.length;n++){cctx.lineTo(X(n),Y(e[n-1]));cctx.lineTo(X(n),Y(e[n]));}
      cctx.stroke();
    }
    cctx.restore();
    cctx.fillStyle=colors.good;cctx.beginPath();cctx.arc(ex,ey,3.5*s,0,Math.PI*2);cctx.fill();
    cctx.font=`600 ${11*s}px ui-monospace, SFMono-Regular, Menlo, monospace`;cctx.textAlign='right';cctx.textBaseline='bottom';
    cctx.fillText(`${EVEN} people → ${pct(P_EVEN)}`,ex-8*s,ey-6*s);
    // Your room.
    const n=people.length;
    if(n){
      const x=X(n),y=Y(Bd.probShared(n));
      cctx.strokeStyle=alpha(colors.accent,0.35);cctx.lineWidth=s;cctx.beginPath();cctx.moveTo(x,T+ph);cctx.lineTo(x,y);cctx.stroke();
      cctx.fillStyle=colors.accent;cctx.beginPath();cctx.arc(x,y,5*s,0,Math.PI*2);cctx.fill();cctx.strokeStyle=colors.surface;cctx.lineWidth=2*s;cctx.stroke();
      const text=`n = ${n} · ${pct(Bd.probShared(n))}`,tw=cctx.measureText(text).width,right=x+10*s+tw>w-R;
      cctx.textAlign=right?'right':'left';cctx.textBaseline='top';cctx.fillStyle=colors.accent;
      cctx.fillText(text,right?x-10*s:x+10*s,Math.min(T+ph-16*s,y+8*s));
    }
  }

  function updateReadout(){
    const n=people.length,p=Bd.probShared(n),el=$('prob');
    el.textContent=pct(p);el.classList.toggle('hot',pairsShared>0);
    $('people').textContent=fmt.format(n);$('pairs').textContent=fmt.format(Bd.pairs(n));$('matches').textContent=fmt.format(pairsShared);
    const st=$('status');
    if(!n)st.textContent='An empty room. Invite someone.';
    else if(!pairsShared)st.textContent=`No shared birthday among ${n} ${n>1?'people':'person'} yet.${n<EVEN?` At ${EVEN} the odds pass 50%.`:''}`;
    else{
      const days=[];for(let d=0;d<DAYS;d++)if(dayCount[d]>1)days.push(Bd.label(d));
      const first=`First match at n = ${firstMatchAt}, when the odds were ${pct(Bd.probShared(firstMatchAt))}.`;
      st.innerHTML=days.length===1?`<b>${dayCount[people.find(q=>dayCount[q.day]>1).day]} people share ${days[0]}.</b> ${first}`:`<b>${days.length} shared birthdays:</b> ${days.slice(0,4).join(', ')}${days.length>4?', …':''}. ${first}`;
    }
    const f=$('formula');
    if(n<2){f.innerHTML=`P(n) = 1 − (365 × 364 × … × (365 − n + 1)) ÷ 365<sup>n</sup>${n?' = 0, with one person':''}`;return;}
    const prod=n===2?'365 × 364':n===3?'365 × 364 × 363':`365 × 364 × … × ${DAYS-n+1}`;
    f.innerHTML=n>DAYS?`P(${n}) = 1: there are more people than days`:`P(${n}) = 1 − (${prod}) ÷ 365<sup>${n}</sup> = 1 − ${(1-p).toPrecision(4)} = <b class="o">${pct(p)}</b>`;
  }
  function updateSimNote(){
    if(!firsts.length)return;
    const e=Bd.empirical(firsts,EVEN),sorted=firsts.slice().sort((a,b)=>a-b),median=sorted[Math.floor((sorted.length-1)/2)];
    $('sim-note').innerHTML=`<b>${fmt.format(firsts.length)}</b> rooms: <b>${pct(e[EVEN])}</b> had a match by ${EVEN} people (exact ${pct(P_EVEN)}). The median room found its first match at <b>${median}</b> people.`;
    $('simulate').textContent=`Run ${fmt.format(SIM_ROOMS)} more`;
  }

  function toast(text){const el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800);}

  function frame(now){
    pump(now);
    const k=reducedMotion.matches?1:0.14,ts=targetSpacing(),tx=Math.min(MAX_PEOPLE,Math.max(70,people.length*1.15+5));
    const moving=Math.abs(ts-spacing)/ts>1e-3||Math.abs(tx-xMax)>0.05;
    if(moving){spacing+=(ts-spacing)*k;xMax+=(tx-xMax)*k;dirty=true;}
    const target=firsts.length,simMoving=simShown<target;
    if(simMoving){simShown=reducedMotion.matches?target:simFrom+(target-simFrom)*easeOut((now-simStart)/SIM_MS);if(now-simStart>=SIM_MS)simShown=target;dirty=true;}
    const animating=!reducedMotion.matches&&now-lastActivity<Math.max(PULSE_MS,LINE_MS+200);
    drawBoard(now);
    if(dirty){updateReadout();drawChart(now);dirty=false;}
    if(queue||filling||moving||simMoving||animating)requestAnimationFrame(frame);else running=false;
  }
  function kick(){if(!running){running=true;requestAnimationFrame(frame);}}

  function setFilling(on){filling=on;$('fill').setAttribute('aria-pressed',String(on));$('fill').textContent=on?'Stop filling':'Fill until a match';}
  function enqueue(n){if(!queue&&!filling)nextAt=performance.now();queue+=n;kick();}
  function fill(){if(filling){setFilling(false);return;}if(!queue)nextAt=performance.now();setFilling(true);kick();}
  function reset(){
    people=[];dayCount.fill(0);dayPulse.fill(-1e9);pairsShared=0;firstMatchAt=0;queue=0;setFilling(false);
    hint.classList.remove('gone');dirty=true;kick();
  }
  function simulate(){
    simFrom=simShown;simStart=performance.now();
    for(let i=0;i<SIM_ROOMS;i++)firsts.push(Bd.firstMatch(Math.random));
    updateSimNote();dirty=true;kick();
  }
  function resize(){
    dpr=Math.min(2,window.devicePixelRatio||1);
    const b=board.getBoundingClientRect(),c=chart.getBoundingClientRect(),next=Math.round(b.width*dpr);
    if(next&&next!==size){size=board.width=board.height=next;spacing=targetSpacing();}
    chart.width=Math.round(c.width*dpr);chart.height=Math.round(c.height*dpr);
    dirty=true;kick();
  }

  $('add').onclick=()=>enqueue(1);
  $('add10').onclick=()=>enqueue(10);
  $('fill').onclick=fill;
  $('reset').onclick=reset;
  $('simulate').onclick=simulate;
  board.addEventListener('click',()=>enqueue(1));hint.onclick=()=>enqueue(1);
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.target.matches('input,button,select,textarea'))return;
    const key=e.key.toLowerCase();
    if(e.key===' '||key==='a'){e.preventDefault();enqueue(1);}
    else if(key==='t')enqueue(10);
    else if(key==='f')fill();
    else if(key==='r')reset();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{readColors();dirty=true;kick();});
  new ResizeObserver(resize).observe(document.querySelector('.board-frame'));
  new ResizeObserver(resize).observe(chart);
  readColors();resize();
})();
