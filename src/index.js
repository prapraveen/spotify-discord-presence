import { loadConfig } from "./config.js";
import { SpotifyAuth } from "./spotify-auth.js";
import { SpotifyClient } from "./spotify.js";
import { LrclibClient } from "./lrclib.js";
import { DiscordIpcClient } from "./discord-ipc.js";
import { LyricPresenceApp } from "./app.js";

async function main() {
  const config = loadConfig();
  const auth = new SpotifyAuth({
    clientId: config.spotifyClientId,
    redirectUri: config.spotifyRedirectUri,
    tokenPath: config.tokenPath,
  });
  const app = new LyricPresenceApp({
    spotify: new SpotifyClient(auth),
    lyrics: new LrclibClient({ baseUrl: config.lrclibBaseUrl, userAgent: config.lrclibUserAgent }),
    discord: new DiscordIpcClient(config.discordClientId),
    linesPerUpdate: config.linesPerUpdate,
    pollIntervalMs: config.spotifyPollIntervalMs,
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
