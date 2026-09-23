(function(root){
  const directions={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};
  function food(s,random=Math.random){const used=new Set(s.snake.map(p=>p.y*s.size+p.x));const empty=Array.from({length:s.size*s.size},(_,i)=>i).filter(i=>!used.has(i));if(!empty.length)return null;const i=empty[Math.floor(random()*empty.length)];return {x:i%s.size,y:Math.floor(i/s.size)};}
  function fresh(){const s={size:20,snake:[{x:10,y:10},{x:9,y:10},{x:8,y:10}],direction:'right',queue:[],score:0,over:false,won:false,food:null};s.food=food(s);return s;}
  function turn(s,dir){if(!directions[dir]||s.over||s.queue.length>=2)return false;const last=s.queue.at(-1)||s.direction,[x,y]=directions[last],[dx,dy]=directions[dir];if(last===dir||(x+dx===0&&y+dy===0))return false;s.queue.push(dir);return true;}
  function step(s){
    if(s.over)return false;
    if(s.queue.length)s.direction=s.queue.shift();
    const [dx,dy]=directions[s.direction],head={x:s.snake[0].x+dx,y:s.snake[0].y+dy};
    const eating=s.food&&head.x===s.food.x&&head.y===s.food.y;
    const body=eating?s.snake:s.snake.slice(0,-1);
    if(head.x<0||head.y<0||head.x>=s.size||head.y>=s.size||body.some(p=>p.x===head.x&&p.y===head.y)){s.over=true;return false;}
    s.snake.unshift(head);if(eating){s.score++;s.food=food(s);if(!s.food){s.won=true;s.over=true;}}else s.snake.pop();return true;
  }
  function valid(s){const point=p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<20&&p.y>=0&&p.y<20;return s&&s.size===20&&Array.isArray(s.snake)&&s.snake.length>=3&&s.snake.length<=400&&s.snake.every(point)&&new Set(s.snake.map(p=>p.y*20+p.x)).size===s.snake.length&&Object.hasOwn(directions,s.direction)&&Array.isArray(s.queue)&&s.queue.length<=2&&s.queue.every(d=>Object.hasOwn(directions,d))&&Number.isInteger(s.score)&&s.score>=0&&typeof s.over==='boolean'&&typeof s.won==='boolean'&&(s.food===null? s.won:point(s.food));}
  const api={fresh,food,turn,step,valid};if(typeof module!=='undefined')module.exports=api;else root.Snake=api;
})(globalThis);
