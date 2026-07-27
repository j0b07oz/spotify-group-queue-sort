import { NextRequest, NextResponse } from 'next/server';
import { roomByCode, queue, updatePositions } from '@/lib/rooms';
import { database, unwrap } from '@/lib/db';
import { mix } from '@/lib/queue';
import { syncRoom } from '@/lib/sync';

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await roomByCode(code);
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (req.cookies.get(`host_${code}`)?.value !== room.host_secret) return NextResponse.json({ error: 'Host access required' }, { status: 403 });
  const body = await req.json();
  try {
    if (body.action === 'remove') {
      unwrap(await database().from('submissions').delete().eq('id', body.id).eq('room_id', room.id));
      await updatePositions(await queue(room.id));
    } else if (body.action === 'move') {
      const items = await queue(room.id);
      const from = items.findIndex(item => item.submission_id === body.id);
      const to = Math.max(0, Math.min(items.length - 1, Number(body.position)));
      if (from < 0) throw new Error('Track not found');
      const [item] = items.splice(from, 1);
      items.splice(to, 0, item);
      await updatePositions(items, body.id);
    } else if (body.action === 'sort') {
      await updatePositions(mix((await queue(room.id)).map(item => ({ ...item, pinned: false }))), '');
    } else if (body.action !== 'sync') throw new Error('Unknown action');
    await syncRoom(room);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Action failed' }, { status: 502 });
  }
}
