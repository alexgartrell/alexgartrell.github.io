(function(root){
  // A double pendulum: two point masses on massless rigid rods, angles measured from straight down.
  // State is [θ1, θ2, ω1, ω2]. Lengths in metres, masses in kilograms, g in m/s².
  function params(o={}){return {m1:1,m2:1,l1:1,l2:1,g:9.81,...o};}
  // Lagrangian equations of motion, solved for the angular accelerations.
  function derivs(s,p,out=new Float64Array(4)){
    const [t1,t2,w1,w2]=s,{m1,m2,l1,l2,g}=p,d=t1-t2,sd=Math.sin(d),cd=Math.cos(d);
    const den=2*m1+m2-m2*Math.cos(2*d);
    out[0]=w1;out[1]=w2;
    out[2]=(-g*(2*m1+m2)*Math.sin(t1)-m2*g*Math.sin(t1-2*t2)-2*sd*m2*(w2*w2*l2+w1*w1*l1*cd))/(l1*den);
    out[3]=2*sd*(w1*w1*l1*(m1+m2)+g*(m1+m2)*Math.cos(t1)+w2*w2*l2*m2*cd)/(l2*den);
    return out;
  }
  // One classical fourth-order Runge–Kutta step, in place.
  const k1=new Float64Array(4),k2=new Float64Array(4),k3=new Float64Array(4),k4=new Float64Array(4),tmp=new Float64Array(4);
  function rk4(s,p,dt){
    derivs(s,p,k1);
    for(let i=0;i<4;i++)tmp[i]=s[i]+dt/2*k1[i];derivs(tmp,p,k2);
    for(let i=0;i<4;i++)tmp[i]=s[i]+dt/2*k2[i];derivs(tmp,p,k3);
    for(let i=0;i<4;i++)tmp[i]=s[i]+dt*k3[i];derivs(tmp,p,k4);
    for(let i=0;i<4;i++)s[i]+=dt/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]);
    return s;
  }
  function advance(s,p,time,dt){const n=Math.max(1,Math.ceil(time/dt-1e-9)),h=time/n;for(let i=0;i<n;i++)rk4(s,p,h);return s;}
  // Kinetic plus potential energy, with the pivot as the zero of height.
  function energy(s,p){
    const [t1,t2,w1,w2]=s,{m1,m2,l1,l2,g}=p;
    const kinetic=0.5*m1*l1*l1*w1*w1+0.5*m2*(l1*l1*w1*w1+l2*l2*w2*w2+2*l1*l2*w1*w2*Math.cos(t1-t2));
    const potential=-(m1+m2)*g*l1*Math.cos(t1)-m2*g*l2*Math.cos(t2);
    return kinetic+potential;
  }
  // Bob positions with y pointing down from the pivot.
  function positions(s,p){
    const x1=p.l1*Math.sin(s[0]),y1=p.l1*Math.cos(s[0]);
    return [x1,y1,x1+p.l2*Math.sin(s[1]),y1+p.l2*Math.cos(s[1])];
  }
  function state(t1,t2,w1=0,w2=0){return Float64Array.of(t1,t2,w1,w2);}
  // A fan of pendulums whose outer angle differs by ε from one to the next.
  function fan(count,t1,t2,eps){return Array.from({length:count},(_,i)=>state(t1,t2+i*eps));}
  // Largest distance between the outer bob of any pendulum and the first one.
  function spread(states,p){
    const [,,ax,ay]=positions(states[0],p);let best=0;
    for(let i=1;i<states.length;i++){const [,,x,y]=positions(states[i],p);best=Math.max(best,Math.hypot(x-ax,y-ay));}
    return best;
  }
  // Angles that put a bob at (x, y): the inner bob points straight at it, the outer bob hangs from the inner one.
  function aim(x,y,ox=0,oy=0){return Math.atan2(x-ox,y-oy);}
  function wrap(a){return a-2*Math.PI*Math.floor((a+Math.PI)/(2*Math.PI));}
  // Normal-mode frequencies for small swings with equal masses and lengths: ω² = (g/l)(2 ∓ √2).
  function normalModes(g,l){return [Math.sqrt(g/l*(2-Math.SQRT2)),Math.sqrt(g/l*(2+Math.SQRT2))];}
  const api={params,derivs,rk4,advance,energy,positions,state,fan,spread,aim,wrap,normalModes};
  if(typeof module!=='undefined')module.exports=api;else root.DoublePendulum=api;
})(globalThis);
