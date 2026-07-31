/** Parse a successful Spotify response without assuming every body is JSON. */
export async function parseSpotifyResponse(response: Response): Promise<unknown> {
  const body = await response.text();
  if (!body) return null;

  try {
    return JSON.parse(body);
  } catch {
    // Some successful mutation responses contain an opaque snapshot identifier.
    return body;
  }
}
