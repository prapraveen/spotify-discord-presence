import test from "node:test";
import assert from "node:assert/strict";
import { activeLineIndex, lyricWindow, parseLrc } from "../src/lrc.js";

test("parseLrc reads timestamps, fractions, and repeated timestamps", () => {
  const lines = parseLrc("[00:01.25]First\n[00:03:500][00:04.00]Again\n[ar:ignored]");
  assert.deepEqual(lines, [
    { startMs: 1250, text: "First" },
    { startMs: 3500, text: "Again" },
    { startMs: 4000, text: "Again" },
  ]);
});

test("activeLineIndex finds the latest elapsed line", () => {
  const lines = [{ startMs: 1000 }, { startMs: 2500 }, { startMs: 9000 }];
  assert.equal(activeLineIndex(lines, 999), -1);
  assert.equal(activeLineIndex(lines, 2500), 1);
  assert.equal(activeLineIndex(lines, 20_000), 2);
});

test("lyricWindow advances in groups of the configured line count", () => {
  const lines = [
    { startMs: 0, text: "one" },
    { startMs: 2000, text: "two" },
    { startMs: 4000, text: "three" },
  ];
  assert.deepEqual(lyricWindow(lines, 2500, 2).lines, ["one", "two"]);
  assert.deepEqual(lyricWindow(lines, 4500, 2).lines, ["three"]);
});
