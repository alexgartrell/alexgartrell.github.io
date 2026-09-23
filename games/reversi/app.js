(()=>{
  const g=Reversi,ui=GameUI,key='reversi-v1',grid=document.getElementById('grid'),opponent=document.getElementById('opponent');
  const saved=ui.load(key,v=>v&&g.valid(v.state)&&Array.isArray(v.history)&&v.history.every(g.valid)&&[0,2,3].includes(v.opponent));
  let state=saved?.state||g.fresh(),history=saved?.history||[],timer=null;opponent.value=saved?.opponent??2;
  const computer=()=>Number(opponent.value)>0;
  function save(){ui.save(key,{state,history,opponent:Number(opponent.value)});}
  function render(){
    const focus=document.activeElement?.dataset.cell,legal=new Set(g.legal(state)),thinking=!state.over&&computer()&&state.turn===2;
    grid.replaceChildren();state.board.forEach((v,i)=>{
      const el=ui.button(`Row ${Math.floor(i/8)+1}, column ${i%8+1}: ${v===1?'black':v===2?'white':legal.has(i)?'legal move':'empty'}`,'',()=>play(i));el.dataset.cell=i;
      if(v){const disc=document.createElement('span');disc.className=`disc ${v===1?'black':'white'}`;el.append(disc);}else if(legal.has(i)&&!thinking&&!state.over){const dot=document.createElement('span');dot.className='dot';el.append(dot);}grid.append(el);
    });
    if(focus!==undefined)grid.querySelector(`[data-cell="${focus}"]`)?.focus({preventScroll:true});
    const score=g.score(state);document.getElementById('stats').textContent=`● ${score.black} · ○ ${score.white}`;document.getElementById('undo').disabled=!history.length;
    const pass=state.passed?`${state.passed===1?'Black':'White'} passes. `:'';
    ui.status(state.over?(score.black===score.white?'Draw!':`${score.black>score.white?'Black':'White'} wins!`):`${pass}${thinking?'Computer thinking…':computer()?'Your turn · Black':`${state.turn===1?'Black':'White'} to move`}`);
  }
  function advance(){
    clearTimeout(timer);render();save();
    if(state.over||!computer()||state.turn!==2)return;
    timer=setTimeout(()=>{const i=g.choose(state,Number(opponent.value));if(i!==null)g.move(state,i);else g.settle(state);advance();},100);
  }
  function play(i){if(state.over||(computer()&&state.turn===2)||!g.flips(state,i).length)return;history.push(structuredClone(state));history=history.slice(-64);g.move(state,i);advance();}
  document.getElementById('undo').onclick=()=>{if(!history.length)return;clearTimeout(timer);state=history.pop();advance();};
  document.getElementById('new-game').onclick=()=>{clearTimeout(timer);state=g.fresh();history=[];advance();};
  opponent.onchange=()=>document.getElementById('new-game').click();
  ui.gridKeys(grid,()=>8);advance();
})();
