import test from "node:test";
import assert from "node:assert/strict";
import { activityFor } from "../src/app.js";

const snapshot = {
  fetchedAt: 10_000,
  isPlaying: true,
  progressMs: 1500,
  track: {
    id: "track-id",
    name: "A Song",
    artists: ["An Artist"],
    album: "An Album",
    albumCoverUrl: "https://i.scdn.co/image/example",
    durationMs: 180_000,
    spotifyUrl: "https://open.spotify.com/track/track-id",
  },
};

test("activityFor keeps song metadata and puts lyrics in the status row", () => {
  const result = activityFor(snapshot, [
    { startMs: 0, text: "first line" },
    { startMs: 2000, text: "second line" },
  ], 2, 10_600);
  assert.equal(result.activity.details, "A Song — An Artist");
  assert.equal(result.activity.state, "first line • second line");
  assert.equal(result.activity.type, 2);
  assert.deepEqual(result.activity.assets, {
    large_image: "https://i.scdn.co/image/example",
    large_text: "An Album",
    large_url: "https://open.spotify.com/track/track-id",
  });
});

test("activityFor truncates text to Discord's field limit", () => {
  const result = activityFor(snapshot, [{ startMs: 0, text: "x".repeat(200) }], 1, 10_000);
  assert.equal(result.activity.state.length, 128);
  assert.ok(result.activity.state.endsWith("…"));
});

test("activityFor omits assets when Spotify has no cover image", () => {
  const noCover = { ...snapshot, track: { ...snapshot.track, albumCoverUrl: null } };
  const result = activityFor(noCover, [{ startMs: 0, text: "a line" }], 1, 10_000);
  assert.equal(result.activity.assets, undefined);
});
