const {test}=require('node:test'),a=require('node:assert/strict'),P=require('./pendulum');
const near=(x,y,eps)=>Math.abs(x-y)<=eps;
test('hanging straight down or balanced straight up, nothing accelerates',()=>{
  const p=P.params();
  for(const s of [P.state(0,0),P.state(Math.PI,Math.PI),P.state(0,Math.PI)]){const d=P.derivs(s,p);for(const v of d)a.ok(near(v,0,1e-12));}
  const d=P.derivs(P.state(0.3,0),p);a.ok(d[2]<0);a.ok(d[3]>0);
});
test('positions place the bobs on their rods',()=>{
  const p=P.params({l1:2,l2:0.5}),[x1,y1,x2,y2]=P.positions(P.state(Math.PI/2,0),p);
  a.ok(near(x1,2,1e-12)&&near(y1,0,1e-12)&&near(x2,2,1e-12)&&near(y2,0.5,1e-12));
  a.ok(near(P.aim(1,1),Math.PI/4,1e-12));a.ok(near(P.aim(0,-1),Math.PI,1e-12));
  a.ok(near(P.wrap(3*Math.PI/2),-Math.PI/2,1e-12));a.ok(near(P.wrap(-0.2),-0.2,1e-12));
});
test('RK4 conserves energy through 20 chaotic seconds',()=>{
  for(const p of [P.params(),P.params({m1:2,m2:0.5,l1:1.2,l2:0.7,g:3.7})]){
    const s=P.state(2.2,2.6,0.5,-1),E0=P.energy(s,p);let worst=0;
    for(let t=0;t<20;t+=0.1){P.advance(s,p,0.1,1/500);worst=Math.max(worst,Math.abs(P.energy(s,p)-E0));}
    a.ok(worst/Math.abs(E0)<1e-5,`relative drift ${worst/Math.abs(E0)}`);
  }
});
test('RK4 is fourth order: halving the step cuts the energy error about 16×',()=>{
  const p=P.params(),err=dt=>{const s=P.state(2,2.5),E0=P.energy(s,p);P.advance(s,p,2,dt);return Math.abs(P.energy(s,p)-E0);};
  const ratio=err(1/50)/err(1/100);a.ok(ratio>8&&ratio<40,`ratio ${ratio}`);
});
test('with a tiny outer mass, small swings match a simple pendulum',()=>{
  const p=P.params({m2:1e-9,l1:1.5}),theta0=0.01,w=Math.sqrt(p.g/p.l1),s=P.state(theta0,theta0);
  for(let t=0;t<10;){P.advance(s,p,0.25,1/1000);t+=0.25;a.ok(near(s[0],theta0*Math.cos(w*t),theta0*2e-3),`t=${t}`);}
});
test('equal arms swinging in the slow normal mode keep their shape and period',()=>{
  const p=P.params(),[slow]=P.normalModes(p.g,1),theta=0.005,s=P.state(theta,Math.SQRT2*theta),T=2*Math.PI/slow;
  P.advance(s,p,T/4,1/2000);a.ok(near(s[0],0,theta*0.01));a.ok(near(s[1],0,theta*0.01));
  P.advance(s,p,T/4,1/2000);a.ok(near(s[0],-theta,theta*0.01));a.ok(near(s[1]/s[0],Math.SQRT2,0.01));
  P.advance(s,p,T/2,1/2000);a.ok(near(s[0],theta,theta*0.01));
});
test('a fan starts ε apart and chaos pulls it apart',()=>{
  const p=P.params(),eps=1e-6,states=P.fan(5,2,2,eps);
  a.equal(states.length,5);a.ok(near(states[4][1]-states[0][1],4*eps,1e-15));
  a.ok(near(P.spread(states,p),4*eps,1e-9));
  for(const s of states)P.advance(s,p,20,1/1000);
  a.ok(P.spread(states,p)>0.1);
  const calm=P.fan(5,0.1,0.1,eps);for(const s of calm)P.advance(s,p,20,1/1000);a.ok(P.spread(calm,p)<1e-4);
});
