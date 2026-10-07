(function(root){
  // Points are [x, y] pairs, read as complex numbers x + iy. Shapes are closed loops:
  // the last point joins back to the first.
  const TAU=2*Math.PI;

  function perimeter(points){
    let L=0;for(let i=0;i<points.length;i++){const [ax,ay]=points[i],[bx,by]=points[(i+1)%points.length];L+=Math.hypot(bx-ax,by-ay);}
    return L;
  }
  // n points spaced evenly by arc length around the closed loop, starting at points[0].
  function resample(points,n){
    const m=points.length,L=perimeter(points),out=[];
    if(!m)return out;
    if(!(L>0))return Array.from({length:n},()=>[points[0][0],points[0][1]]);
    let seg=0,segStart=0,segLen=Math.hypot(points[1%m][0]-points[0][0],points[1%m][1]-points[0][1]);
    for(let k=0;k<n;k++){
      const s=k*L/n;
      while(segStart+segLen<s&&seg<m-1){segStart+=segLen;seg++;const [ax,ay]=points[seg],[bx,by]=points[(seg+1)%m];segLen=Math.hypot(bx-ax,by-ay);}
      const [ax,ay]=points[seg],[bx,by]=points[(seg+1)%m],f=segLen>0?Math.min(1,(s-segStart)/segLen):0;
      out.push([ax+(bx-ax)*f,ay+(by-ay)*f]);
    }
    return out;
  }

  // Discrete Fourier transform: c_k = (1/N) Σ z_n e^(−2πikn/N). Frequencies are centered,
  // −N/2 < k ≤ N/2, so each term is the slowest circle that fits the samples.
  function dft(points){
    const N=points.length,terms=[];
    for(let j=0;j<N;j++){
      const freq=j<=N/2?j:j-N;let re=0,im=0;
      for(let n=0;n<N;n++){const a=-TAU*freq*n/N,c=Math.cos(a),s=Math.sin(a),[x,y]=points[n];re+=x*c-y*s;im+=x*s+y*c;}
      re/=N;im/=N;
      terms.push({freq,re,im,amp:Math.hypot(re,im),phase:Math.atan2(im,re)});
    }
    return terms;
  }
  // Biggest circles first; ties go to the slower one so the order is stable.
  function byAmplitude(terms){return terms.slice().sort((a,b)=>b.amp-a.amp||Math.abs(a.freq)-Math.abs(b.freq)||b.freq-a.freq);}
  // z(t) = Σ c_k e^(2πikt) for 0 ≤ t < 1, using the first `count` terms.
  function evaluate(terms,t,count=terms.length){
    let x=0,y=0;
    for(let i=0;i<count&&i<terms.length;i++){const {re,im,freq}=terms[i],a=TAU*freq*t,c=Math.cos(a),s=Math.sin(a);x+=re*c-im*s;y+=re*s+im*c;}
    return [x,y];
  }
  function reconstruct(terms,n,count){return Array.from({length:n},(_,i)=>evaluate(terms,i/n,count));}
  // Share of the signal's energy (Σ|c_k|², Parseval) carried by the first `count` terms.
  function energy(terms,count=terms.length){
    let used=0,total=0;terms.forEach((t,i)=>{const e=t.amp*t.amp;total+=e;if(i<count)used+=e;});
    return total>0?used/total:1;
  }
  function meanDistance(a,b){let d=0;for(let i=0;i<a.length;i++)d+=Math.hypot(a[i][0]-b[i][0],a[i][1]-b[i][1]);return a.length?d/a.length:0;}

  // ---- Preset shapes, in math coordinates (y up), roughly within the unit circle ----------
  function catmullRom(points,steps,closed){
    const m=points.length,out=[],P=i=>points[closed?(i+m)%m:Math.max(0,Math.min(m-1,i))];
    for(let i=0;i<(closed?m:m-1);i++){
      const p0=P(i-1),p1=P(i),p2=P(i+1),p3=P(i+2);
      for(let s=0;s<steps;s++){
        const t=s/steps,t2=t*t,t3=t2*t;
        out.push([0,1].map(d=>0.5*(2*p1[d]+(-p0[d]+p2[d])*t+(2*p0[d]-5*p1[d]+4*p2[d]-p3[d])*t2+(-p0[d]+3*p1[d]-3*p2[d]+p3[d])*t3)));
      }
    }
    if(!closed)out.push(points[m-1].slice());
    return out;
  }
  function heart(){
    return Array.from({length:400},(_,i)=>{const t=TAU*i/400,s=Math.sin(t);return [16*s*s*s/17,(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t)+2.5)/17];});
  }
  function star(points=5,inner=0.42){
    return Array.from({length:2*points},(_,i)=>{const r=i%2?inner:0.95,a=Math.PI/2+Math.PI*i/points;return [r*Math.cos(a),r*Math.sin(a)-0.04];});
  }
  // A treble-clef-like stroke: a curl at the foot, up the stem, a loop at the top, then a
  // spiral around the middle. Traced there and back so it forms a closed loop.
  function clef(){
    const stroke=catmullRom([
      [-0.22,-0.72],[-0.14,-0.84],[0.02,-0.82],[0.08,-0.62],[0.05,-0.2],[0.0,0.3],[0.03,0.62],[0.12,0.86],[0.21,0.93],
      [0.25,0.8],[0.15,0.56],[-0.12,0.3],[-0.34,0.04],[-0.4,-0.22],[-0.28,-0.43],[-0.04,-0.52],[0.22,-0.43],[0.33,-0.2],
      [0.24,0.0],[0.02,0.06],[-0.13,-0.07],[-0.11,-0.25],[0.04,-0.29],
    ],12,false);
    return stroke.concat(stroke.slice(1,-1).reverse());
  }
  // The outline of a π glyph, traced clockwise from the top-left curl.
  function pi(){
    return catmullRom([
      [-0.86,0.5],[-0.78,0.66],[-0.62,0.74],[0,0.74],[0.88,0.74],[0.88,0.56],[0.4,0.56],[0.4,-0.46],[0.47,-0.58],[0.58,-0.6],[0.68,-0.54],[0.73,-0.6],
      [0.65,-0.74],[0.5,-0.8],[0.34,-0.76],[0.25,-0.63],[0.22,-0.46],[0.22,0.56],[-0.27,0.56],[-0.29,0.02],[-0.36,-0.4],[-0.48,-0.66],[-0.6,-0.79],
      [-0.72,-0.78],[-0.75,-0.68],[-0.63,-0.52],[-0.53,-0.2],[-0.46,0.2],[-0.45,0.56],[-0.62,0.56],[-0.74,0.5],[-0.84,0.38],
    ].map(([x,y])=>[x*0.95,y*1.05]),6,true);
  }
  // Center on the bounding box and scale so the farthest point sits at the given radius.
  function fit(points,radius){
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
    const r=Math.max(...points.map(([x,y])=>Math.hypot(x-cx,y-cy)))||1;
    return points.map(([x,y])=>[(x-cx)*radius/r,(y-cy)*radius/r]);
  }
  const PRESETS=Object.fromEntries(Object.entries({heart,star,clef,pi}).map(([k,make])=>[k,()=>fit(make(),0.92)]));

  const api={TAU,perimeter,resample,dft,byAmplitude,evaluate,reconstruct,energy,meanDistance,catmullRom,fit,PRESETS};
  if(typeof module!=='undefined')module.exports=api;else root.Fourier=api;
})(globalThis);
