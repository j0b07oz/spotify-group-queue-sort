import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { roomByCode, queue, saveTrack, updatePositions } from '@/lib/rooms';
import { mix } from '@/lib/queue';
import { database } from '@/lib/db';
import { syncRoom } from '@/lib/sync';
import { roomToken, spotify } from '@/lib/spotify';

const Track = z.object({ id:z.string(), name:z.string(), uri:z.string().regex(/^spotify:track:/), artists:z.array(z.string()), artist_ids:z.array(z.string()), album:z.string(), image_url:z.string().nullable(), release_year:z.number().nullable(), duration_ms:z.number(), genres:z.array(z.string()), danceability:z.number().nullable(), acousticness:z.number().nullable(), energy:z.number().nullable(), tempo:z.number().nullable(), key_num:z.number().nullable(), mode:z.number().nullable(), time_signature:z.number().nullable(), valence:z.number().nullable() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const room = await roomByCode((await params).code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (room.locked) return NextResponse.json({ error: 'The host locked this queue' }, { status: 423 });
  try {
    const body = await req.json();
    const candidate = Track.parse(body.track);
    const guestName = z.string().trim().min(1).max(30).parse(body.guest_name);
    const live = await spotify(`/tracks/${encodeURIComponent(candidate.id)}`, await roomToken(room));
    if (!live?.id || live.is_playable === false) throw new Error('This track is not available on Spotify');
    const track = { ...candidate, id:live.id, uri:live.uri, name:live.name, artists:live.artists.map((a:any)=>a.name), artist_ids:live.artists.map((a:any)=>a.id), album:live.album.name, image_url:live.album.images?.[1]?.url||null, release_year:Number(live.album.release_date?.slice(0,4))||null, duration_ms:live.duration_ms };
    await saveTrack(track);
    const current = await queue(room.id);
    const { error } = await database().from('submissions').insert({ room_id: room.id, track_id: track.id, guest_name: guestName, position: current.length });
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'That track is already in the queue' }, { status: 409 });
      throw new Error(error.message);
    }
    await updatePositions(mix(await queue(room.id)));
    await syncRoom(room).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid submission' }, { status: 400 });
  }
}
