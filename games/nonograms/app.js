(()=>{
  const g=Nonograms,ui=GameUI,key='nonograms-v1',grid=document.getElementById('grid'),picker=document.getElementById('puzzle');
  const saved=ui.load(key,v=>v&&g.valid(v.state)&&Array.isArray(v.history)&&v.history.every(g.valid));
  // Derive puzzle clues from the built-in definitions, not saved data.
  const restore=s=>({...g.fresh(s.index),cells:s.cells});
  let state=saved?restore(saved.state):g.fresh(),history=saved?saved.history.map(restore):[],cross=false;
  g.patterns.forEach(([name,lines],i)=>{const opt=document.createElement('option');opt.value=i;opt.textContent=`${name} · ${lines.length}×${lines.length}`;picker.append(opt);});picker.value=state.index;
  function save(){ui.save(key,{state,history});}
  function play(i,right=false){if(g.won(state))return;history.push(structuredClone(state));history=history.slice(-100);g.mark(state,i,right||cross);save();render();}
  function hint(values,vertical,done){const el=document.createElement('div');el.className=`hint ${vertical?'vertical':''} ${done?'done':''}`;values.forEach(v=>{const span=document.createElement('span');span.textContent=v;el.append(span);});return el;}
  const matches=(line,clue)=>g.runs(line).join(',')===clue.join(',');
  function render(){
    const focus=document.activeElement?.dataset.cell;grid.replaceChildren();grid.style.gridTemplateColumns=`2.5fr repeat(${state.size},1fr)`;grid.style.gridTemplateRows=`2.5fr repeat(${state.size},1fr)`;
    grid.append(document.createElement('div'));
    state.cols.forEach((clue,c)=>grid.append(hint(clue,true,matches(Array.from({length:state.size},(_,r)=>state.cells[r*state.size+c]),clue))));
    state.rows.forEach((clue,r)=>{
      grid.append(hint(clue,false,matches(state.cells.slice(r*state.size,(r+1)*state.size),clue)));
      for(let c=0;c<state.size;c++){
        const i=r*state.size+c,v=state.cells[i],el=ui.button(`Row ${r+1}, column ${c+1}, ${v===1?'filled':v===-1?'marked empty':'unmarked'}`,v===-1?'×':'',()=>play(i));
        el.dataset.cell=i;el.classList.toggle('filled',v===1);if(c===4)el.classList.add('group-right');if(r===4)el.classList.add('group-bottom');
        el.addEventListener('contextmenu',e=>{e.preventDefault();play(i,true);});grid.append(el);
      }
    });
    if(focus!==undefined)grid.querySelector(`[data-cell="${focus}"]`)?.focus({preventScroll:true});
    document.getElementById('undo').disabled=!history.length;ui.status(g.won(state)?`${state.name} revealed!`:cross?'Mark empty squares':'');
  }
  document.getElementById('mark').onclick=e=>{cross=!cross;e.currentTarget.setAttribute('aria-pressed',cross);render();};
  document.getElementById('undo').onclick=()=>{if(history.length){state=history.pop();save();render();}};
  picker.onchange=()=>{state=g.fresh(Number(picker.value));history=[];save();render();};
  document.getElementById('new-game').onclick=()=>{picker.value=(state.index+1)%g.patterns.length;picker.onchange();};
  ui.gridKeys(grid,()=>state.size);save();render();
})();
