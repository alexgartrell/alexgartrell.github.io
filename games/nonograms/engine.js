(function(root){
  const patterns=[
    ['Heart',['01010','11111','11111','01110','00100']],
    ['Diamond',['00100','01110','11111','01110','00100']],
    ['Tree',['00100','01110','11111','00100','00100']],
    ['Cup',['00000','11110','10011','10010','11110']],
    ['Rocket',['0000110000','0001111000','0001111000','0011111100','0010011100','0010011100','0111111110','1111111111','0001001000','0011001100']],
    ['House',['0000110000','0001111000','0011111100','0111111110','1111111111','0111111110','0110011110','0110010010','0111110010','0111111110']]
  ];
  function runs(line){const out=[];let n=0;for(const v of [...line,0]){if(v===1)n++;else if(n){out.push(n);n=0;}}return out.length?out:[0];}
  function clues(solution,size){return {rows:Array.from({length:size},(_,r)=>runs(solution.slice(r*size,(r+1)*size))),cols:Array.from({length:size},(_,c)=>runs(Array.from({length:size},(_,r)=>solution[r*size+c])))};}
  function fresh(index=0){const [name,lines]=patterns[index],size=lines.length,solution=lines.join('').split('').map(Number);return {index,name,size,solution,cells:Array(size*size).fill(0),...clues(solution,size)};}
  function countSolutions(s){
    const equal=(a,b)=>a.join(',')===b.join(',');
    const lines=Array.from({length:2**s.size},(_,mask)=>Array.from({length:s.size},(_,j)=>(mask>>j)&1));
    const rows=s.rows.map(c=>lines.filter(l=>equal(runs(l),c))),cols=s.cols.map(c=>lines.filter(l=>equal(runs(l),c)));
    let count=0;const board=[];
    function search(r){if(count>=2)return;if(r===s.size){count++;return;}for(const row of rows[r]){board[r]=row;if(cols.every((options,c)=>options.some(line=>{for(let k=0;k<=r;k++)if(line[k]!==board[k][c])return false;return true;})))search(r+1);}}
    search(0);return count;
  }
  function mark(s,i,cross=false){if(!s.cells.hasOwnProperty(i))return false;const next=cross?-1:1;s.cells[i]=s.cells[i]===next?0:next;return true;}
  const won=s=>s.solution.every((v,i)=>(s.cells[i]===1?1:0)===v);
  const valid=s=>s&&Number.isInteger(s.index)&&s.index>=0&&s.index<patterns.length&&s.size===patterns[s.index][1].length&&Array.isArray(s.cells)&&s.cells.length===s.size*s.size&&s.cells.every(v=>[-1,0,1].includes(v));
  const api={patterns,fresh,runs,clues,countSolutions,mark,won,valid};if(typeof module!=='undefined')module.exports=api;else root.Nonograms=api;
})(globalThis);
