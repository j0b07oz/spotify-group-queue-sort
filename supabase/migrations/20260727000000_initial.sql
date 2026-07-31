create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  share_code text not null unique,
  host_secret text not null unique,
  name text not null,
  host_spotify_id text not null,
  playlist_id text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at bigint not null,
  locked boolean not null default false,
  sync_status text not null default 'idle' check (sync_status in ('idle', 'syncing', 'synced', 'failed')),
  sync_error text,
  synced_uris jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.tracks (
  id text primary key,
  name text not null,
  uri text not null,
  artist_ids jsonb not null default '[]',
  artists jsonb not null default '[]',
  album text not null,
  image_url text,
  release_year integer,
  duration_ms integer not null,
  explicit boolean not null default false,
  genres jsonb not null default '[]',
  danceability double precision,
  acousticness double precision,
  energy double precision,
  tempo double precision,
  key_num integer,
  mode integer,
  time_signature integer,
  valence double precision
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  track_id text not null references public.tracks(id),
  guest_name text not null check (char_length(guest_name) between 1 and 30),
  position integer not null check (position >= 0),
  state text not null default 'upcoming' check (state in ('upcoming', 'played')),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  unique(room_id, track_id)
);

create index if not exists submissions_room_position on public.submissions(room_id, state, position);

alter table public.rooms enable row level security;
alter table public.tracks enable row level security;
alter table public.submissions enable row level security;

-- No public policies are intentional. The server-only service role is the sole database client.
revoke all on public.rooms, public.tracks, public.submissions from anon, authenticated;
