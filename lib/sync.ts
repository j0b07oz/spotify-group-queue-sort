import { database, unwrap } from './db';
import { queue } from './rooms';
import { roomToken, spotify } from './spotify';

export async function syncRoom(room: any) {
  const client = database();
  unwrap(await client.from('rooms').update({ sync_status: 'syncing', sync_error: null }).eq('id', room.id));
  try {
    const access = await roomToken(room);
    const playback = await spotify('/me/player', access).catch(() => null);
    const playlistItems: any[] = [];
    for (let offset = 0; ; offset += 50) {
      const page = await spotify(
        `/playlists/${room.playlist_id}/items?fields=items(item(uri)),total&limit=50&offset=${offset}`,
        access
      );
      playlistItems.push(...page.items);
      if (!page.items.length || playlistItems.length >= page.total) break;
    }

    let prefix: string[] = [];
    if (playback?.context?.uri === `spotify:playlist:${room.playlist_id}` && playback.item?.uri) {
      const index = playlistItems.findIndex((entry: any) => entry.item?.uri === playback.item.uri);
      if (index >= 0) prefix = playlistItems.slice(0, index + 1).map((entry: any) => entry.item.uri);
    }

    const uris = [...prefix, ...(await queue(room.id)).map(item => item.uri)];
    const itemsPath = `/playlists/${room.playlist_id}/items`;
    await spotify(itemsPath, access, { method: 'PUT', body: JSON.stringify({ uris: uris.slice(0, 100) }) });
    for (let i = 100; i < uris.length; i += 100) {
      await spotify(itemsPath, access, { method: 'POST', body: JSON.stringify({ uris: uris.slice(i, i + 100) }) });
    }
    unwrap(await client.from('rooms').update({ sync_status: 'synced', sync_error: null }).eq('id', room.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Playlist sync failed';
    unwrap(await client.from('rooms').update({ sync_status: 'failed', sync_error: message }).eq('id', room.id));
    throw error;
  }
}
