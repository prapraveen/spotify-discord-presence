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
    durationMs: 180_000,
  },
};

test("activityFor maps two synced lines onto Discord's two text rows", () => {
  const result = activityFor(snapshot, [
    { startMs: 0, text: "first line" },
    { startMs: 2000, text: "second line" },
  ], 2, 10_600);
  assert.equal(result.activity.details, "first line");
  assert.equal(result.activity.state, "second line");
  assert.equal(result.activity.type, 2);
});

test("activityFor truncates text to Discord's field limit", () => {
  const result = activityFor(snapshot, [{ startMs: 0, text: "x".repeat(200) }], 1, 10_000);
  assert.equal(result.activity.details.length, 128);
  assert.ok(result.activity.details.endsWith("…"));
});
