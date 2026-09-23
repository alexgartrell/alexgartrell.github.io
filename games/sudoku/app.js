(()=>{
  const g=Sudoku,ui=GameUI,key='sudoku-v1',grid=document.getElementById('grid'),difficulty=document.getElementById('difficulty');
  const saved=ui.load(key,v=>v&&g.valid(v.state)&&Array.isArray(v.history)&&v.history.every(g.valid));
  let state=saved?.state||g.fresh(),history=saved?.history||[],selected=0,pencil=false;difficulty.value=state.clues;
  function save(){ui.save(key,{state,history});}
  function highlight(){grid.querySelectorAll('button').forEach((el,i)=>{el.classList.toggle('selected',i===selected);el.classList.toggle('related',g.peers(selected).includes(i));el.setAttribute('aria-pressed',i===selected);});}
  function render(){
    const focus=document.activeElement?.dataset.cell;grid.replaceChildren();
    state.board.forEach((v,i)=>{
      const text=v||state.notes[i].join(' ');
      const el=ui.button(`Row ${Math.floor(i/9)+1}, column ${i%9+1}: ${v||'empty'}${state.givens[i]?', given':''}${!v&&state.notes[i].length?`, notes ${text}`:''}`,text,()=>{selected=i;highlight();});
      el.dataset.cell=i;el.classList.toggle('given',!!state.givens[i]);el.classList.toggle('pencil',!v);el.classList.toggle('conflict',g.conflicts(state,i));
      if(i%9===2||i%9===5)el.classList.add('box-right');if(Math.floor(i/9)===2||Math.floor(i/9)===5)el.classList.add('box-bottom');
      el.addEventListener('focus',()=>{selected=i;highlight();});grid.append(el);
    });
    highlight();if(focus!==undefined)grid.querySelector(`[data-cell="${focus}"]`)?.focus({preventScroll:true});
    document.getElementById('undo').disabled=!history.length;document.getElementById('stats').textContent=`${state.board.filter(Boolean).length}/81`;
    ui.status(g.won(state)?'Solved!':state.board.some((_,i)=>g.conflicts(state,i))?'Conflicting numbers highlighted.':'');
  }
  function enter(n){if(g.won(state))return;const before=structuredClone(state);if(g.enter(state,selected,n,pencil)){history.push(before);history=history.slice(-100);save();render();}}
  for(let n=1;n<=9;n++)document.getElementById('numbers').append(ui.button(`Enter ${n}`,n,()=>enter(n),'number'));
  document.getElementById('notes').onclick=e=>{pencil=!pencil;e.currentTarget.setAttribute('aria-pressed',pencil);};
  document.getElementById('erase').onclick=()=>enter(0);
  document.getElementById('undo').onclick=()=>{if(history.length){state=history.pop();save();render();}};
  document.getElementById('new-game').onclick=()=>{state=g.fresh(Number(difficulty.value));history=[];selected=0;save();render();};
  difficulty.onchange=()=>document.getElementById('new-game').click();
  document.addEventListener('keydown',e=>{if(e.target.matches('select,input'))return;if(/^[1-9]$/.test(e.key)){e.preventDefault();enter(Number(e.key));}else if(['Backspace','Delete','0'].includes(e.key)){e.preventDefault();enter(0);}else if(e.key.toLowerCase()==='p'){e.preventDefault();document.getElementById('notes').click();}});
  ui.gridKeys(grid,()=>9);save();render();
})();
