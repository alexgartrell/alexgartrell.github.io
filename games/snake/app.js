(()=>{
  const g=Snake,ui=GameUI,key='snake-v1',grid=document.getElementById('grid'),pause=document.getElementById('pause'),speed=document.getElementById('speed');
  let state=ui.load(key,g.valid)||g.fresh(),running=false,timer=null,ticks=0,best=ui.load('snake-best',v=>Number.isInteger(v)&&v>=0)||0;
  const cells=Array.from({length:400},()=>{const el=document.createElement('div');el.className='pixel';el.setAttribute('aria-hidden','true');grid.append(el);return el;});
  grid.setAttribute('role','img');
  function save(){ui.save(key,state);ui.save('snake-best',best);}
  function render(){
    cells.forEach(el=>{el.className='pixel';});state.snake.forEach((p,i)=>cells[p.y*20+p.x].className=i?'pixel body':'pixel head');
    if(state.food)cells[state.food.y*20+state.food.x].className='pixel food';
    grid.setAttribute('aria-label',`Snake board. Score ${state.score}. Head at row ${state.snake[0].y+1}, column ${state.snake[0].x+1}.`);
    document.getElementById('stats').textContent=`${state.score} · Best ${best}`;pause.textContent=running?'Pause':'Start';pause.disabled=state.over;
    ui.status(state.over?(state.won?'Board cleared!':'Game over.'):running?'':'Paused');
  }
  function setRunning(value){clearInterval(timer);running=value&&!state.over;if(running)timer=setInterval(()=>{g.step(state);best=Math.max(best,state.score);if(state.over){setRunning(false);save();}else if(++ticks%10===0)save();render();},Number(speed.value));else save();render();}
  function steer(dir){if(state.over)return;g.turn(state,dir);if(!running)setRunning(true);}
  document.querySelectorAll('[data-dir]').forEach(el=>el.onclick=()=>steer(el.dataset.dir));
  pause.onclick=()=>setRunning(!running);
  document.getElementById('new-game').onclick=()=>{state=g.fresh();save();setRunning(true);};
  speed.onchange=()=>setRunning(running);
  document.addEventListener('keydown',e=>{if(e.target.matches('select,input'))return;const dir={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'}[e.key];if(dir){e.preventDefault();steer(dir);}else if(e.code==='Space'&&!e.target.matches('button,a')){e.preventDefault();setRunning(!running);}});
  let start=null;grid.onpointerdown=e=>{if(!e.isPrimary||e.button!==0)return;start={x:e.clientX,y:e.clientY,id:e.pointerId};grid.setPointerCapture(e.pointerId);};
  grid.onpointerup=e=>{if(!start||start.id!==e.pointerId)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.max(Math.abs(dx),Math.abs(dy))>12)steer(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');};
  grid.onpointercancel=()=>{start=null;};window.addEventListener('blur',()=>setRunning(false));document.addEventListener('visibilitychange',()=>{if(document.hidden)setRunning(false);});render();
})();
