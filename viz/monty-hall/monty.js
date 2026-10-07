(function(root){
  // Doors are numbered 0..n-1. One hides a car; the rest hide goats.
  function randomInt(n,random){return Math.floor(random()*n);}
  // A random door other than the excluded ones (a short list).
  function randomDoorExcept(n,exclude,random){
    const skip=[...new Set(exclude)].filter(d=>d>=0&&d<n).sort((a,b)=>a-b);
    let d=randomInt(n-skip.length,random);
    for(const s of skip)if(d>=s)d++;
    return d;
  }
  // The host knows where the car is. He keeps one other door shut and opens every remaining one,
  // never revealing the car. If you already picked the car, the door he keeps shut is random.
  function keptDoor(n,car,pick,random){return pick===car?randomDoorExcept(n,[pick],random):car;}
  function hostOpens(n,car,pick,random){
    const kept=keptDoor(n,car,pick,random),opened=[];
    for(let d=0;d<n;d++)if(d!==pick&&d!==kept)opened.push(d);
    return {kept,opened};
  }
  function newGame(n,random){return {n,car:randomInt(n,random),pick:-1,kept:-1,opened:[],final:-1,switched:false};}
  function choose(game,pick,random){const h=hostOpens(game.n,game.car,pick,random);game.pick=pick;game.kept=h.kept;game.opened=h.opened;return game;}
  function decide(game,doSwitch){game.switched=doSwitch;game.final=doSwitch?game.kept:game.pick;return game.final===game.car;}
  // One full game with a fixed strategy, in O(1): only the kept door matters for the outcome.
  function play(n,strategy,random){
    const car=randomInt(n,random),pick=randomInt(n,random);
    const final=strategy==='switch'?keptDoor(n,car,pick,random):pick;
    return final===car;
  }
  function winProbability(n,strategy){return strategy==='switch'?(n-1)/n:1/n;}
  function tally(){return {stay:{games:0,wins:0},switch:{games:0,wins:0}};}
  function record(t,strategy,win){const s=t[strategy];s.games++;if(win)s.wins++;return t;}
  function rate(s){return s.games?s.wins/s.games:NaN;}
  function standardError(p,games){return games>0?Math.sqrt(p*(1-p)/games):Infinity;}
  // Small seeded generator so runs can be reproduced in tests.
  function mulberry32(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  const api={randomDoorExcept,keptDoor,hostOpens,newGame,choose,decide,play,winProbability,tally,record,rate,standardError,mulberry32};
  if(typeof module!=='undefined')module.exports=api;else root.MontyHall=api;
})(globalThis);
