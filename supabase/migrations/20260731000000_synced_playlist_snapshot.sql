alter table public.rooms
  add column if not exists synced_uris jsonb not null default '[]';
