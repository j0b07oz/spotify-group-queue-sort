import 'server-only';
import { database, unwrap } from './db';
import type { QueueItem, Track } from './types';

export async function roomByCode(code: string) {
  return unwrap(await database().from('rooms').select('*').eq('share_code', code).maybeSingle());
}

export async function queue(roomId: string): Promise<QueueItem[]> {
  const rows = unwrap(await database().from('submissions').select('id,guest_name,position,pinned,state,tracks(*)').eq('room_id', roomId).eq('state', 'upcoming').order('position')) as any[];
  return rows.map(({ tracks, id, ...submission }) => ({ ...tracks, ...submission, submission_id: id }));
}

export async function saveTrack(track: Track) {
  unwrap(await database().from('tracks').upsert({ ...track, explicit: false }, { onConflict: 'id' }).select('id').single());
}

export async function updatePositions(items: QueueItem[], pinnedId?: string) {
  const client = database();
  await Promise.all(items.map(async (item, position) => {
    const values: { position: number; pinned?: boolean } = { position };
    if (pinnedId !== undefined) values.pinned = item.submission_id === pinnedId;
    unwrap(await client.from('submissions').update(values).eq('id', item.submission_id));
  }));
}
