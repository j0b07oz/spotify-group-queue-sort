import { NextRequest, NextResponse } from 'next/server';
import { roomByCode } from '@/lib/rooms';
import { roomToken, spotify } from '@/lib/spotify';
import { syncRoom } from '@/lib/sync';

async function hostRoom(req: NextRequest, code: string) {
  const room = await roomByCode(code);
  if (!room) return { error: NextResponse.json({ error: 'Room not found' }, { status: 404 }) };
  if (req.cookies.get(`host_${code}`)?.value !== room.host_secret) {
    return { error: NextResponse.json({ error: 'Host access required' }, { status: 403 }) };
  }
  return { room };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const result = await hostRoom(req, code);
  if (result.error) return result.error;

  try {
    const access = await roomToken(result.room);
    const [devicesResponse, playback] = await Promise.all([
      spotify('/me/player/devices', access),
      spotify('/me/player', access).catch(() => null),
    ]);
    const devices = (devicesResponse?.devices ?? [])
      .filter((device: any) => device.id)
      .map((device: any) => ({
        id: device.id,
        name: device.name,
        type: device.type,
        is_active: Boolean(device.is_active),
      }));

    return NextResponse.json({
      devices,
      playback: playback ? {
        is_playing: Boolean(playback.is_playing),
        context_uri: playback.context?.uri ?? null,
        device_id: playback.device?.id ?? null,
        item: playback.item ? {
          id: playback.item.id,
          name: playback.item.name,
          artists: playback.item.artists?.map((artist: any) => artist.name) ?? [],
          image_url: playback.item.album?.images?.[1]?.url ?? null,
        } : null,
      } : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Playback unavailable' },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const result = await hostRoom(req, code);
  if (result.error) return result.error;

  try {
    const body = await req.json();
    const action = String(body.action ?? '');
    const deviceId = typeof body.device_id === 'string' && body.device_id ? body.device_id : null;
    const deviceQuery = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';

    if (action === 'start') {
      await syncRoom(result.room);
      const refreshedRoom = await roomByCode(code);
      const access = await roomToken(refreshedRoom ?? result.room);
      await spotify(`/me/player/play${deviceQuery}`, access, {
        method: 'PUT',
        body: JSON.stringify({ context_uri: `spotify:playlist:${result.room.playlist_id}` }),
      });
    } else {
      const access = await roomToken(result.room);
      if (action === 'resume') {
        await spotify(`/me/player/play${deviceQuery}`, access, { method: 'PUT' });
      } else if (action === 'pause') {
        await spotify(`/me/player/pause${deviceQuery}`, access, { method: 'PUT' });
      } else if (action === 'next') {
        await spotify(`/me/player/next${deviceQuery}`, access, { method: 'POST' });
      } else {
        return NextResponse.json({ error: 'Unknown playback action' }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Playback command failed';
    const noDevice = message.includes(' 404:');
    return NextResponse.json(
      { error: noDevice ? 'No Spotify device is available. Open Spotify on the speaker or device you want to use, then refresh devices.' : message },
      { status: noDevice ? 409 : 502 },
    );
  }
}
