# Lyric Presence

Lyric Presence is a macOS companion app that shows the current Spotify track and one or two time-synced lyric lines in Discord Rich Presence. It also displays the track's album cover.

It uses:

- Spotify for macOS's built-in scripting interface for local playback state and metadata.
- [LRCLIB](https://lrclib.net) for community-maintained synchronized LRC lyrics.
- Discord's local RPC connection to publish Rich Presence to the signed-in desktop client.

It does not use Spotify's Web API, a Spotify developer application, browser cookies, client secrets, or refresh tokens.

## Important limitation

Discord does not expose an API for applications to continually rewrite a user's custom status. This app creates a **Rich Presence activity**, which appears on your profile/activity card. Discord fixes the first row to the application name and exposes two standard dynamic rows, so Lyric Presence uses the second row for `Song — Artist` and the third for the current lyric. When the client displays the artwork caption as another row, it contains the next lyric.

The Spotify and Discord desktop applications must be running. Discord activity sharing must be enabled.

## Requirements

- macOS
- Node.js 22.12 or newer when running or building from source
- Spotify for macOS
- Discord for macOS

No Spotify Premium subscription or Spotify developer account is required by Lyric Presence. Spotify itself may impose separate playback requirements for your account.

## Install from a packaged build

Download the appropriate DMG from the project's releases:

- `arm64` for Apple Silicon Macs (M1 and newer)
- `x64` for Intel Macs

Drag **Lyric Presence** to Applications and launch it. It runs in the macOS menu bar rather than opening a window. The menu shows the current connection or song, and provides Start, Stop, Launch at Login, Automation Settings, and Quit controls.

The shared Discord Application ID is bundled into the app. Users do not need Spotify or Discord developer accounts, an `.env` file, Node.js, or a terminal.

On first use, macOS may ask whether Lyric Presence may control Spotify. Choose **Allow**. You can change this later under **System Settings → Privacy & Security → Automation**.

## Run from source

1. Install dependencies:

   ```sh
   npm install
   ```

2. Start Spotify and Discord desktop, then run either the menu-bar app:

   ```sh
   npm run app
   ```

   or the terminal version:

   ```sh
   npm start
   ```

The optional `.env.example` settings can be exported through your shell. For the terminal version only, `npm run start:env` loads a local `.env` file explicitly.

Stop with Ctrl-C. Discord removes the activity when the local connection closes.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DISCORD_CLIENT_ID` | bundled shared ID | Override the public Discord Application ID for development |
| `LINES_PER_UPDATE` | `2` | Show one or two lines (`1` or `2`) |
| `PLAYBACK_POLL_INTERVAL_MS` | `3000` | Local Spotify playback resync interval |
| `LRCLIB_BASE_URL` | `https://lrclib.net` | Lyrics service base URL; can point to a self-hosted instance |
| `LRCLIB_USER_AGENT` | app identifier | Identification sent to LRCLIB |

The bundled Discord Application ID is public. It is not a bot token or secret.

## How synchronization works

Every three seconds, the app asks the local Spotify process for its current track, position, play/pause state, duration, Spotify URL, and artwork URL. It estimates playback position locally between polls. Pauses, seeks, track changes, and local playback handoffs are corrected on the next poll.

Lyrics are fetched once per track. With the default two-line setting, the active line is the status row and the immediately following line is the artwork caption; the window normally advances one line at a time.

Discord permits five activity changes in a rolling 20-second window. Every set and clear operation goes through a shared limiter. Identical updates are ignored, and only when changes arrive faster than Discord permits does the app retain the newest pending presence and skip obsolete lyric updates instead of showing them late.

LRCLIB supplies line timestamps and sometimes an empty timestamped line, but it does not provide reliable start/end timing for every sung phrase. Empty timestamped lines are displayed as `♪ ♪`. Lyric Presence also infers instrumental sections when consecutive timestamps are at least eight seconds apart: it allows the prior line five seconds, then displays `♪ ♪` until the next lyric. Long intros and outros are handled the same way. Tracks marked entirely instrumental by LRCLIB display `♪ ♪` throughout.

If LRCLIB's exact metadata lookup misses, the app searches and scores candidates by title, primary artist, album, duration, and availability of synced lyrics. If no synced lyrics exist, it logs that fact and leaves Rich Presence empty rather than showing incorrectly timed plain lyrics.

## Development

```sh
npm test
npm run check
```

Build local DMG and ZIP artifacts for the current architecture:

```sh
npm run dist:mac:arm64  # Apple Silicon
npm run dist:mac:x64    # Intel
```

Artifacts are written to `release/`. Unsigned builds are suitable for local testing but trigger Gatekeeper warnings when downloaded elsewhere.

For public releases, use an Apple Developer ID Application certificate. The build enables Hardened Runtime, includes the Apple Events entitlement and Spotify usage explanation, and automatically enables notarization when supported Apple credentials are present in the environment. Electron Builder supports App Store Connect API credentials, Apple ID credentials, or a stored `notarytool` keychain profile.

The application runtime has no non-Electron third-party dependencies.

## Privacy and content

Lyrics placed in Rich Presence are visible according to your Discord activity privacy settings. LRCLIB receives the current track's title, artist, album, and duration. Playback data is read locally from Spotify and is not sent to a custom server. Review Discord's, Spotify's, and LRCLIB's terms and the applicable lyric rights before distributing or commercializing the app.
