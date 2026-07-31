import { database, unwrap } from './db';
import { queue } from './rooms';
import { roomToken, spotify } from './spotify';
import { buildPlaylistPlan } from './playlist';

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

    const upcoming = await queue(room.id);
    const plan = buildPlaylistPlan(
      room.playlist_id,
      playlistItems.flatMap((entry: any) => entry.item?.uri ? [entry.item.uri] : []),
      upcoming.map(item => item.uri),
      playback ? { contextUri: playback.context?.uri, itemUri: playback.item?.uri } : null,
    );
    const itemsPath = `/playlists/${room.playlist_id}/items`;
    await spotify(itemsPath, access, { method: 'PUT', body: JSON.stringify({ uris: plan.uris.slice(0, 100) }) });
    for (let i = 100; i < plan.uris.length; i += 100) {
      await spotify(itemsPath, access, { method: 'POST', body: JSON.stringify({ uris: plan.uris.slice(i, i + 100) }) });
    }
    const playedIds = upcoming.filter(item => plan.prefix.includes(item.uri)).map(item => item.submission_id);
    if (playedIds.length) {
      unwrap(await client.from('submissions').update({ state: 'played' }).eq('room_id', room.id).in('id', playedIds));
    }
    unwrap(await client.from('rooms').update({ sync_status: 'synced', sync_error: null, synced_uris: plan.uris }).eq('id', room.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Playlist sync failed';
    unwrap(await client.from('rooms').update({ sync_status: 'failed', sync_error: message }).eq('id', room.id));
    throw error;
  }
}
