import type {QueueItem} from './types';
const val=(n:number|null,f=.5)=>n??f;
export function distance(a:QueueItem,b:QueueItem){const year=Math.abs(val(a.release_year,2015)-val(b.release_year,2015))/60;const tempo=Math.abs(val(a.tempo,120)-val(b.tempo,120))/100;const numeric=['danceability','acousticness','energy','valence'] as const;let d=year*.3+tempo*.25;for(const k of numeric)d+=Math.abs(val(a[k])-val(b[k]))*.7;if(a.key_num!==null&&b.key_num!==null)d+=Math.min(Math.abs(a.key_num-b.key_num),12-Math.abs(a.key_num-b.key_num))*.035;if(a.genres.some(g=>b.genres.includes(g)))d-=.35;return d}
export function mix(items:QueueItem[]){
  if(items.length<2)return items.map((x,i)=>({...x,position:i}));
  const pinned=new Map(items.filter(x=>x.pinned).map(x=>[x.position,x]));
  const pool=items.filter(x=>!x.pinned);
  const out:QueueItem[]=[];
  for(let position=0;position<items.length;position++){
    const fixed=pinned.get(position);
    if(fixed){out.push(fixed);continue}
    if(!pool.length)continue;
    if(!out.length){out.push(pool.shift()!);continue}
    const prev=out.at(-1)!;
    const recent=new Set(out.slice(-3).flatMap(y=>y.artist_ids));
    let best=0,score=Infinity;
    pool.forEach((x,i)=>{
      let candidate=distance(prev,x);
      if(x.artist_ids.some(a=>recent.has(a)))candidate+=4;
      if(candidate<score){score=candidate;best=i}
    });
    out.push(pool.splice(best,1)[0]);
  }
  return out.map((x,i)=>({...x,position:i}));
}
