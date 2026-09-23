const {test}=require('node:test'),a=require('node:assert/strict'),g=require('./engine');
test('every built-in picture has a unique solution',()=>{g.patterns.forEach((_,i)=>{const s=g.fresh(i);a.equal(g.countSolutions(s),1,s.name);});});
test('clues represent empty lines and separated runs',()=>{a.deepEqual(g.runs([0,0,0]),[0]);a.deepEqual(g.runs([1,1,0,1,0,1,1,1]),[2,1,3]);});
test('fill and cross toggle independently; win needs only the correct filled cells',()=>{const s=g.fresh();g.mark(s,0);a.equal(s.cells[0],1);g.mark(s,0,true);a.equal(s.cells[0],-1);g.mark(s,0,true);a.equal(s.cells[0],0);s.cells=[...s.solution];a.ok(g.won(s));s.cells[s.solution.indexOf(0)]=1;a.equal(g.won(s),false);});
