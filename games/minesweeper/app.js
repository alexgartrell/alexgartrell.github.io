(() => {
  const g=Mines, ui=GameUI, key='minesweeper-v1', grid=document.getElementById('grid');
  let state=ui.load(key,g.valid)||g.fresh(), flagMode=false;
  const difficulty=document.getElementById('difficulty'); difficulty.value=state.size;
  function act(i,flag=false){if((flag||flagMode?g.flag:g.reveal)(state,i)){ui.save(key,state);render();}}
  function render(){
    const focus=document.activeElement?.dataset.cell;
    grid.replaceChildren(); grid.style.gridTemplateColumns=`repeat(${state.size},1fr)`;grid.style.gridTemplateRows=`repeat(${state.size},1fr)`;
    state.cells.forEach((c,i)=>{
      const showMine=state.over&&c.mine;
      const text=showMine?'✹':c.flag?'⚑':c.open?(c.count||''):'';
      const el=ui.button(`Row ${Math.floor(i/state.size)+1}, column ${i%state.size+1}: ${showMine?'mine':c.flag?'flagged':c.open?`${c.count} adjacent mines`:'covered'}`,text,()=>act(i));
      el.dataset.cell=i;el.dataset.count=c.count;el.classList.toggle('open',c.open);el.classList.toggle('mine',showMine);
      el.addEventListener('contextmenu',e=>{e.preventDefault();act(i,true);});grid.append(el);
    });
    if(focus!==undefined)grid.querySelector(`[data-cell="${focus}"]`)?.focus({preventScroll:true});
    document.getElementById('stats').textContent=`${state.mines-state.cells.filter(c=>c.flag).length} mines`;
    ui.status(state.over?(state.won?'Cleared!':'Mine hit. Start a new game.'):(flagMode?'Flag mode':'Clear the board'));
  }
  document.getElementById('new-game').onclick=()=>{state=g.fresh(Number(difficulty.value));ui.save(key,state);render();};
  difficulty.onchange=()=>document.getElementById('new-game').click();
  document.getElementById('flag').onclick=e=>{flagMode=!flagMode;e.currentTarget.setAttribute('aria-pressed',flagMode);render();};
  ui.gridKeys(grid,()=>state.size);render();
})();
