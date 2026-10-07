const {test}=require('node:test'),a=require('node:assert/strict'),S=require('./sorts');
const NAMES=Object.keys(S.ALGORITHMS),random=S.mulberry32(11);
const inputs=()=>[[],[1],[2,1],[3,3,3],[5,1,4,2,3],...['random','nearly','reversed','few'].flatMap(t=>[7,40,101].map(n=>S.makeInput(t,n,random)))];

test('every algorithm sorts every kind of input',()=>{
  for(const name of NAMES)for(const input of inputs()){
    const {result}=S.count(name,input);
    a.deepEqual(result,input.slice().sort((x,y)=>x-y),`${name} on ${input.length} items`);
  }
});
test('replaying only the swap and write events reproduces the sorted array',()=>{
  for(const name of NAMES)for(const input of inputs()){
    const live=input.slice(),copy=input.slice();
    for(const e of S.ALGORITHMS[name].sort(live)){
      a.ok(e.i>=0&&e.i<input.length,`${name} index ${e.i} in range`);
      if(e.type==='compare'){a.ok(e.j>=0&&e.j<input.length&&e.j!==e.i);}
      else if(e.type==='swap'){const t=copy[e.i];copy[e.i]=copy[e.j];copy[e.j]=t;}
      else{a.equal(e.type,'write');copy[e.i]=e.v;}
    }
    a.deepEqual(copy,live,name);
  }
});
test('on already sorted input the adaptive sorts do one pass and no writes',()=>{
  const sorted=Array.from({length:50},(_,i)=>i);
  for(const name of ['bubble','insertion']){const c=S.count(name,sorted);a.equal(c.compares,49);a.equal(c.writes,0);}
  a.equal(S.count('selection',sorted).compares,50*49/2);a.equal(S.count('selection',sorted).writes,0);
});
test('comparison counts match the textbook bounds',()=>{
  const n=128,shuffled=S.makeInput('random',n,S.mulberry32(3)),log=Math.log2(n);
  a.equal(S.count('selection',shuffled).compares,n*(n-1)/2);
  a.ok(S.count('bubble',shuffled).compares<=n*(n-1)/2);
  a.equal(S.count('bubble',S.makeInput('reversed',n)).compares,n*(n-1)/2);
  a.equal(S.count('insertion',S.makeInput('reversed',n)).writes,n*(n-1),'every pair is swapped once, two writes each');
  const merge=S.count('merge',shuffled);a.ok(merge.compares<=n*log);a.equal(merge.writes,n*log,'each level rewrites the whole array');
  for(const name of ['quick','heap'])a.ok(S.count(name,shuffled).compares<3*n*log,name);
  a.ok(S.count('quick',S.makeInput('few',n,S.mulberry32(4))).compares<3*n*log,'duplicates do not make quicksort quadratic');
  a.ok(S.count('quick',S.makeInput('reversed',n)).compares<3*n*log,'median of three handles reversed input');
});
test('a race on random input ends with the n log n sorts ahead of the quadratic ones',()=>{
  const input=S.makeInput('random',60,S.mulberry32(9)),steps=Object.fromEntries(NAMES.map(n=>[n,S.count(n,input).steps]));
  for(const fast of ['merge','quick','heap'])for(const slow of ['bubble','insertion','selection'])a.ok(steps[fast]<steps[slow],`${fast} beats ${slow}`);
});
test('inputs have the right shape',()=>{
  const r=S.mulberry32(1);
  a.deepEqual(S.makeInput('reversed',5,r),[5,4,3,2,1]);
  a.deepEqual(S.makeInput('random',30,r).sort((x,y)=>x-y),Array.from({length:30},(_,i)=>i+1));
  a.equal(new Set(S.makeInput('few',40,r)).size,4);
  const nearly=S.makeInput('nearly',100,r);let out=0;nearly.forEach((v,i)=>{if(v!==i+1)out++;});a.ok(out>0&&out<=20);
  a.ok(S.isSorted([1,2,2,3]));a.equal(S.isSorted([2,1]),false);
});
