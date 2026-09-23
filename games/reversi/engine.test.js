const {test}=require('node:test'),a=require('node:assert/strict'),g=require('./engine');
test('opening has four legal moves and captures correctly',()=>{const s=g.fresh();a.deepEqual(g.legal(s),[19,26,37,44]);a.ok(g.move(s,19));a.deepEqual(g.score(s),{black:4,white:1});a.equal(s.turn,2);a.equal(g.move(s,19),false);});
test('rows never wrap when finding captures',()=>{const s={board:Array(64).fill(0),turn:1,over:false,passed:0};s.board[7]=2;s.board[8]=1;a.deepEqual(g.flips(s,6),[]);});
test('a player with no legal moves passes',()=>{const s={board:Array(64).fill(2),turn:1,over:false,passed:0};s.board[0]=0;s.board[1]=1;g.settle(s);a.equal(s.turn,2);a.equal(s.passed,1);a.equal(s.over,false);g.move(s,0);a.ok(s.over);});
test('computer chooses legal moves and a full game terminates',()=>{const s=g.fresh();let turns=0;while(!s.over&&turns<65){const i=g.choose(s,1);a.ok(g.legal(s).includes(i));a.ok(g.move(s,i));a.ok(g.valid(s));turns++;}a.ok(s.over);a.ok(turns<=60);});
test('computer prefers an available corner',()=>{const s=g.fresh();s.turn=2;s.board[1]=1;s.board[2]=2;a.equal(g.choose(s,2),0);});
