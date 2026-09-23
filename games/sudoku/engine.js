(function(root){
  const peers=i=>Array.from({length:81},(_,j)=>j).filter(j=>j!==i&&(Math.floor(j/9)===Math.floor(i/9)||j%9===i%9||(Math.floor(j/27)===Math.floor(i/27)&&Math.floor(j%9/3)===Math.floor(i%9/3))));
  const groups=Array.from({length:81},(_,i)=>peers(i));
  function candidates(board,i){const used=new Set(groups[i].map(j=>board[j]));return [1,2,3,4,5,6,7,8,9].filter(n=>!used.has(n));}
  function countSolutions(input,limit=2){
    const b=[...input];if(b.some((v,i)=>v&&groups[i].some(j=>b[j]===v)))return 0;
    function search(){let best=-1,options=[];for(let i=0;i<81;i++){if(b[i])continue;const opts=candidates(b,i);if(!opts.length)return 0;if(best<0||opts.length<options.length){best=i;options=opts;if(opts.length===1)break;}}if(best<0)return 1;let count=0;for(const n of options){b[best]=n;count+=search();if(count>=limit)break;}b[best]=0;return Math.min(count,limit);}
    return search();
  }
  function shuffle(values){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function fresh(clues=40){
    const units=()=>shuffle([0,1,2]).flatMap(b=>shuffle([0,1,2]).map(i=>b*3+i));
    const rows=units(),cols=units(),digits=shuffle([1,2,3,4,5,6,7,8,9]);
    const solution=rows.flatMap(r=>cols.map(c=>digits[(r*3+Math.floor(r/3)+c)%9]));
    const givens=[...solution];let remaining=81;
    for(const i of shuffle(Array.from({length:81},(_,i)=>i))){if(remaining<=clues)break;const v=givens[i];givens[i]=0;if(countSolutions(givens)!==1)givens[i]=v;else remaining--;}
    return {givens,solution,board:[...givens],notes:Array.from({length:81},()=>[]),clues};
  }
  function enter(s,i,n,pencil=false){
    if(s.givens[i]||i<0||i>=81||!Number.isInteger(n)||n<0||n>9)return false;
    if(pencil&&n){if(s.board[i])return false;const at=s.notes[i].indexOf(n);if(at<0)s.notes[i].push(n);else s.notes[i].splice(at,1);s.notes[i].sort();return true;}
    if(s.board[i]===n&&!s.notes[i].length)return false;
    s.board[i]=n;s.notes[i]=[];if(n)groups[i].forEach(j=>{s.notes[j]=s.notes[j].filter(v=>v!==n);});return true;
  }
  const conflicts=(s,i)=>s.board[i]!==0&&groups[i].some(j=>s.board[j]===s.board[i]);
  const won=s=>s.board.every((v,i)=>v===s.solution[i]);
  const valid=s=>s&&[32,40].includes(s.clues)&&['givens','solution','board'].every(k=>Array.isArray(s[k])&&s[k].length===81&&s[k].every(n=>Number.isInteger(n)&&n>=0&&n<=9))&&s.solution.every(n=>n>0)&&Array.isArray(s.notes)&&s.notes.length===81&&s.notes.every(ns=>Array.isArray(ns)&&ns.every(n=>Number.isInteger(n)&&n>0&&n<10));
  const api={fresh,peers,candidates,countSolutions,enter,conflicts,won,valid};if(typeof module!=='undefined')module.exports=api;else root.Sudoku=api;
})(globalThis);
