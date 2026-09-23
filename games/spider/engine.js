(function(root){
  const suits=['♠','♥','♣','♦'],red=c=>c.suit%2===1;
  function deal(mode=1){
    if(![1,2,4].includes(mode))mode=1;
    const stock=Array.from({length:104},(_,id)=>({id,rank:id%13+1,suit:Math.floor(id/13)%mode,up:false}));
    for(let i=103;i>0;i--){const j=Math.floor(Math.random()*(i+1));[stock[i],stock[j]]=[stock[j],stock[i]];}
    const tableau=Array.from({length:10},(_,i)=>{const p=stock.splice(0,i<4?6:5);p.at(-1).up=true;return p;});
    return {stock,tableau,foundations:Array.from({length:8},()=>[]),mode,moves:0};
  }
  const pile=(s,l)=>s[l.kind]?.[l.pile];
  function collect(s){
    for(const p of s.tableau){
      while(p.length>=13){const run=p.slice(-13);if(!run.every((c,i)=>c.up&&c.rank===13-i&&c.suit===run[0].suit))break;
        const home=s.foundations.find(f=>!f.length);if(!home)break;home.push(...p.splice(-13));if(p.length)p.at(-1).up=true;
      }
    }
  }
  function move(s,from,to){
    if(from.kind!=='tableau'||to.kind!=='tableau'||from.pile===to.pile)return false;
    const a=pile(s,from),b=pile(s,to);if(!a||!b||!Number.isInteger(from.index)||from.index<0)return false;
    const cards=a.slice(from.index),first=cards[0],top=b.at(-1);
    if(!first||cards.some((c,i)=>!c.up||(i&&(cards[i-1].rank!==c.rank+1||c.suit!==first.suit))))return false;
    if(top&&(!top.up||top.rank!==first.rank+1))return false;
    b.push(...a.splice(from.index));if(a.length)a.at(-1).up=true;s.moves++;collect(s);return true;
  }
  function draw(s){
    if(s.stock.length<10||s.tableau.some(p=>!p.length))return false;
    for(const p of s.tableau){const c=s.stock.pop();c.up=true;p.push(c);}s.moves++;collect(s);return true;
  }
  function autoMove(s,from){
    const card=pile(s,from)?.[from.index];if(!card)return false;
    const targets=s.tableau.map((p,i)=>({i,priority:!p.length?2:p.at(-1).suit===card.suit?0:1})).sort((a,b)=>a.priority-b.priority);
    for(const {i} of targets){if(!s.tableau[i].length&&from.index===0)continue;if(move(s,from,{kind:'tableau',pile:i}))return true;}return false;
  }
  const won=s=>s.foundations.every(p=>p.length===13);
  function valid(s){
    if(!s||![1,2,4].includes(s.mode)||!Number.isInteger(s.moves)||s.moves<0||!Array.isArray(s.stock))return false;
    if(![['tableau',10],['foundations',8]].every(([k,n])=>Array.isArray(s[k])&&s[k].length===n&&s[k].every(Array.isArray)))return false;
    const cards=[s.stock,...s.tableau,...s.foundations].flat();return cards.length===104&&new Set(cards.map(c=>c?.id)).size===104&&cards.every(c=>c&&Number.isInteger(c.id)&&c.id>=0&&c.id<104&&c.rank===c.id%13+1&&c.suit===Math.floor(c.id/13)%s.mode&&typeof c.up==='boolean');
  }
  const api={suits,red,deal,pile,move,draw,autoMove,collect,won,valid};if(typeof module!=='undefined')module.exports=api;else root.CardGame=api;
})(globalThis);
