(function(root){
  const dirs=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  function fresh(){const board=Array(64).fill(0);board[27]=2;board[28]=1;board[35]=1;board[36]=2;return {board,turn:1,over:false,passed:0};}
  function flips(s,index,player=s.turn){
    if(index<0||index>=64||!Number.isInteger(index)||s.board[index])return [];
    const out=[],x=index%8,y=Math.floor(index/8);
    for(const [dx,dy] of dirs){let col=x+dx,row=y+dy;const line=[];
      while(col>=0&&col<8&&row>=0&&row<8&&s.board[row*8+col]===3-player){line.push(row*8+col);col+=dx;row+=dy;}
      if(line.length&&col>=0&&col<8&&row>=0&&row<8&&s.board[row*8+col]===player)out.push(...line);
    }return out;
  }
  const legal=(s,player=s.turn)=>s.board.flatMap((v,i)=>!v&&flips(s,i,player).length?[i]:[]);
  function settle(s){s.passed=0;if(!legal(s).length){s.passed=s.turn;s.turn=3-s.turn;if(!legal(s).length){s.over=true;s.passed=0;}}}
  function move(s,index){if(s.over)return false;const captured=flips(s,index);if(!captured.length)return false;s.board[index]=s.turn;captured.forEach(i=>{s.board[i]=s.turn;});s.turn=3-s.turn;settle(s);return true;}
  const score=s=>({black:s.board.filter(v=>v===1).length,white:s.board.filter(v=>v===2).length});
  function evaluate(s){
    const total=score(s);if(s.over)return (total.white-total.black)*10000;
    const corners=[0,7,56,63],danger={0:[1,8,9],7:[6,14,15],56:[48,49,57],63:[54,55,62]};
    let value=(legal(s,2).length-legal(s,1).length)*8+total.white-total.black;
    s.board.forEach((v,i)=>{if(!v)return;const sign=v===2?1:-1;if(corners.includes(i))value+=120*sign;else if(i%8===0||i%8===7||i<8||i>=56)value+=5*sign;});
    for(const corner of corners)if(!s.board[corner])for(const i of danger[corner])if(s.board[i])value-=35*(s.board[i]===2?1:-1);
    return value;
  }
  function choose(s,depth=2){
    const ordered=state=>legal(state).sort((a,b)=>Number([0,7,56,63].includes(b))-Number([0,7,56,63].includes(a)));
    function search(state,left,alpha,beta){if(!left||state.over)return evaluate(state);const moves=ordered(state);if(!moves.length){const copy=structuredClone(state);settle(copy);return search(copy,left-1,alpha,beta);}const max=state.turn===2;let value=max?-Infinity:Infinity;
      for(const i of moves){const copy=structuredClone(state);move(copy,i);const next=search(copy,left-1,alpha,beta);value=max?Math.max(value,next):Math.min(value,next);if(max)alpha=Math.max(alpha,value);else beta=Math.min(beta,value);if(beta<=alpha)break;}return value;
    }
    let best=null,value=s.turn===2?-Infinity:Infinity;
    for(const i of ordered(s)){const copy=structuredClone(s);move(copy,i);const result=search(copy,depth-1,-Infinity,Infinity);if(best===null||(s.turn===2?result>value:result<value)){best=i;value=result;}}
    return best;
  }
  const valid=s=>s&&Array.isArray(s.board)&&s.board.length===64&&s.board.every(v=>[0,1,2].includes(v))&&[1,2].includes(s.turn)&&typeof s.over==='boolean'&&[0,1,2].includes(s.passed);
  const api={fresh,flips,legal,settle,move,score,choose,valid};if(typeof module!=='undefined')module.exports=api;else root.Reversi=api;
})(globalThis);
