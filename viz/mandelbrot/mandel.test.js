const {test}=require('node:test'),a=require('node:assert/strict'),M=require('./mandel');
const close=(x,y,tol=1e-9)=>a.ok(Math.abs(x-y)<=tol,`${x} ≈ ${y}`);

test('points in the set never escape; points outside do',()=>{
  for(const [x,y] of [[0,0],[-1,0],[-2,0],[-0.1226,0.7449],[0.25,0],[-1.75,0],[0,1]])a.equal(M.escape(x,y,500),-1,`${x}+${y}i`);
  for(const [x,y] of [[1,0],[0.5,0.5],[-2.1,0],[0,1.1],[-0.75,0.1]])a.ok(M.escape(x,y,500)>0,`${x}+${y}i`);
});
test('the escape value counts iterations until |z| passes the bailout',()=>{
  // c = 2: z goes 2, 6, 38, 1446 and passes 256 on iteration 4.
  const mu=M.escape(2,0,100);a.ok(mu>3&&mu<=4);
  close(M.smooth(4,256*256),4);close(M.smooth(4,256**4),3);
});
test('smooth colouring is continuous where the integer count jumps',()=>{
  let prev=M.escape(-2,1.15,1000),worst=0;const counts=new Set();
  for(let k=1;k<=5000;k++){const v=M.escape(-2+k*0.0005,1.15,1000);counts.add(Math.ceil(v));worst=Math.max(worst,Math.abs(v-prev));prev=v;}
  a.ok(counts.size>=4,'the line crosses several integer bands');
  a.ok(worst<0.02,`largest jump between neighbours was ${worst}`);
});
test('the cardioid and bulb shortcut agrees with plain iteration',()=>{
  const random=(s=>()=>(s=s*16807%2147483647)/2147483647)(7);
  for(let k=0;k<3000;k++){
    const x=-2+random()*2.5,y=random()*1.2-0.6;
    if(M.inMainBulbs(x,y))a.equal(M.escape(x,y,2000),-1);
  }
  a.ok(M.inMainBulbs(0,0)&&M.inMainBulbs(-1,0)&&!M.inMainBulbs(0.3,0)&&!M.inMainBulbs(-1.3,0));
});
test('the periodicity check finds cycles without changing which points escape',()=>{
  for(let i=0;i<60;i++)for(let j=0;j<40;j++){
    const x=-2+i*0.045,y=j*0.03,plain=M.escape(x,y,800),fast=M.escape(x,y,800,1e-12);
    a.equal(fast<0,plain<0,`${x}+${y}i`);if(plain>0)close(fast,plain,1e-9);
  }
});
test('the Julia set for c = 0 is the unit disc',()=>{
  a.equal(M.julia(0.5,0.5,0,0,300),-1);a.equal(M.julia(0,-0.99,0,0,300),-1);
  a.ok(M.julia(1.05,0,0,0,300)>0);a.ok(M.julia(-0.8,0.8,0,0,300)>0);
  a.equal(M.julia(0,0,-1,0,300),-1);
});
test('zooming keeps the point under the cursor fixed',()=>{
  const view={x:-0.6,y:0.1,zoom:3},w=800,h=600,before=M.toComplex(view,123,456,w,h);
  for(const f of [2,0.5,10]){const next=M.zoomAt(view,123,456,w,h,f),after=M.toComplex(next,123,456,w,h);close(after[0],before[0],1e-12);close(after[1],before[1],1e-12);close(next.zoom,view.zoom*f);}
  a.deepEqual(M.toComplex(view,400,300,w,h),[-0.6,0.1]);
  close(M.pixelSize({x:0,y:0,zoom:1},300,600),0.01);
  a.equal(M.clampZoom(1e20),M.MAX_ZOOM);
});
test('iteration budget grows with zoom but stays bounded',()=>{
  let last=0;for(let z=1;z<=1e13;z*=10){const n=M.iterationsForZoom(z);a.ok(n>last);last=n;}
  a.equal(M.iterationsForZoom(1),200);a.ok(M.iterationsForZoom(1e13)<=10000);
});
test('render rows fills a grid of escape values in reading order',()=>{
  const p={x:-0.5,y:0,ps:0.01,W:40,H:20,s:2,gw:20,maxIter:100,eps:0},out=new Float32Array(20*3);
  M.renderRows(p,4,7,out);
  close(out[0],M.escape(-0.5+(1-20)*0.01,0-(9-10)*0.01,100),1e-5);
  close(out[2*20+5],M.escape(-0.5+(11-20)*0.01,0-(13-10)*0.01,100),1e-5);
});
test('palettes are cyclic and pack to RGBA',()=>{
  for(const name in M.PALETTES){const t=M.lut(name,64);a.equal(t.length,64);a.deepEqual(M.gradient(name,0),M.gradient(name,1));a.equal(t[0]>>>24,255);}
  a.equal(M.pack([1,2,3]),0xff030201);a.deepEqual(M.gradient('classic',0.42),[237,255,255]);
  for(const mu of [0,3.7,120,5000]){const s=M.shade(mu,0.3);a.ok(s>=0&&s<1);}
});
test('shading starts each view at the first palette colour, measured from its floor',()=>{
  a.equal(M.shade(25,0,25),0);a.equal(M.shade(10,0,25),0);a.ok(M.shade(30,0,25)>0);
  a.equal(M.floorOf([-1,-1,5,6,7,100]),5);a.equal(M.floorOf([-1]),0);
  const home=M.sampleFloor({x:-0.6,y:0,zoom:1},400,400,200),sea=M.sampleFloor({x:-0.7445,y:0.122,zoom:110},400,400,800);
  a.ok(home>2&&home<6,`overview floor ${home}`);a.ok(sea>20&&sea<30,`seahorse floor ${sea}`);
});
