(function(root){
  // Each sort is a generator that sorts `a` in place and yields one event per step:
  //   {type:'compare', i, j}  read a[i] and a[j] and compare them
  //   {type:'swap', i, j}     a[i] and a[j] have just been exchanged (two writes)
  //   {type:'write', i, v}    a[i] has just been set to v (one write; merge sort copies from a buffer)
  const cmp=(i,j)=>({type:'compare',i,j}),swp=(i,j)=>({type:'swap',i,j});
  function swap(a,i,j){const t=a[i];a[i]=a[j];a[j]=t;}

  function* bubble(a){
    for(let end=a.length-1;end>0;end--){
      let swapped=false;
      for(let i=0;i<end;i++){yield cmp(i,i+1);if(a[i]>a[i+1]){swap(a,i,i+1);swapped=true;yield swp(i,i+1);}}
      if(!swapped)return;
    }
  }
  function* insertion(a){
    for(let i=1;i<a.length;i++)
      for(let j=i;j>0;j--){yield cmp(j-1,j);if(a[j-1]<=a[j])break;swap(a,j-1,j);yield swp(j-1,j);}
  }
  function* selection(a){
    for(let i=0;i<a.length-1;i++){
      let min=i;
      for(let j=i+1;j<a.length;j++){yield cmp(j,min);if(a[j]<a[min])min=j;}
      if(min!==i){swap(a,i,min);yield swp(i,min);}
    }
  }
  // Top-down merge sort. Copying a run into the buffer is free; every write back into the array is an event.
  function* merge(a){
    const buf=a.slice();
    function* sort(lo,hi){
      if(hi-lo<2)return;
      const mid=(lo+hi)>>1;yield* sort(lo,mid);yield* sort(mid,hi);
      for(let k=lo;k<hi;k++)buf[k]=a[k];
      let i=lo,j=mid;
      for(let k=lo;k<hi;k++){
        if(i<mid&&j<hi){yield cmp(i,j);a[k]=buf[j]<buf[i]?buf[j++]:buf[i++];}
        else a[k]=i<mid?buf[i++]:buf[j++];
        yield {type:'write',i:k,v:a[k]};
      }
    }
    yield* sort(0,a.length);
  }
  // Quicksort with a median-of-three pivot parked at a[lo]. Both scans stop on keys equal to the pivot,
  // which keeps inputs with many duplicates balanced instead of quadratic.
  function* quick(a){
    function* sort(lo,hi){
      if(hi<=lo)return;
      const mid=(lo+hi)>>1;
      if(hi-lo>=2){
        yield cmp(lo,mid);if(a[mid]<a[lo]){swap(a,lo,mid);yield swp(lo,mid);}
        yield cmp(mid,hi);if(a[hi]<a[mid]){swap(a,mid,hi);yield swp(mid,hi);
          yield cmp(lo,mid);if(a[mid]<a[lo]){swap(a,lo,mid);yield swp(lo,mid);}}
        swap(a,lo,mid);yield swp(lo,mid);
      }
      let i=lo,j=hi+1;
      for(;;){
        while(true){i++;if(i>hi)break;yield cmp(i,lo);if(!(a[i]<a[lo]))break;}
        while(true){j--;if(j===lo)break;yield cmp(lo,j);if(!(a[lo]<a[j]))break;}
        if(i>=j)break;
        swap(a,i,j);yield swp(i,j);
      }
      if(j!==lo){swap(a,lo,j);yield swp(lo,j);}
      yield* sort(lo,j-1);yield* sort(j+1,hi);
    }
    yield* sort(0,a.length-1);
  }
  function* heap(a){
    const n=a.length;
    function* sift(i,size){
      for(;;){
        const l=2*i+1,r=l+1;let big=i;
        if(l<size){yield cmp(l,big);if(a[l]>a[big])big=l;}
        if(r<size){yield cmp(r,big);if(a[r]>a[big])big=r;}
        if(big===i)return;
        swap(a,i,big);yield swp(i,big);i=big;
      }
    }
    for(let i=(n>>1)-1;i>=0;i--)yield* sift(i,n);
    for(let end=n-1;end>0;end--){swap(a,0,end);yield swp(0,end);yield* sift(0,end);}
  }

  const ALGORITHMS={
    bubble:{name:'Bubble sort',sort:bubble,big:'O(n²)'},
    insertion:{name:'Insertion sort',sort:insertion,big:'O(n²)'},
    selection:{name:'Selection sort',sort:selection,big:'O(n²)'},
    merge:{name:'Merge sort',sort:merge,big:'O(n log n)'},
    quick:{name:'Quicksort',sort:quick,big:'O(n log n)'},
    heap:{name:'Heap sort',sort:heap,big:'O(n log n)'},
  };

  // Runs a sort to completion and tallies its events, for tests and estimates.
  function count(name,input){
    const a=input.slice(),c={compares:0,writes:0,steps:0};
    for(const e of ALGORITHMS[name].sort(a)){c.steps++;if(e.type==='compare')c.compares++;else c.writes+=e.type==='swap'?2:1;}
    return Object.assign(c,{result:a});
  }

  function shuffle(a,random){for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));swap(a,i,j);}return a;}
  // Values are 1..n so bar heights fill the lane; "few unique" uses four distinct heights.
  function makeInput(type,n,random){
    const sorted=Array.from({length:n},(_,i)=>i+1);
    if(type==='reversed')return sorted.reverse();
    if(type==='nearly'){const a=sorted;for(let k=0;k<Math.max(1,Math.round(n/12));k++){const i=Math.floor(random()*n),j=Math.min(n-1,i+1+Math.floor(random()*3));swap(a,i,j);}return a;}
    if(type==='few')return shuffle(sorted.map(v=>Math.ceil(v/n*4)*Math.ceil(n/4)),random);
    return shuffle(sorted,random);
  }
  function isSorted(a){for(let i=1;i<a.length;i++)if(a[i-1]>a[i])return false;return true;}
  function mulberry32(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

  const api={ALGORITHMS,bubble,insertion,selection,merge,quick,heap,count,shuffle,makeInput,isSorted,mulberry32};
  if(typeof module!=='undefined')module.exports=api;else root.Sorts=api;
})(globalThis);
