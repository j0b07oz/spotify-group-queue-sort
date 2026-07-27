'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Lock,
  Pause,
  Play,
  RefreshCw,
  Search,
  SkipForward,
  Speaker,
  Trash2,
  Unlock,
} from 'lucide-react';
import type { QueueItem, Track } from '@/lib/types';

type Device = { id: string; name: string; type: string; is_active: boolean };
type PlayerData = {
  devices: Device[];
  playback: null | {
    is_playing: boolean;
    context_uri: string | null;
    device_id: string | null;
    item: null | { id: string; name: string; artists: string[]; image_url: string | null };
  };
};

export default function Room({ code, isHost }: { code: string; isHost: boolean }) {
  const [data, setData] = useState<any>();
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [name, setName] = useState('Guest');
  const [error, setError] = useState('');
  const [playerBusy, setPlayerBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/rooms/${code}`, { cache: 'no-store' });
    if (response.ok) setData(await response.json());
  }, [code]);

  const loadPlayer = useCallback(async () => {
    if (!isHost) return;
    const response = await fetch(`/api/rooms/${code}/playback`, { cache: 'no-store' });
    if (!response.ok) return;
    const next = await response.json() as PlayerData;
    setPlayer(next);
    setDeviceId(current => {
      if (next.devices.some(device => device.id === current)) return current;
      return next.devices.find(device => device.is_active)?.id ?? next.devices[0]?.id ?? '';
    });
  }, [code, isHost]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!isHost) return;
    loadPlayer();
    const timer = window.setInterval(loadPlayer, 8000);
    return () => window.clearInterval(timer);
  }, [isHost, loadPlayer]);

  useEffect(() => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      fetch(`/api/rooms/${code}/search?q=${encodeURIComponent(q)}`)
        .then(response => response.json())
        .then(result => result.error ? setError(result.error) : setResults(result.tracks));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [q, code]);

  async function submit(track: Track) {
    const response = await fetch(`/api/rooms/${code}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track, guest_name: name }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error);
    else {
      setQ('');
      setResults([]);
      load();
    }
  }

  async function action(actionName: string, id?: string, position?: number) {
    const response = await fetch(`/api/rooms/${code}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionName, id, position }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error);
    load();
  }

  async function playback(actionName: 'start' | 'resume' | 'pause' | 'next') {
    if (!deviceId) {
      setError('Open Spotify on the speaker or device you want to use, then refresh devices.');
      return;
    }
    setPlayerBusy(true);
    const response = await fetch(`/api/rooms/${code}/playback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionName, device_id: deviceId }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error);
    await new Promise(resolve => window.setTimeout(resolve, 600));
    await loadPlayer();
    setPlayerBusy(false);
  }

  async function lock() {
    await fetch(`/api/rooms/${code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked: !data.room.locked }),
    });
    load();
  }

  if (!data) return <div className="room">Loading the room…</div>;

  const playlistUri = `spotify:playlist:${data.room.playlist_id}`;
  const isMixroomPlaying = player?.playback?.context_uri === playlistUri;
  const playAction = isMixroomPlaying ? 'resume' : 'start';
  const nowPlaying = player?.playback?.item;

  return <main className="room">
    <header className="room-head">
      <b className="brand">↗ MIXROOM</b>
      <div>
        <strong>{data.room.name}</strong>
        <div className="pill">{data.queue.length} upcoming · {data.room.locked ? 'locked' : 'open'}</div>
      </div>
      <button className="primary" onClick={() => navigator.clipboard.writeText(location.href)}>
        <Copy size={16} /> COPY INVITE
      </button>
    </header>

    {error && <p className="status">{error} <button onClick={() => setError('')}>×</button></p>}
    {data.room.sync_status === 'failed' && <p className="status">Spotify sync needs attention: {data.room.sync_error}</p>}

    {isHost && <section className="player-panel">
      <div className="player-now">
        <Speaker size={20} />
        <div>
          <b>{nowPlaying ? nowPlaying.name : 'Spotify playback'}</b>
          <small>{nowPlaying ? nowPlaying.artists.join(', ') : 'Choose where the Mixroom playlist should play'}</small>
        </div>
      </div>
      <select value={deviceId} onChange={event => setDeviceId(event.target.value)} aria-label="Spotify device">
        <option value="">No Spotify devices found</option>
        {player?.devices.map(device => <option key={device.id} value={device.id}>
          {device.name} · {device.type}{device.is_active ? ' (active)' : ''}
        </option>)}
      </select>
      <div className="player-actions">
        <button disabled={playerBusy || !deviceId || !data.queue.length} onClick={() => playback(playAction)}>
          <Play size={16} /> {isMixroomPlaying ? 'RESUME' : 'PLAY MIXROOM'}
        </button>
        <button disabled={playerBusy || !deviceId} onClick={() => playback('pause')} title="Pause">
          <Pause size={16} />
        </button>
        <button disabled={playerBusy || !deviceId} onClick={() => playback('next')} title="Next track">
          <SkipForward size={16} />
        </button>
        <button disabled={playerBusy} onClick={loadPlayer} title="Refresh devices">
          <RefreshCw size={16} />
        </button>
        <a href={`https://open.spotify.com/playlist/${data.room.playlist_id}`} target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> OPEN IN SPOTIFY
        </a>
      </div>
    </section>}

    <div className="grid">
      <section>
        <h2>Add a track</h2>
        <input className="search" value={name} maxLength={30} onChange={event => setName(event.target.value)} placeholder="Your name" />
        <div style={{ height: 8 }} />
        <label className="row">
          <Search size={18} />
          <input className="search" value={q} onChange={event => setQ(event.target.value)} placeholder={data.room.locked ? 'Queue is locked' : 'Search songs, artists, albums…'} disabled={data.room.locked} />
        </label>
        <div className="results">{results.map(track => <TrackRow key={track.id} track={track}>
          <button onClick={() => submit(track)}>+ ADD</button>
        </TrackRow>)}</div>
      </section>
      <aside>
        <div className="actions">
          <h2 style={{ flex: 1 }}>Up next</h2>
          {isHost && <>
            <button title="Lock queue" onClick={lock}>{data.room.locked ? <Unlock size={16} /> : <Lock size={16} />}</button>
            <button title="Force re-sort" onClick={() => action('sort')}><RefreshCw size={16} /></button>
          </>}
        </div>
        <div className="queue">{data.queue.map((track: QueueItem, index: number) => <TrackRow key={track.id} track={track}>
          <small>#{index + 1} · {track.guest_name}</small>
          {isHost && <>
            <button disabled={!index} onClick={() => action('move', track.submission_id, index - 1)}>↑</button>
            <button onClick={() => action('remove', track.submission_id)}><Trash2 size={14} /></button>
          </>}
        </TrackRow>)}</div>
        {!data.queue.length && <p className="muted">The floor is yours. Add the first track.</p>}
      </aside>
    </div>
  </main>;
}

function TrackRow({ track, children }: { track: Track; children: React.ReactNode }) {
  return <div className="row">
    {track.image_url ? <img src={track.image_url} alt="" /> : <div />}
    <div><b>{track.name}</b><small>{track.artists.join(', ')} · {track.album}</small></div>
    {children}
  </div>;
}
