# Mixroom

A collaborative Spotify party queue built with Next.js, TypeScript, and SQLite. The host connects Spotify; guests open a room link, search, and suggest tracks without an account. Mixroom stores suggestions locally, orders them into a coherent set, and synchronizes a host-owned private playlist.

## Architecture

- **Next.js App Router** serves the responsive room UI and same-origin JSON endpoints.
- **SQLite / better-sqlite3** stores rooms, encrypted OAuth credentials, Spotify track snapshots, ordering state, the last successfully synchronized playlist snapshot, and sync health. Versioned SQL files in `migrations/` are tracked and applied once.
- **OAuth** uses Spotify Authorization Code Flow, an unguessable state value in a secure HttpOnly cookie, exact redirect matching, server-only token exchange, encrypted tokens at rest, and automatic refresh.
- **Mix engine** greedily minimizes transition distance across genre, year, tempo, key, danceability, acousticness, energy, and valence, with a strong recent-artist penalty. Manual moves are pinned until the host forces a re-sort.
- **Synchronization** fetches playback state and compares it with Mixroom's last successful local playlist snapshot. If this Mixroom playlist is currently playing, it retains every item through the current track and replaces only the upcoming segment. This avoids requesting `playlist-read-private`, keeps the scope list minimal, and stops safely if the host edited the active playlist outside Mixroom.

## Spotify API limitations that shape the design

1. Spotify has no public “Mix” algorithm endpoint. This project uses a documented, deterministic approximation rather than claiming parity with Spotify's proprietary personalization.
2. Audio Features, Recommendations, and artist-genre availability have changed for newer/development-mode apps. Search results do not include most audio analysis fields. The schema and algorithm accept these fields, but gracefully use neutral defaults when Spotify does not make them available. A production integration can enrich track rows from an approved metadata provider without changing queue ordering APIs.
3. Spotify’s live queue cannot be read/reordered as a durable collaborative queue. Mixroom therefore persists submissions and maintains a playlist, as requested.
4. Playback control normally requires Spotify Premium and an active device. Playlist editing itself does not start playback.
5. Playlist writes are limited to 100 URIs per request. The synchronizer preserves the current prefix from its last successful snapshot, replaces the first batch, then appends batches of 100.
6. Playback state may be absent, delayed, private-session affected, or refer to a different context. When another context is active, Mixroom rebuilds its playlist from the upcoming application queue. When the Mixroom playlist is active but its current item is not in the last synchronized snapshot, Mixroom refuses to overwrite it.
7. Spotify can return `429`; API calls honor `Retry-After` with bounded retry. OAuth, revoked access, invalid/unavailable tracks, and sync errors are returned safely and recorded for the host rather than silently losing submissions.
8. As of Spotify's February/March 2026 Development Mode changes, playlist creation uses `POST /me/playlists` and playlist writes use `/playlists/{id}/items`; older `/users/{id}/playlists` and `/tracks` forms are not used. Development Mode also requires the app owner to have Premium and limits new apps to five authorized users. Only the host authorizes, reducing that impact on guests.

## Setup

Requirements: Node.js 22+ (Node 24 is supported), npm, and a Spotify developer application.

```bash
npm install
cp .env.example .env
openssl rand -hex 32 # paste as TOKEN_ENCRYPTION_KEY
npm run db:migrate
npm run dev
```

In the Spotify developer dashboard, add this redirect URI **exactly**:

```text
http://127.0.0.1:3000/api/auth/callback/spotify
```

Use `http://127.0.0.1:3000` in the browser (not `localhost`). Put the Client ID and Client Secret in `.env`; variables without `NEXT_PUBLIC_` remain server-side. For production, set `SPOTIFY_REDIRECT_URI` to the registered HTTPS callback and `NEXT_PUBLIC_APP_URL` to the public origin. Use a persistent volume for `DATABASE_PATH`, run `npm run db:migrate` during deployment, and back up both the database and encryption key.

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

Do not commit `.env` or the SQLite database. Rotate Spotify credentials and the encryption key if exposed (existing encrypted tokens then become unreadable). Room links grant guest submission access, while host actions require an HttpOnly secret cookie. For a public high-traffic deployment, add request-level throttling/CAPTCHA and move SQLite to a managed relational database.
