import { loadConfig } from "./config.js";
import { MacSpotifyClient } from "./macos-spotify.js";
import { LrclibClient } from "./lrclib.js";
import { DiscordIpcClient } from "./discord-ipc.js";
import { LyricPresenceApp } from "./app.js";

export function createLyricPresenceApp(config = loadConfig(), options = {}) {
  return new LyricPresenceApp({
    playback: options.playback || new MacSpotifyClient(),
    lyrics: options.lyrics || new LrclibClient({
      baseUrl: config.lrclibBaseUrl,
      userAgent: config.lrclibUserAgent,
    }),
    discord: options.discord || new DiscordIpcClient(config.discordClientId),
    linesPerUpdate: config.linesPerUpdate,
    pollIntervalMs: config.playbackPollIntervalMs,
    onStatus: options.onStatus,
  });
}
