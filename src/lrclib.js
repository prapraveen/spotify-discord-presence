import { parseLrc } from "./lrc.js";

function normalized(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

export function scoreResult(result, track) {
  let score = 0;
  if (normalized(result.trackName || "") === normalized(track.name)) score += 5;
  if (normalized(result.artistName || "").includes(normalized(track.artists[0]))) score += 4;
  if (normalized(result.albumName || "") === normalized(track.album)) score += 2;
  const durationDifference = Math.abs(Number(result.duration || 0) - track.durationMs / 1000);
  if (durationDifference <= 2) score += 4;
  else if (durationDifference <= 5) score += 2;
  if (result.syncedLyrics) score += 3;
  return score;
}

export class LrclibClient {
  constructor({ baseUrl, userAgent }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.userAgent = userAgent;
    this.cache = new Map();
  }

  async lyricsFor(track) {
    if (this.cache.has(track.id)) return this.cache.get(track.id);
    const promise = this.fetchLyrics(track).catch((error) => {
      this.cache.delete(track.id);
      throw error;
    });
    this.cache.set(track.id, promise);
    return promise;
  }

  async request(path, parameters) {
    const url = new URL(path, this.baseUrl);
    url.search = new URLSearchParams(parameters);
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": this.userAgent },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`LRCLIB request failed (${response.status}).`);
    return response.json();
  }

  async fetchLyrics(track) {
    const parameters = {
      track_name: track.name,
      artist_name: track.artists.join(", "),
      album_name: track.album,
      duration: String(Math.round(track.durationMs / 1000)),
    };
    let result = await this.request("/api/get", parameters);
    if (result?.instrumental) return [{ startMs: 0, text: "♪" }];

    if (!result?.syncedLyrics) {
      const results = await this.request("/api/search", {
        track_name: track.name,
        artist_name: track.artists[0],
      });
      result = Array.isArray(results)
        ? results.filter((candidate) => candidate.syncedLyrics).sort((a, b) => scoreResult(b, track) - scoreResult(a, track))[0]
        : null;
    }
    if (!result?.syncedLyrics) return [];
    return parseLrc(result.syncedLyrics);
  }
}
