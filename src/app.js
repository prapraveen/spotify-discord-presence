import { estimatedProgress } from "./spotify.js";
import { addBreakMarkers, lyricWindow } from "./lrc.js";

function presenceText(value) {
  const flattened = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (flattened === "♪") return "♪ ♪";
  if (flattened.length === 1) return `${flattened} …`;
  if (flattened.length <= 128) return flattened;
  return `${flattened.slice(0, 127).trimEnd()}…`;
}

export function activityFor(snapshot, lines, linesPerUpdate, now = Date.now()) {
  const progressMs = estimatedProgress(snapshot, now);
  const window = lyricWindow(lines, progressMs, linesPerUpdate);
  if (!window.lines.length) return { key: `waiting:${snapshot.track.id}`, activity: null };
  const song = `${snapshot.track.name} — ${snapshot.track.artists.join(", ")}`;
  const activity = {
    type: 2,
    details: presenceText(song),
    details_url: snapshot.track.spotifyUrl,
    state: presenceText(window.lines[0]),
    state_url: snapshot.track.spotifyUrl,
    instance: false,
  };
  if (snapshot.track.albumCoverUrl) {
    activity.assets = {
      large_image: snapshot.track.albumCoverUrl,
      large_url: snapshot.track.spotifyUrl,
    };
    if (window.lines[1]) activity.assets.large_text = presenceText(window.lines[1]);
  }
  if (snapshot.isPlaying) {
    activity.timestamps = {
      start: Math.floor((now - progressMs) / 1000),
      end: Math.floor((now + snapshot.track.durationMs - progressMs) / 1000),
    };
  }
  return { key: `${snapshot.track.id}:${window.key}:${snapshot.isPlaying}`, activity };
}

export class LyricPresenceApp {
  constructor({ spotify, lyrics, discord, linesPerUpdate, pollIntervalMs }) {
    this.spotify = spotify;
    this.lyrics = lyrics;
    this.discord = discord;
    this.linesPerUpdate = linesPerUpdate;
    this.pollIntervalMs = pollIntervalMs;
    this.snapshot = null;
    this.lines = [];
    this.trackId = null;
    this.lastPresenceKey = null;
    this.stopped = false;
    this.polling = false;
    this.pollTimer = null;
    this.tickTimer = null;
  }

  async start() {
    const ready = await this.discord.connect();
    console.log(`Connected to Discord as ${ready?.user?.username || "the current user"}.`);
    await this.poll();
    this.pollTimer = setInterval(() => this.runPoll(), this.pollIntervalMs);
    this.tickTimer = setInterval(() => this.updatePresence().catch((error) => this.report(error)), 250);
  }

  async poll() {
    const snapshot = await this.spotify.currentlyPlaying();
    this.snapshot = snapshot;
    if (!snapshot) {
      this.trackId = null;
      this.lines = [];
      await this.clearPresence();
      return;
    }
    if (snapshot.track.id !== this.trackId) {
      await this.clearPresence();
      this.trackId = snapshot.track.id;
      this.lines = [];
      console.log(`Now playing: ${snapshot.track.name} — ${snapshot.track.artists.join(", ")}`);
      const requestedTrackId = snapshot.track.id;
      const lines = await this.lyrics.lyricsFor(snapshot.track);
      if (this.trackId !== requestedTrackId) return;
      this.lines = addBreakMarkers(lines, snapshot.track.durationMs);
      if (!this.lines.length) console.warn("No synced lyrics found for this track.");
      else console.log(`Loaded ${this.lines.length} synced lyric lines.`);
    }
    await this.updatePresence();
  }

  async runPoll() {
    if (this.polling || this.stopped) return;
    this.polling = true;
    try {
      await this.poll();
    } catch (error) {
      this.report(error);
    } finally {
      this.polling = false;
    }
  }

  async updatePresence() {
    if (!this.snapshot || !this.lines.length) return;
    const { key, activity } = activityFor(this.snapshot, this.lines, this.linesPerUpdate);
    if (!activity || key === this.lastPresenceKey) return;
    this.lastPresenceKey = key;
    this.discord.setActivity(activity).catch((error) => {
      if (this.lastPresenceKey === key) this.lastPresenceKey = null;
      this.report(error);
    });
  }

  async clearPresence() {
    if (this.lastPresenceKey === null) return;
    this.lastPresenceKey = null;
    this.discord.clearActivity().catch((error) => this.report(error));
  }

  report(error) {
    if (!this.stopped) console.error(`[${new Date().toLocaleTimeString()}] ${error.message}`);
  }

  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    clearInterval(this.pollTimer);
    clearInterval(this.tickTimer);
    this.discord.close();
  }
}
