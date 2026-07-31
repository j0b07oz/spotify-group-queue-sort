import { describe, expect, it } from 'vitest';
import { parseSpotifyResponse } from './spotify-response';

describe('parseSpotifyResponse', () => {
  it('parses JSON response bodies', async () => {
    const response = new Response(JSON.stringify({ devices: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(parseSpotifyResponse(response)).resolves.toEqual({ devices: [] });
  });

  it('accepts opaque successful response bodies', async () => {
    const response = new Response('kwbzARW_Ul-snapshot');

    await expect(parseSpotifyResponse(response)).resolves.toBe('kwbzARW_Ul-snapshot');
  });

  it('returns null for an empty response body', async () => {
    const response = new Response(null, { status: 204 });

    await expect(parseSpotifyResponse(response)).resolves.toBeNull();
  });
});
