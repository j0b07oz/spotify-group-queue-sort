export type PlaybackSnapshot={contextUri?:string;itemUri?:string};

export function buildPlaylistPlan(
  playlistId:string,
  lastSynced:string[],
  upcoming:string[],
  playback:PlaybackSnapshot|null,
){
  let prefix:string[]=[];
  if(playback?.contextUri===`spotify:playlist:${playlistId}`&&playback.itemUri){
    const currentIndex=lastSynced.indexOf(playback.itemUri);
    if(currentIndex<0)throw new Error('The current playlist item is not in Mixroom’s last synced snapshot; sync was stopped to protect playback');
    prefix=lastSynced.slice(0,currentIndex+1);
  }
  const preserved=new Set(prefix);
  return {
    prefix,
    uris:[...prefix,...upcoming.filter(uri=>!preserved.has(uri))],
  };
}
