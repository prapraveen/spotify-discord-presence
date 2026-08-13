const PLAYER_URL = "https://api.spotify.com/v1/me/player/currently-playing?additional_types=track";

export class SpotifyClient {
  constructor(auth) {
    this.auth = auth;
  }

  async currentlyPlaying() {
    let token = await this.auth.accessToken();
    let response = await fetch(PLAYER_URL, { headers: { authorization: `Bearer ${token}` } });
    if (response.status === 401) {
      await this.auth.refresh();
      token = await this.auth.accessToken();
      response = await fetch(PLAYER_URL, { headers: { authorization: `Bearer ${token}` } });
    }
    if (response.status === 204) return null;
    if (response.status === 429) {
      const retryAfterMs = Number(response.headers.get("retry-after") || 5) * 1000;
      const error = new Error("Spotify rate limit reached.");
      error.retryAfterMs = retryAfterMs;
      throw error;
    }
    if (!response.ok) throw new Error(`Spotify playback request failed (${response.status}).`);

    const data = await response.json();
    if (!data.item || data.currently_playing_type !== "track") return null;
    return {
      fetchedAt: Date.now(),
      isPlaying: data.is_playing,
      progressMs: data.progress_ms || 0,
      track: {
        id: data.item.id,
        name: data.item.name,
        artists: data.item.artists.map((artist) => artist.name),
        album: data.item.album.name,
        durationMs: data.item.duration_ms,
        spotifyUrl: data.item.external_urls.spotify,
      },
    };
  }
}

export function estimatedProgress(snapshot, now = Date.now()) {
  if (!snapshot) return 0;
  const elapsed = snapshot.isPlaying ? Math.max(0, now - snapshot.fetchedAt) : 0;
  return Math.min(snapshot.track.durationMs, snapshot.progressMs + elapsed);
}
