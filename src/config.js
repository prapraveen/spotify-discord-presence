import path from "node:path";

function positiveInteger(name, fallback, { min = 1, max = Infinity } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  return value;
}

export function loadConfig() {
  return {
    spotifyClientId: required("SPOTIFY_CLIENT_ID"),
    discordClientId: required("DISCORD_CLIENT_ID"),
    spotifyRedirectUri:
      process.env.SPOTIFY_REDIRECT_URI?.trim() || "http://127.0.0.1:43821/callback",
    linesPerUpdate: positiveInteger("LINES_PER_UPDATE", 2, { min: 1, max: 2 }),
    spotifyPollIntervalMs: positiveInteger("SPOTIFY_POLL_INTERVAL_MS", 3000, {
      min: 1000,
      max: 30_000,
    }),
    lrclibBaseUrl: process.env.LRCLIB_BASE_URL?.trim() || "https://lrclib.net",
    lrclibUserAgent:
      process.env.LRCLIB_USER_AGENT?.trim() ||
      "LyricPresence/0.1.0 (personal desktop client)",
    tokenPath: path.resolve(".data", "spotify-tokens.json"),
  };
}
