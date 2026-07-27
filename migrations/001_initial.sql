CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY, share_code TEXT NOT NULL UNIQUE, host_secret TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, host_spotify_id TEXT NOT NULL, playlist_id TEXT NOT NULL,
  access_token TEXT NOT NULL, refresh_token TEXT NOT NULL, expires_at INTEGER NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0, sync_status TEXT NOT NULL DEFAULT 'idle', sync_error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, uri TEXT NOT NULL, artist_ids TEXT NOT NULL,
  artists TEXT NOT NULL, album TEXT NOT NULL, image_url TEXT, release_year INTEGER,
  duration_ms INTEGER NOT NULL, explicit INTEGER NOT NULL DEFAULT 0, genres TEXT NOT NULL DEFAULT '[]',
  danceability REAL, acousticness REAL, energy REAL, tempo REAL, key_num INTEGER, mode INTEGER,
  time_signature INTEGER, valence REAL
);
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id), guest_name TEXT NOT NULL, position INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'upcoming', pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()), UNIQUE(room_id, track_id)
);
CREATE INDEX IF NOT EXISTS submissions_room_position ON submissions(room_id, state, position);
