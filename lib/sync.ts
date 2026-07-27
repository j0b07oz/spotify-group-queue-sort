import { database, unwrap } from './db';
import { queue } from './rooms';
import { roomToken, spotify } from './spotify';

export async function syncRoom(room: any) {
  const client = database();
  unwrap(await client.from('rooms').update({ sync_status: 'syncing', sync_error: null }).eq('id', room.id));
  try {
    const access = await roomToken(room);
    const playback = await spotify('/me/player', access).catch(() => null);
    const page = await spotify(`/playlists/${room.playlist_id}/tracks?fields=items(track(uri)),total&limit=100`, access);
    let prefix: string[] = [];
    if (playback?.context?.uri === `spotify:playlist:${room.playlist_id}` && playback.item?.uri) {
      const index = page.items.findIndex((item: any) => item.track?.uri === playback.item.uri);
      if (index >= 0) prefix = page.items.slice(0, index + 1).map((item: any) => item.track.uri);
    }
    const uris = [...prefix, ...(await queue(room.id)).map(item => item.uri)];
    await spotify(`/playlists/${room.playlist_id}/tracks`, access, { method: 'PUT', body: JSON.stringify({ uris: uris.slice(0, 100) }) });
    for (let i = 100; i < uris.length; i += 100) await spotify(`/playlists/${room.playlist_id}/tracks`, access, { method: 'POST', body: JSON.stringify({ uris: uris.slice(i, i + 100) }) });
    unwrap(await client.from('rooms').update({ sync_status: 'synced', sync_error: null }).eq('id', room.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Playlist sync failed';
    unwrap(await client.from('rooms').update({ sync_status: 'failed', sync_error: message }).eq('id', room.id));
    throw error;
  }
}
