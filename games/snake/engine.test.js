const {test}=require('node:test'),a=require('node:assert/strict'),g=require('./engine');
test('snake cannot reverse, including buffered turns',()=>{const s=g.fresh();a.equal(g.turn(s,'left'),false);a.ok(g.turn(s,'up'));a.equal(g.turn(s,'down'),false);a.ok(g.turn(s,'left'));g.step(s);a.equal(s.direction,'up');g.step(s);a.equal(s.direction,'left');});
test('food grows the snake and respawns outside its body',()=>{const s=g.fresh();s.food={x:11,y:10};g.step(s);a.equal(s.score,1);a.equal(s.snake.length,4);a.ok(!s.snake.some(p=>p.x===s.food.x&&p.y===s.food.y));a.ok(g.valid(s));});
test('walls end the game without moving outside the board',()=>{const s=g.fresh();s.snake=[{x:19,y:0},{x:18,y:0},{x:17,y:0}];g.step(s);a.ok(s.over);a.equal(s.snake[0].x,19);});
test('moving into the vacated tail is legal',()=>{const s=g.fresh();s.snake=[{x:1,y:1},{x:1,y:2},{x:0,y:2},{x:0,y:1}];s.direction='left';s.food={x:8,y:8};a.ok(g.step(s));a.equal(s.over,false);});
