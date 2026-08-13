import { loadConfig } from "./config.js";
import { MacSpotifyClient } from "./macos-spotify.js";
import { LrclibClient } from "./lrclib.js";
import { DiscordIpcClient } from "./discord-ipc.js";
import { LyricPresenceApp } from "./app.js";

async function main() {
  const config = loadConfig();
  if (!config.discordClientId) {
    throw new Error("Missing DISCORD_CLIENT_ID. Copy .env.example to .env and fill it in.");
  }
  const app = new LyricPresenceApp({
    playback: new MacSpotifyClient(),
    lyrics: new LrclibClient({ baseUrl: config.lrclibBaseUrl, userAgent: config.lrclibUserAgent }),
    discord: new DiscordIpcClient(config.discordClientId),
    linesPerUpdate: config.linesPerUpdate,
    pollIntervalMs: config.playbackPollIntervalMs,
  });

  const shutdown = async () => {
    console.log("\nClearing Rich Presence…");
    await app.stop();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  await app.start();
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
