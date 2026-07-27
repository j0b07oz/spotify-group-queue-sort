'use client'; import {useCallback,useEffect,useState} from 'react'; import {Copy,Lock,RefreshCw,Search,Trash2,Unlock} from 'lucide-react'; import type {QueueItem,Track} from '@/lib/types';
export default function Room({code,isHost}:{code:string,isHost:boolean}){
  const [data,setData]=useState<any>();
  const [q,setQ]=useState('');
  const [results,setResults]=useState<Track[]>([]);
  const [name,setName]=useState('Guest');
  const [error,setError]=useState('');
  const load=useCallback(async()=>{
    try{const r=await fetch(`/api/rooms/${code}`),x=await r.json();if(!r.ok)throw new Error(x.error||'Could not load the room');setData(x)}
    catch(e){setError(e instanceof Error?e.message:'Could not load the room')}
  },[code]);
  useEffect(()=>{void load()},[load]);
  useEffect(()=>{
    if(q.trim().length<2){setResults([]);return}
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      try{const r=await fetch(`/api/rooms/${code}/search?q=${encodeURIComponent(q)}`,{signal:controller.signal}),x=await r.json();if(!r.ok)throw new Error(x.error||'Search unavailable');setResults(x.tracks);setError('')}
      catch(e){if(e instanceof Error&&e.name!=='AbortError')setError(e.message)}
    },350);
    return()=>{clearTimeout(timer);controller.abort()}
  },[q,code]);
  async function submit(track:Track){const r=await fetch(`/api/rooms/${code}/submit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({track:{id:track.id},guest_name:name})}),x=await r.json();if(!r.ok)setError(x.error);else{setError('');setQ('');setResults([]);void load()}}
  async function action(action:string,id?:string,position?:number){const r=await fetch(`/api/rooms/${code}/actions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id,position})}),x=await r.json();if(!r.ok)setError(x.error);else setError('');void load()}
  async function lock(){const r=await fetch(`/api/rooms/${code}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({locked:!data.room.locked})}),x=await r.json();if(!r.ok)setError(x.error);else setError('');void load()}
  if(!data)return <div className="room">{error||'Loading the room…'}</div>;
  return <main className="room"><header className="room-head"><b className="brand">↗ MIXROOM</b><div><strong>{data.room.name}</strong><div className="pill">{data.queue.length} upcoming · {data.room.locked?'locked':'open'}</div></div><button className="primary" onClick={()=>navigator.clipboard.writeText(location.href)}><Copy size={16}/> COPY INVITE</button></header>{error&&<p className="status">{error} <button aria-label="Dismiss error" onClick={()=>setError('')}>×</button></p>}{data.room.sync_status==='failed'&&<p className="status">Spotify sync needs attention: {data.room.sync_error}{isHost&&<> <button onClick={()=>action('sync')}>Retry</button></>}</p>}<div className="grid"><section><h2>Add a track</h2><input aria-label="Guest name" className="search" value={name} maxLength={30} onChange={e=>setName(e.target.value)} placeholder="Your name"/><div style={{height:8}}/><label className="row"><Search size={18}/><input aria-label="Search Spotify" className="search" value={q} onChange={e=>setQ(e.target.value)} placeholder={data.room.locked?'Queue is locked':'Search songs, artists, albums…'} disabled={data.room.locked}/></label><div className="results">{results.map(t=><TrackRow key={t.id} track={t}><button onClick={()=>submit(t)}>+ ADD</button></TrackRow>)}</div>{results.length>0&&<p className="spotify-credit">Search results provided by Spotify</p>}</section><aside><div className="actions"><h2 style={{flex:1}}>Up next</h2>{isHost&&<><button aria-label={data.room.locked?'Unlock queue':'Lock queue'} title={data.room.locked?'Unlock queue':'Lock queue'} onClick={lock}>{data.room.locked?<Unlock size={16}/>:<Lock size={16}/>}</button><button aria-label="Force re-sort" title="Force re-sort" onClick={()=>action('sort')}><RefreshCw size={16}/></button></>}</div><div className="queue">{data.queue.map((t:QueueItem,i:number)=><TrackRow key={t.id} track={t}><small>#{i+1} · {t.guest_name}</small>{isHost&&<><button aria-label={`Move ${t.name} up`} disabled={!i} onClick={()=>action('move',t.submission_id,i-1)}>↑</button><button aria-label={`Remove ${t.name}`} onClick={()=>action('remove',t.submission_id)}><Trash2 size={14}/></button></>}</TrackRow>)}</div>{!data.queue.length&&<p className="muted">The floor is yours. Add the first track.</p>}</aside></div></main>
}
function TrackRow({track,children}:{track:Track,children:React.ReactNode}){return <div className="row">{track.image_url?<img src={track.image_url} alt=""/>:<div/>}<div><a className="track-link" href={`https://open.spotify.com/track/${track.id}`} target="_blank" rel="noreferrer"><b>{track.name}</b></a><small>{track.artists.join(', ')} · {track.album}</small></div>{children}</div>}
