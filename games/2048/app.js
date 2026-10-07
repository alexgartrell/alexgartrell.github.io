(()=>{
  const g=Tiles,ui=GameUI,key='2048-v1',grid=document.getElementById('grid');
  const saved=ui.load(key,v=>v&&g.valid(v.state)&&Array.isArray(v.history)&&v.history.every(g.valid));
  let state=saved?.state||g.fresh(),history=saved?.history||[],best=Number(ui.load('2048-best',v=>Number.isFinite(v)&&v>=0))||0;
  let animations=[],animating=false,animationVersion=0,queued=[];
  function save(){ui.save(key,{state,history});best=Math.max(best,state.score);ui.save('2048-best',best);}
  function render(){
    grid.replaceChildren();state.cells.forEach((v,i)=>{
      const el=document.createElement('div');el.className='cell tile';
      el.setAttribute('aria-label',`Row ${Math.floor(i/4)+1}, column ${i%4+1}: ${v||'empty'}`);
      if(v){
        const face=document.createElement('div');face.className='tile-face';face.textContent=v;face.setAttribute('aria-hidden','true');
        const power=Math.log2(v);face.style.background=`hsl(${Math.max(12,48-power*3)} 65% ${Math.max(28,78-power*4)}%)`;face.style.color=power<4?'#382820':'#fff';el.append(face);
      }
      grid.append(el);
    });
    document.getElementById('stats').textContent=`${state.score} · Best ${best}`;document.getElementById('undo').disabled=!history.length;
    ui.status(g.over(state)?'No moves left.':state.cells.some(v=>v>=2048)?'2048 reached! Keep going.':'');
  }
  function cancelSlide(){
    animationVersion++;queued=[];animating=false;
    animations.forEach(animation=>animation.cancel());animations=[];
  }
  function play(dir){
    if(animating){if(queued.length<2)queued.push(dir);return;}
    const before=structuredClone(state),motions=[];
    if(!g.move(state,dir,motions))return;
    history.push(before);history=history.slice(-30);g.spawn(state);save();
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||!grid.animate){render();return;}
    // Keep the old faces visible while both tiles travel to a merge destination.
    // Reveal the merged values and new tile only after the slide finishes.
    const cells=[...grid.children],rects=cells.map(el=>el.getBoundingClientRect());
    const version=++animationVersion;animating=true;
    document.getElementById('undo').disabled=false;
    animations=motions.filter(({from,to})=>from!==to).map(({from,to})=>{
      const face=cells[from].firstElementChild;
      const dx=rects[to].left-rects[from].left,dy=rects[to].top-rects[from].top;
      return face.animate([
        {transform:'translate(0, 0)',zIndex:2},
        {transform:`translate(${dx}px, ${dy}px)`,zIndex:2}
      ],{duration:140,easing:'cubic-bezier(0.2, 0.7, 0.3, 1)',fill:'forwards'});
    });
    Promise.all(animations.map(animation=>animation.finished.catch(()=>{}))).then(()=>{
      if(version!==animationVersion)return;
      animations.forEach(animation=>animation.cancel());animations=[];animating=false;render();
      // Drain buffered directions, including any that turn out to be no-ops.
      while(queued.length&&!animating)play(queued.shift());
    });
  }
  document.querySelectorAll('[data-dir]').forEach(el=>el.onclick=()=>play(el.dataset.dir));
  document.addEventListener('keydown',e=>{if(e.target.matches('select,input'))return;const dir={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'}[e.key];if(dir){e.preventDefault();play(dir);}});
  let start=null;
  grid.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;start={x:e.clientX,y:e.clientY,id:e.pointerId};grid.setPointerCapture(e.pointerId);});
  grid.addEventListener('pointerup',e=>{if(!start||e.pointerId!==start.id)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.max(Math.abs(dx),Math.abs(dy))>20)play(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');});
  grid.addEventListener('pointercancel',()=>{start=null;});
  document.getElementById('undo').onclick=()=>{if(!history.length)return;cancelSlide();state=history.pop();save();render();};
  document.getElementById('new-game').onclick=()=>{cancelSlide();state=g.fresh();history=[];save();render();};
  window.addEventListener('resize',()=>{cancelSlide();render();});
  save();render();
})();
