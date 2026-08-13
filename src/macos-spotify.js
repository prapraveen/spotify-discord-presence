import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

const SPOTIFY_STATE_SCRIPT = String.raw`
const spotify = Application("Spotify");
if (!spotify.running()) {
  JSON.stringify(null);
} else {
  const state = String(spotify.playerState());
  if (state === "stopped") {
    JSON.stringify(null);
  } else {
    const track = spotify.currentTrack;
    JSON.stringify({
      state,
      positionSeconds: Number(spotify.playerPosition()),
      track: {
        id: String(track.id()),
        name: String(track.name()),
        artist: String(track.artist()),
        album: String(track.album()),
        duration: Number(track.duration()),
        spotifyUrl: String(track.spotifyUrl()),
        artworkUrl: String(track.artworkUrl())
      }
    });
  }
}
`;

export function normalizeDurationMs(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value > 10_000 ? Math.round(value) : Math.round(value * 1000);
}

export function normalizeSpotifyUrl(value) {
  if (!value) return null;
  if (/^https:\/\//i.test(value)) return value;
  const match = /^spotify:(track|episode):([^:]+)$/i.exec(value);
  return match ? `https://open.spotify.com/${match[1].toLowerCase()}/${match[2]}` : null;
}

export function snapshotFromMacSpotify(payload, fetchedAt = Date.now()) {
  if (!payload?.track) return null;
  const durationMs = normalizeDurationMs(payload.track.duration);
  const spotifyUrl = normalizeSpotifyUrl(payload.track.spotifyUrl);
  const id = payload.track.id || spotifyUrl || [
    payload.track.name,
    payload.track.artist,
    payload.track.album,
    durationMs,
  ].join("|");
  return {
    fetchedAt,
    isPlaying: payload.state === "playing",
    progressMs: Math.max(0, Math.round(Number(payload.positionSeconds || 0) * 1000)),
    track: {
      id,
      name: payload.track.name,
      artists: [payload.track.artist].filter(Boolean),
      album: payload.track.album || "Unknown album",
      albumCoverUrl: payload.track.artworkUrl || null,
      durationMs,
      spotifyUrl,
    },
  };
}

export function estimatedProgress(snapshot, now = Date.now()) {
  if (!snapshot) return 0;
  const elapsed = snapshot.isPlaying ? Math.max(0, now - snapshot.fetchedAt) : 0;
  return Math.min(snapshot.track.durationMs, snapshot.progressMs + elapsed);
}

export class MacSpotifyClient {
  constructor({ runScript = execFile } = {}) {
    if (process.platform !== "darwin" && runScript === execFile) {
      throw new Error("Lyric Presence currently supports macOS only.");
    }
    this.runScript = runScript;
  }

  async currentlyPlaying() {
    let stdout;
    try {
      ({ stdout } = await this.runScript("osascript", ["-l", "JavaScript", "-e", SPOTIFY_STATE_SCRIPT], {
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      }));
    } catch (error) {
      const detail = String(error.stderr || error.message || "").trim();
      if (/not authorized|not permitted|-1743/i.test(detail)) {
        throw new Error("macOS denied access to Spotify. Enable Spotify under System Settings → Privacy & Security → Automation, then restart Lyric Presence.");
      }
      throw new Error(`Could not read Spotify on macOS: ${detail || "unknown AppleScript error"}`);
    }
    const text = String(stdout).trim();
    if (!text || text === "null") return null;
    try {
      return snapshotFromMacSpotify(JSON.parse(text));
    } catch (error) {
      throw new Error(`Spotify returned invalid local playback data: ${error.message}`);
    }
  }
}
