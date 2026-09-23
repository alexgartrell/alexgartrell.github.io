(()=>{
  const g=Tiles,ui=GameUI,key='2048-v1',grid=document.getElementById('grid');
  const saved=ui.load(key,v=>v&&g.valid(v.state)&&Array.isArray(v.history)&&v.history.every(g.valid));
  let state=saved?.state||g.fresh(),history=saved?.history||[],best=Number(ui.load('2048-best',v=>Number.isFinite(v)&&v>=0))||0;
  function save(){ui.save(key,{state,history});best=Math.max(best,state.score);ui.save('2048-best',best);}
  function render(){
    grid.replaceChildren();state.cells.forEach((v,i)=>{const el=document.createElement('div');el.className='cell tile';el.textContent=v||'';el.setAttribute('aria-label',`Row ${Math.floor(i/4)+1}, column ${i%4+1}: ${v||'empty'}`);if(v){const power=Math.log2(v);el.style.background=`hsl(${Math.max(12,48-power*3)} 65% ${Math.max(28,78-power*4)}%)`;el.style.color=power<4?'#382820':'#fff';}grid.append(el);});
    document.getElementById('stats').textContent=`${state.score} · Best ${best}`;document.getElementById('undo').disabled=!history.length;
    ui.status(g.over(state)?'No moves left.':state.cells.some(v=>v>=2048)?'2048 reached! Keep going.':'');
  }
  function play(dir){const before=structuredClone(state);if(!g.move(state,dir))return;history.push(before);history=history.slice(-30);g.spawn(state);save();render();}
  document.querySelectorAll('[data-dir]').forEach(el=>el.onclick=()=>play(el.dataset.dir));
  document.addEventListener('keydown',e=>{if(e.target.matches('select,input'))return;const dir={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'}[e.key];if(dir){e.preventDefault();play(dir);}});
  let start=null;
  grid.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;start={x:e.clientX,y:e.clientY,id:e.pointerId};grid.setPointerCapture(e.pointerId);});
  grid.addEventListener('pointerup',e=>{if(!start||e.pointerId!==start.id)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.max(Math.abs(dx),Math.abs(dy))>20)play(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');});
  grid.addEventListener('pointercancel',()=>{start=null;});
  document.getElementById('undo').onclick=()=>{if(!history.length)return;state=history.pop();save();render();};
  document.getElementById('new-game').onclick=()=>{state=g.fresh();history=[];save();render();};save();render();
})();
