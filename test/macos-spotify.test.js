import test from "node:test";
import assert from "node:assert/strict";
import { MacSpotifyClient, estimatedProgress, normalizeDurationMs, normalizeSpotifyUrl, snapshotFromMacSpotify } from "../src/macos-spotify.js";

const localPayload = {
  state: "playing",
  positionSeconds: 12.5,
  track: {
    id: "spotify:track:abc",
    name: "A Song",
    artist: "An Artist",
    album: "An Album",
    duration: 180,
    spotifyUrl: "spotify:track:abc",
    artworkUrl: "https://i.scdn.co/image/example",
  },
};

test("normalizeDurationMs supports Spotify duration values in seconds or milliseconds", () => {
  assert.equal(normalizeDurationMs(180), 180_000);
  assert.equal(normalizeDurationMs(180_000), 180_000);
});

test("normalizeSpotifyUrl converts local Spotify URIs to Discord-compatible web links", () => {
  assert.equal(normalizeSpotifyUrl("spotify:track:abc"), "https://open.spotify.com/track/abc");
  assert.equal(normalizeSpotifyUrl("spotify:episode:def"), "https://open.spotify.com/episode/def");
  assert.equal(normalizeSpotifyUrl("spotify:local:artist:album:song"), null);
});

test("snapshotFromMacSpotify maps local scripting data to the app playback model", () => {
  assert.deepEqual(snapshotFromMacSpotify(localPayload, 1000), {
    fetchedAt: 1000,
    isPlaying: true,
    progressMs: 12_500,
    track: {
      id: "spotify:track:abc",
      name: "A Song",
      artists: ["An Artist"],
      album: "An Album",
      albumCoverUrl: "https://i.scdn.co/image/example",
      durationMs: 180_000,
      spotifyUrl: "https://open.spotify.com/track/abc",
    },
  });
});

test("estimatedProgress advances only while local playback is playing", () => {
  const playing = snapshotFromMacSpotify(localPayload, 1000);
  const paused = snapshotFromMacSpotify({ ...localPayload, state: "paused" }, 1000);
  assert.equal(estimatedProgress(playing, 2000), 13_500);
  assert.equal(estimatedProgress(paused, 2000), 12_500);
});

test("MacSpotifyClient reads JSON returned by osascript", async () => {
  const calls = [];
  const client = new MacSpotifyClient({ runScript: async (...args) => {
    calls.push(args);
    return { stdout: JSON.stringify(localPayload), stderr: "" };
  } });
  const snapshot = await client.currentlyPlaying();
  assert.equal(snapshot.track.name, "A Song");
  assert.equal(calls[0][0], "osascript");
  assert.deepEqual(calls[0][1].slice(0, 3), ["-l", "JavaScript", "-e"]);
});

test("MacSpotifyClient returns null when Spotify is stopped or closed", async () => {
  const client = new MacSpotifyClient({ runScript: async () => ({ stdout: "null\n", stderr: "" }) });
  assert.equal(await client.currentlyPlaying(), null);
});
