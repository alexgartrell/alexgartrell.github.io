(function(root) {
  const neighbors = (s, i) => {
    const out = [], r = Math.floor(i / s.size), c = i % s.size;
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      if (!(x || y) || r+y < 0 || r+y >= s.size || c+x < 0 || c+x >= s.size) continue;
      out.push((r+y)*s.size+c+x);
    }
    return out;
  };
  const fresh = (size = 9) => ({ size, mines: size === 9 ? 10 : 40, ready: false, over: false, won: false, cells: Array.from({length:size*size}, () => ({mine:false, open:false, flag:false, count:0})) });
  function seed(s, first, random = Math.random) {
    const safe = new Set([first, ...neighbors(s,first)]);
    const choices = s.cells.map((_,i)=>i).filter(i=>!safe.has(i));
    for (let i=choices.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [choices[i],choices[j]]=[choices[j],choices[i]]; }
    choices.slice(0,s.mines).forEach(i=>{s.cells[i].mine=true;});
    s.cells.forEach((c,i)=>{c.count=neighbors(s,i).filter(j=>s.cells[j].mine).length;}); s.ready=true;
  }
  function reveal(s,i) {
    if (s.over || !s.cells[i] || s.cells[i].flag) return false;
    if (!s.ready) seed(s,i);
    let queue=[i];
    if (s.cells[i].open) {
      const around=neighbors(s,i);
      if (around.filter(j=>s.cells[j].flag).length !== s.cells[i].count) return false;
      queue=around.filter(j=>!s.cells[j].open && !s.cells[j].flag);
    }
    let changed=false;
    while(queue.length) {
      const j=queue.pop(), c=s.cells[j];
      if(c.open || c.flag) continue;
      c.open=true; changed=true;
      if(c.mine) {s.over=true;return true;}
      if(!c.count) queue.push(...neighbors(s,j));
    }
    s.won=s.cells.every(c=>c.mine || c.open); s.over=s.won;
    return changed;
  }
  function flag(s,i) { if(s.over || !s.cells[i] || s.cells[i].open) return false; s.cells[i].flag=!s.cells[i].flag; return true; }
  function valid(s) { return s && [9,16].includes(s.size) && Array.isArray(s.cells) && s.cells.length===s.size*s.size && s.cells.every(c=>c && typeof c.mine==='boolean' && typeof c.open==='boolean' && typeof c.flag==='boolean' && Number.isInteger(c.count) && c.count>=0 && c.count<=8) && typeof s.ready==='boolean' && typeof s.over==='boolean' && typeof s.won==='boolean' && s.mines===(s.size===9?10:40); }
  const api={fresh,neighbors,seed,reveal,flag,valid}; if(typeof module!=='undefined')module.exports=api;else root.Mines=api;
})(globalThis);
