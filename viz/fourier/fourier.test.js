const {test}=require('node:test'),a=require('node:assert/strict'),f=require('./fourier');
const close=(x,y,eps=1e-9)=>a.ok(Math.abs(x-y)<eps,`${x} ≉ ${y}`);

test('resampling spaces points evenly along the closed loop',()=>{
  const square=[[0,0],[3,0],[3,1],[0,1]],pts=f.resample(square,16);
  a.equal(pts.length,16);a.deepEqual(pts[0],[0,0]);close(f.perimeter(square),8);
  for(let i=0;i<16;i++){const [ax,ay]=pts[i],[bx,by]=pts[(i+1)%16];close(Math.abs(bx-ax)+Math.abs(by-ay),0.5);}
  // Uneven input spacing (lots of points on one side) comes out even.
  const lopsided=[...Array.from({length:51},(_,i)=>[i/50,0]),[1,1],[0,1]];
  const even=f.resample(lopsided,40);
  for(let i=0;i<40;i++){const [ax,ay]=even[i],[bx,by]=even[(i+1)%40];close(Math.abs(bx-ax)+Math.abs(by-ay),0.1,1e-9);}
  a.deepEqual(f.resample([[2,3]],4),[[2,3],[2,3],[2,3],[2,3]]);
});

test('reconstructing with every term reproduces the samples exactly',()=>{
  for(const [name,make] of Object.entries(f.PRESETS)){
    for(const n of [64,129]){
      const pts=f.resample(make(),n),terms=f.byAmplitude(f.dft(pts)),back=f.reconstruct(terms,n);
      a.equal(terms.length,n,name);
      back.forEach((p,i)=>{close(p[0],pts[i][0],1e-9);close(p[1],pts[i][1],1e-9);});
      close(f.meanDistance(back,pts),0,1e-9);
    }
  }
});

test('a circle is one dominant term, and its direction sets the sign of the frequency',()=>{
  const circle=(r,dir,phase)=>Array.from({length:100},(_,i)=>{const t=f.TAU*i/100;return [r*Math.cos(dir*t+phase),r*Math.sin(dir*t+phase)];});
  const ccw=f.byAmplitude(f.dft(circle(0.7,1,0.3)));
  a.equal(ccw[0].freq,1);close(ccw[0].amp,0.7);close(ccw[0].phase,0.3);
  a.ok(ccw.slice(1).every(t=>t.amp<1e-12));
  const cw=f.byAmplitude(f.dft(circle(2,-1,0)));
  a.equal(cw[0].freq,-1);close(cw[0].amp,2);close(f.energy(cw,1),1);
  // A shifted circle adds only a constant (k = 0) term for the center.
  const shifted=f.byAmplitude(f.dft(circle(1,1,0).map(([x,y])=>[x+3,y-4])));
  a.deepEqual(shifted.slice(0,2).map(t=>t.freq).sort(),[0,1]);close(shifted[0].amp,5);close(shifted[1].amp,1);
});

test('energy follows Parseval and approximations improve with more terms',()=>{
  const pts=f.resample(f.PRESETS.star(),128),terms=f.byAmplitude(f.dft(pts));
  const meanSq=pts.reduce((s,[x,y])=>s+x*x+y*y,0)/pts.length,sum=terms.reduce((s,t)=>s+t.amp*t.amp,0);
  close(sum,meanSq,1e-12);close(f.energy(terms),1);
  let prev=Infinity;
  for(const count of [1,2,4,8,16,32,64,128]){const err=f.meanDistance(f.reconstruct(terms,128,count),pts);a.ok(err<=prev+1e-12);prev=err;}
  a.ok(f.energy(terms,10)>0.95&&f.energy(terms,10)<1);
});

test('presets are finite closed loops that fit inside the unit circle',()=>{
  for(const [name,make] of Object.entries(f.PRESETS)){
    const pts=make();a.ok(pts.length>=10,name);
    a.ok(pts.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&Math.hypot(x,y)<1.05),name);
  }
});
