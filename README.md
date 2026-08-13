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
- Node.js 20.6 or newer
- Spotify for macOS
- Discord for macOS
- A Discord application ID

No Spotify Premium subscription or Spotify developer account is required by Lyric Presence. Spotify itself may impose separate playback requirements for your account.

## Setup

1. In the [Discord Developer Portal](https://discord.com/developers/applications), create an application. Its name and icon are the activity name and branding people will see.
2. Open **General Information** and copy its **Application ID**. A bot, bot token, client secret, installation, and OAuth configuration are not needed.
3. Copy the example configuration:

   ```sh
   cp .env.example .env
   ```

4. Put the Discord Application ID in `.env`:

   ```dotenv
   DISCORD_CLIENT_ID=your_discord_application_id
   ```

5. Start Discord desktop, start Spotify playback, and run:

   ```sh
   npm start
   ```

6. On first use, macOS may ask whether Terminal (or your packaged copy of Lyric Presence) may control Spotify. Choose **Allow**. You can change this later under **System Settings → Privacy & Security → Automation**.

Stop with Ctrl-C. Discord removes the activity when the local connection closes.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DISCORD_CLIENT_ID` | required | Public ID for the shared Discord application |
| `LINES_PER_UPDATE` | `2` | Show one or two lines (`1` or `2`) |
| `PLAYBACK_POLL_INTERVAL_MS` | `3000` | Local Spotify playback resync interval |
| `LRCLIB_BASE_URL` | `https://lrclib.net` | Lyrics service base URL; can point to a self-hosted instance |
| `LRCLIB_USER_AGENT` | app identifier | Identification sent to LRCLIB |

The Discord Application ID is public and can be bundled into a distributed build. Users do not need to create their own Discord application if the distributor supplies this setting.

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

The runtime has no third-party npm dependencies.

## Privacy and content

Lyrics placed in Rich Presence are visible according to your Discord activity privacy settings. LRCLIB receives the current track's title, artist, album, and duration. Playback data is read locally from Spotify and is not sent to a custom server. Review Discord's, Spotify's, and LRCLIB's terms and the applicable lyric rights before distributing or commercializing the app.
