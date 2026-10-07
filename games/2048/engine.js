(function(root){
  function spawn(s,random=Math.random){const empty=s.cells.map((v,i)=>v?null:i).filter(i=>i!==null);if(!empty.length)return;const i=empty[Math.floor(random()*empty.length)];s.cells[i]=random()<.9?2:4;}
  function fresh(){const s={cells:Array(16).fill(0),score:0};spawn(s);spawn(s);return s;}
  function merge(line,motions){
    const values=line.map((value,index)=>({value,index})).filter(tile=>tile.value),out=[];
    let score=0;
    for(let i=0;i<values.length;i++){
      const tile=values[i],to=out.length;
      motions?.push({from:tile.index,to});
      if(tile.value===values[i+1]?.value){
        motions?.push({from:values[i+1].index,to});
        out.push(tile.value*2);score+=tile.value*2;i++;
      }else out.push(tile.value);
    }
    while(out.length<4)out.push(0);
    return {line:out,score};
  }
  function move(s,dir,motions){
    if(!['left','right','up','down'].includes(dir))return false;
    let changed=false;
    for(let lane=0;lane<4;lane++){
      let indices=Array.from({length:4},(_,j)=>dir==='left'||dir==='right'?lane*4+j:j*4+lane);
      if(dir==='right'||dir==='down')indices.reverse();
      const laneMotions=[];
      const result=merge(indices.map(i=>s.cells[i]),laneMotions);s.score+=result.score;
      motions?.push(...laneMotions.map(({from,to})=>({from:indices[from],to:indices[to]})));
      indices.forEach((i,j)=>{if(s.cells[i]!==result.line[j])changed=true;s.cells[i]=result.line[j];});
    }
    return changed;
  }
  function over(s){return !s.cells.includes(0)&&s.cells.every((v,i)=>(i%4===3||s.cells[i+1]!==v)&&(i>=12||s.cells[i+4]!==v));}
  const valid=s=>s&&Array.isArray(s.cells)&&s.cells.length===16&&s.cells.every(v=>Number.isInteger(v)&&v>=0&&(v===0||(v>=2&&Number.isInteger(Math.log2(v)))))&&Number.isFinite(s.score)&&s.score>=0;
  const api={fresh,spawn,merge,move,over,valid};if(typeof module!=='undefined')module.exports=api;else root.Tiles=api;
})(globalThis);
