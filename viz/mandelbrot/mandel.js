(function(root){
  // Everything lives in one self-contained factory so app.js can also rebuild it inside a Web Worker
  // from its source text (factory.toString()), with no second copy of the math.
  function factory(){
    const BAILOUT=256,B2=BAILOUT*BAILOUT,LOG_B=Math.log(BAILOUT),SPAN=3,MAX_ZOOM=2e12;

    // Points in the main cardioid or the period-2 disc never escape, so skip iterating them.
    function inMainBulbs(x,y){
      const a=x-0.25,q=a*a+y*y;
      return q*(q+a)<=0.25*y*y||(x+1)*(x+1)+y*y<=1/16;
    }
    // Continuous escape time: n − log₂(log|zₙ| / log B). Equals n when |zₙ| = B and n − 1 when |zₙ| = B²,
    // so the value has no jumps where the integer count does. Returns −1 for points that never escaped.
    function smooth(n,r2){return n-Math.log2(0.5*Math.log(r2)/LOG_B);}
    // Iterates z → z² + c from z₀ until |z| > B or maxIter. `eps` enables a periodicity check:
    // if z returns (within eps) to a saved value, the orbit is a cycle and the point is inside.
    function orbit(zx,zy,cx,cy,maxIter,eps){
      let x=zx,y=zy,x2=x*x,y2=y*y,sx=x,sy=y,check=8;
      for(let n=1;n<=maxIter;n++){
        y=2*x*y+cy;x=x2-y2+cx;x2=x*x;y2=y*y;
        if(x2+y2>B2)return smooth(n,x2+y2);
        if(eps){
          if(Math.abs(x-sx)<eps&&Math.abs(y-sy)<eps)return -1;
          if(n===check){sx=x;sy=y;check*=2;}
        }
      }
      return -1;
    }
    function escape(cx,cy,maxIter,eps=0){return inMainBulbs(cx,cy)?-1:orbit(0,0,cx,cy,maxIter,eps);}
    function julia(zx,zy,cx,cy,maxIter){return orbit(zx,zy,cx,cy,maxIter,0);}

    // Deeper views need more iterations before boundary points escape.
    function iterationsForZoom(zoom){const L=Math.log2(Math.max(1,zoom));return Math.round(Math.min(10000,200+50*Math.pow(L,1.3)));}

    // A view is a center and a zoom; at zoom 1 the shorter side of the canvas spans 3 units of the plane.
    function pixelSize(view,w,h){return SPAN/view.zoom/Math.min(w,h);}
    function toComplex(view,px,py,w,h){const s=pixelSize(view,w,h);return [view.x+(px-w/2)*s,view.y-(py-h/2)*s];}
    function clampZoom(z){return Math.min(MAX_ZOOM,Math.max(0.5,z));}
    // Zooms by `factor` while keeping the point under pixel (px, py) fixed on screen.
    function zoomAt(view,px,py,w,h,factor){
      const [cx,cy]=toComplex(view,px,py,w,h),next={zoom:clampZoom(view.zoom*factor)},s=pixelSize(next,w,h);
      next.x=cx-(px-w/2)*s;next.y=cy+(py-h/2)*s;return next;
    }

    // Fills `out` with smooth escape values for rows [y0, y1) of a grid whose cells are `s` canvas pixels wide.
    function renderRows(p,y0,y1,out){
      const {x,y,ps,W,H,s,gw,maxIter,eps}=p;let k=0;
      for(let gy=y0;gy<y1;gy++){
        const ci=y-((gy+0.5)*s-H/2)*ps;
        for(let gx=0;gx<gw;gx++)out[k++]=escape(x+((gx+0.5)*s-W/2)*ps,ci,maxIter,eps);
      }
      return out;
    }

    // Palettes are cyclic gradients; `inside` colours points that never escape.
    const PALETTES={
      classic:{name:'Classic',inside:'#03040a',stops:[[0,'#000764'],[0.16,'#206bcb'],[0.42,'#edffff'],[0.6425,'#ffaa00'],[0.8575,'#000200'],[1,'#000764']]},
      ember:{name:'Ember',inside:'#060204',stops:[[0,'#12040a'],[0.28,'#7a1424'],[0.52,'#e8663a'],[0.72,'#ffe2a0'],[0.86,'#a8351c'],[1,'#12040a']]},
      ocean:{name:'Ocean',inside:'#020a12',stops:[[0,'#03121f'],[0.3,'#0e4c6e'],[0.55,'#3fb6c9'],[0.72,'#effcff'],[0.86,'#2a7f9e'],[1,'#03121f']]},
      ink:{name:'Ink',inside:'#14171a',stops:[[0,'#fbfcfd'],[0.5,'#3a4048'],[1,'#fbfcfd']]},
    };
    const rgb=hex=>{const n=parseInt(hex.slice(1),16);return [n>>16&255,n>>8&255,n&255];};
    // Packs colours as little-endian RGBA so a Uint32Array view of ImageData can write a pixel at once.
    const pack=([r,g,b])=>(255<<24|b<<16|g<<8|r)>>>0;
    function gradient(name,t){
      const stops=PALETTES[name].stops;t=t-Math.floor(t);
      let i=1;while(i<stops.length-1&&stops[i][0]<t)i++;
      const [p0,c0]=stops[i-1],[p1,c1]=stops[i],u=(t-p0)/(p1-p0||1),e=u*u*(3-2*u),a=rgb(c0),b=rgb(c1);
      return a.map((v,k)=>Math.round(v+(b[k]-v)*e));
    }
    function lut(name,size=2048){const out=new Uint32Array(size);for(let i=0;i<size;i++)out[i]=pack(gradient(name,i/size));return out;}
    function insideColor(name){return pack(rgb(PALETTES[name].inside));}
    // Position in the palette for a smooth escape value. Values are measured from the view's `floor`
    // (the slowest-escaping outer region), so the far outside always starts at the palette's first colour
    // at any depth; the square root keeps bands wide away from the set and fine close to it.
    function shade(mu,offset,floor=0){const t=(Math.sqrt(Math.max(0,mu-floor)+1)-1)*0.22+offset;return t-Math.floor(t);}
    // A low percentile of the escaped values, robust to a few stray fast escapes.
    function floorOf(values){
      const v=Array.from(values).filter(x=>x>0).sort((a,b)=>a-b);
      return v.length?v[Math.floor((v.length-1)*0.05)]:0;
    }
    // Estimates the floor for a view from a coarse n×n sample before the real render starts.
    function sampleFloor(view,w,h,maxIter,n=24){
      const out=[];
      for(let j=0;j<n;j++)for(let i=0;i<n;i++){const [x,y]=toComplex(view,(i+0.5)*w/n,(j+0.5)*h/n,w,h);out.push(escape(x,y,maxIter,1e-10));}
      return floorOf(out);
    }

    return {BAILOUT,SPAN,MAX_ZOOM,inMainBulbs,smooth,escape,julia,iterationsForZoom,pixelSize,toComplex,clampZoom,zoomAt,renderRows,PALETTES,gradient,lut,insideColor,pack,shade,floorOf,sampleFloor};
  }
  const api=factory();api.factory=factory;
  if(typeof module!=='undefined')module.exports=api;else root.Mandel=api;
})(globalThis);
