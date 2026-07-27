# Mixroom

A collaborative Spotify party queue built with Next.js, TypeScript, and Supabase Postgres. The host connects Spotify; guests open a room link, search, and suggest tracks without an account. Mixroom stores suggestions persistently, orders them into a coherent set, and synchronizes a host-owned private playlist.

## Architecture

- **Next.js App Router** serves the responsive room UI and same-origin JSON endpoints.
- **Supabase Postgres** stores rooms, encrypted OAuth credentials, Spotify track snapshots, ordering state, and sync health. The server uses the service-role key; database tables have RLS enabled and grant no browser access.
- **OAuth** uses Spotify Authorization Code Flow, an unguessable state value in a secure HttpOnly cookie, exact redirect matching, server-only token exchange, encrypted tokens at rest, and automatic refresh.
- **Mix engine** greedily minimizes transition distance across genre, year, tempo, key, danceability, acousticness, energy, and valence, with a strong recent-artist penalty. Manual moves are pinned until the host forces a re-sort.
- **Synchronization** fetches playback state and the playlist snapshot. If this Mixroom playlist is currently playing, it retains every item through the current track and replaces only the upcoming segment. Failures remain visible and can be retried.

## Spotify API limitations that shape the design

1. Spotify has no public “Mix” algorithm endpoint. This project uses a documented, deterministic approximation rather than claiming parity with Spotify's proprietary personalization.
2. Audio Features, Recommendations, and artist-genre availability have changed for newer/development-mode apps. Search results do not include most audio analysis fields. The schema and algorithm accept these fields, but gracefully use neutral defaults when Spotify does not make them available. A production integration can enrich track rows from an approved metadata provider without changing queue ordering APIs.
3. Spotify’s live queue cannot be read/reordered as a durable collaborative queue. Mixroom therefore persists submissions and maintains a playlist, as requested.
4. Playback control normally requires Spotify Premium and an active device. Playlist editing itself does not start playback.
5. Playlist reads/writes are paginated and writes are limited to 100 URIs per request. The synchronizer preserves the current prefix, replaces the first batch, then appends batches of 100.
6. Playback state may be absent, delayed, private-session affected, or refer to a different context. In that case Mixroom does not guess which track is playing; it rebuilds the Mixroom playlist from its upcoming application queue.
7. Spotify can return `429`; API calls honor `Retry-After` with bounded retry. OAuth, revoked access, invalid/unavailable tracks, and sync errors are returned safely and recorded for the host rather than silently losing submissions.
8. Development-mode Spotify apps may restrict access to allow-listed users and have platform-specific quotas. Only the host authorizes, reducing that impact on guests.

## Production setup: Supabase + Vercel

### 1. Create the Supabase database

1. Create a Supabase project in the same region as the Vercel deployment.
2. Open **SQL Editor**, paste all of `supabase/migrations/20260727000000_initial.sql`, and select **Run**. It is safe to run once on a new project.
3. In **Project Settings → API**, copy the Project URL and `service_role` key. The service-role key is a secret and must never be exposed to client code.

You can alternatively link the Supabase CLI and run migrations from your machine:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

### 2. Configure Vercel

In **Vercel → Project → Settings → Environment Variables**, add these variables to **Production**, **Preview**, and **Development** as appropriate:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` secret |
| `SPOTIFY_CLIENT_ID` | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret |
| `SPOTIFY_REDIRECT_URI` | `https://YOUR_DOMAIN/api/auth/callback/spotify` |
| `TOKEN_ENCRYPTION_KEY` | A stable 32+ character random secret |

Generate the encryption key locally with `openssl rand -hex 32`. **Never change or lose this value** while rooms exist, because it encrypts the Spotify refresh tokens. Trigger a new Vercel deployment after saving variables.

In the Spotify developer dashboard, add the exact same production callback value. Scheme, domain, path, and trailing slash must match exactly. If you use both a Vercel domain and a custom domain, choose one canonical domain for OAuth.

Vercel does not need a direct Postgres connection string: API routes connect to Supabase's HTTPS Data API, which is safe for serverless concurrency. `vercel.json` allows up to 30 seconds for synchronization routes.

### 3. Smoke test production

1. Visit the canonical production URL and start a room.
2. Confirm the Spotify consent screen contains only the five documented scopes.
3. Open the invite in an incognito window, search, and submit a track.
4. Confirm the row appears under **Table Editor → submissions** and in the host-owned Spotify playlist.
5. Start playback from that playlist, submit another track, and confirm the current track does not move.
6. Test lock, manual move, remove, and force re-sort.

## Local setup

Requirements: Node.js 20+, npm, a Spotify developer application, and a migrated Supabase project.

```bash
npm install
cp .env.example .env
openssl rand -hex 32 # paste as TOKEN_ENCRYPTION_KEY
npm run dev
```

In the Spotify developer dashboard, add this redirect URI **exactly**:

```text
http://127.0.0.1:3000/api/auth/callback/spotify
```

Use `http://127.0.0.1:3000` in the browser (not `localhost`). Put the Spotify and Supabase secrets in `.env`; variables without `NEXT_PUBLIC_` remain server-side. Apply the Supabase migration before starting the app.

The app requests only: `user-read-private`, `playlist-modify-private`, `playlist-modify-public`, `user-read-playback-state`, and `user-modify-playback-state`.

## Host and guest flow

1. Select **Start a room** and authorize Spotify. Mixroom creates a private host-owned playlist and a shareable room.
2. Copy the invite. Guests provide a display name, search, and add a track. Duplicate Spotify track IDs are rejected transactionally.
3. Every accepted suggestion is re-ordered and synchronized. The currently playing playlist prefix is retained.
4. Host-only controls (secured by a separate HttpOnly room secret) lock/unlock, move, remove, and force re-sort. A failed Spotify sync never deletes the database submission; the host can retry.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

## Security notes

Do not commit `.env` or expose `SUPABASE_SERVICE_ROLE_KEY`. Rotate Spotify/Supabase credentials if exposed. Changing the token encryption key makes existing Spotify tokens unreadable. Room links grant guest submission access, while host actions require an HttpOnly secret cookie. Supabase RLS denies direct anonymous access; all database access remains in server-only modules. For a high-traffic public deployment, add edge rate limiting or CAPTCHA to guest submission and search routes.
