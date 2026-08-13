# Lyric Presence

Lyric Presence is a local companion app that shows the current track and one or two time-synced lyric lines in your Discord Rich Presence while Spotify plays. The track's album cover is displayed as the activity artwork.

It uses:

- Spotify's official Web API for the current track, playback position, pauses, and seeks.
- [LRCLIB](https://lrclib.net) for community-maintained synchronized LRC lyrics.
- Discord's local RPC connection to publish Rich Presence to the signed-in desktop client.

This is intentionally different from RhythmType's `syrics`/`SP_DC` approach. It does not read a Spotify browser cookie or call Spotify's private lyrics endpoint.

## Important limitation

Discord does not expose an API for applications to continually rewrite a user's custom status. This app creates a **Rich Presence activity**, which appears on your profile/activity card. Discord fixes the first row to the application name and exposes only two dynamic rows, so Lyric Presence uses the second row for `Song — Artist` and the third for the current lyrics. The Discord desktop app must be running, and activity sharing must be enabled.

## Requirements

- Node.js 20.6 or newer
- Spotify Premium (Spotify currently requires Premium for Web API access)
- The Spotify and Discord desktop applications
- A Spotify developer application and a Discord developer application

## Setup

1. In the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), create an app with Web API access.
2. Add `http://127.0.0.1:43821/callback` as an exact redirect URI. Spotify requires the numeric loopback address; do not change it to `localhost`.
3. In the [Discord Developer Portal](https://discord.com/developers/applications), create an application. Its name is the activity name people will see.
4. Copy the example configuration and fill in the two public IDs:

   ```sh
   cp .env.example .env
   ```

   `SPOTIFY_CLIENT_ID` is Spotify's Client ID. `DISCORD_CLIENT_ID` is Discord's Application ID. No client secret, Discord token, Spotify cookie, or bot token is needed.

5. Start Discord desktop, start Spotify playback, and run:

   ```sh
   npm start
   ```

6. On the first run, open the printed Spotify authorization URL. The refresh token is saved with owner-only permissions in `.data/spotify-tokens.json` and is ignored by git.

Stop with Ctrl-C; the app clears its activity before exiting.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SPOTIFY_CLIENT_ID` | required | Public ID for your Spotify app |
| `DISCORD_CLIENT_ID` | required | Public ID for your Discord app |
| `SPOTIFY_REDIRECT_URI` | `http://127.0.0.1:43821/callback` | OAuth callback; must exactly match Spotify's dashboard |
| `LINES_PER_UPDATE` | `2` | Show one or two lines (`1` or `2`) |
| `SPOTIFY_POLL_INTERVAL_MS` | `3000` | Playback resync interval |
| `LRCLIB_BASE_URL` | `https://lrclib.net` | Lyrics service base URL; can point to a self-hosted instance |
| `LRCLIB_USER_AGENT` | app identifier | Identification sent to LRCLIB |

## How synchronization works

The app polls Spotify every three seconds, then estimates the position locally between polls. It fetches lyrics once per track, parses the LRC timestamps, and sends a Discord update only when the active one- or two-line group changes. When two lines are configured, Discord's single remaining lyric row displays them separated by `•`. Spotify polls correct drift after a seek, pause, resume, or device handoff.

If LRCLIB's exact metadata lookup misses, the app searches and scores candidates by title, primary artist, album, duration, and availability of synced lyrics. If no synced lyrics exist, it logs that fact and leaves the Rich Presence empty rather than showing incorrectly timed plain lyrics.

## Development

```sh
npm test
npm run check
```

The runtime has no third-party npm dependencies.

## Privacy and content

Lyrics placed in Rich Presence are visible according to your Discord activity privacy settings. LRCLIB receives track metadata (title, artist, album, and duration), while Spotify receives the normal playback-state request. Review the services' terms and the applicable lyric rights before distributing or commercializing the app.
