const {test}=require('node:test'),a=require('node:assert/strict'),m=require('./monty');
test('random doors skip the excluded ones and cover the rest uniformly',()=>{
  const random=m.mulberry32(1),counts=new Array(6).fill(0);
  for(let i=0;i<60000;i++)counts[m.randomDoorExcept(6,[4,1,4],random)]++;
  a.equal(counts[1],0);a.equal(counts[4],0);
  for(const d of [0,2,3,5])a.ok(Math.abs(counts[d]/60000-0.25)<0.01);
});
test('the host never opens your door or the car, and leaves exactly one other door shut',()=>{
  const random=m.mulberry32(2);
  for(const n of [3,4,10,100])for(let i=0;i<2000;i++){
    const car=Math.floor(random()*n),pick=Math.floor(random()*n),{kept,opened}=m.hostOpens(n,car,pick,random);
    a.equal(opened.length,n-2);a.ok(!opened.includes(car));a.ok(!opened.includes(pick));
    a.notEqual(kept,pick);a.ok(!opened.includes(kept));a.ok(kept>=0&&kept<n);
    if(pick!==car)a.equal(kept,car);
  }
});
test('a game played by hand reveals the car only through your final door',()=>{
  const g=m.newGame(3,()=>0);a.equal(g.car,0);
  m.choose(g,1,()=>0);a.equal(g.kept,0);a.deepEqual(g.opened,[2]);
  a.equal(m.decide(g,true),true);a.equal(g.final,0);a.equal(m.decide(g,false),false);a.equal(g.final,1);
  const h=m.choose(m.newGame(3,()=>0),0,()=>0.99);a.equal(h.kept,2);a.deepEqual(h.opened,[1]);a.equal(m.decide(h,false),true);
});
test('exact win probabilities and the standard error',()=>{
  a.equal(m.winProbability(3,'stay'),1/3);a.equal(m.winProbability(3,'switch'),2/3);a.equal(m.winProbability(100,'switch'),0.99);
  a.equal(m.standardError(0.5,0),Infinity);a.equal(m.standardError(0.5,100),0.05);
  const t=m.tally();m.record(t,'stay',true);m.record(t,'stay',false);m.record(t,'switch',true);
  a.equal(m.rate(t.stay),0.5);a.equal(m.rate(t.switch),1);a.ok(Number.isNaN(m.rate(m.tally().stay)));
});
test('seeded simulations converge to 1/n for staying and (n-1)/n for switching',()=>{
  for(const n of [3,10]){
    const random=m.mulberry32(n),t=m.tally(),games=100000;
    for(let i=0;i<games;i++){m.record(t,'stay',m.play(n,'stay',random));m.record(t,'switch',m.play(n,'switch',random));}
    for(const s of ['stay','switch']){const p=m.winProbability(n,s);a.ok(Math.abs(m.rate(t[s])-p)<4*m.standardError(p,games),`${n} ${s}`);}
  }
});
