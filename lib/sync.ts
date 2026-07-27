import {db} from './db'; import {queue} from './rooms'; import {roomToken,spotify} from './spotify'; import {buildPlaylistPlan} from './playlist';
const locks=new Map<string,Promise<void>>();

async function performSync(room:any){
  db.prepare("UPDATE rooms SET sync_status='syncing',sync_error=NULL WHERE id=?").run(room.id);
  try{
    const freshRoom=db.prepare('SELECT * FROM rooms WHERE id=?').get(room.id) as any;
    const access=await roomToken(freshRoom);
    const playback=await spotify('/me/player',access);
    const upcoming=queue(room.id);
    const lastSynced=JSON.parse(freshRoom.synced_uris||'[]') as string[];
    const plan=buildPlaylistPlan(room.playlist_id,lastSynced,upcoming.map(x=>x.uri),playback?{
      contextUri:playback.context?.uri,
      itemUri:playback.item?.uri,
    }:null);
    const endpoint=`/playlists/${room.playlist_id}/items`;
    await spotify(endpoint,access,{method:'PUT',body:JSON.stringify({uris:plan.uris.slice(0,100)})});
    for(let i=100;i<plan.uris.length;i+=100)await spotify(endpoint,access,{method:'POST',body:JSON.stringify({uris:plan.uris.slice(i,i+100)})});
    const playedIds=upcoming.filter(x=>plan.prefix.includes(x.uri)).map(x=>x.submission_id);
    db.transaction(()=>{
      const markPlayed=db.prepare("UPDATE submissions SET state='played' WHERE id=? AND room_id=?");
      playedIds.forEach(id=>markPlayed.run(id,room.id));
      db.prepare("UPDATE rooms SET sync_status='synced',sync_error=NULL,synced_uris=? WHERE id=?").run(JSON.stringify(plan.uris),room.id);
    })();
  }catch(e){
    const message=e instanceof Error?e.message:'Playlist sync failed';
    db.prepare("UPDATE rooms SET sync_status='failed',sync_error=? WHERE id=?").run(message,room.id);
    throw e;
  }
}

export function syncRoom(room:any){
  const previous=locks.get(room.id)??Promise.resolve();
  const current=previous.catch(()=>{}).then(()=>performSync(room));
  locks.set(room.id,current);
  return current.finally(()=>{if(locks.get(room.id)===current)locks.delete(room.id)});
}
