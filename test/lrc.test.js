import test from "node:test";
import assert from "node:assert/strict";
import { addBreakMarkers, activeLineIndex, lyricWindow, parseLrc } from "../src/lrc.js";

test("parseLrc reads timestamps, fractions, repeated timestamps, and explicit breaks", () => {
  const lines = parseLrc("[00:01.25]First\n[00:03:500][00:04.00]Again\n[00:08.00] \n[ar:ignored]");
  assert.deepEqual(lines, [
    { startMs: 1250, text: "First" },
    { startMs: 3500, text: "Again" },
    { startMs: 4000, text: "Again" },
    { startMs: 8000, text: "♪" },
  ]);
});

test("addBreakMarkers infers intro, interlude, and outro gaps", () => {
  const lines = addBreakMarkers([
    { startMs: 10_000, text: "one" },
    { startMs: 13_000, text: "two" },
    { startMs: 25_000, text: "three" },
  ], 40_000);
  assert.deepEqual(lines, [
    { startMs: 0, text: "♪" },
    { startMs: 10_000, text: "one" },
    { startMs: 13_000, text: "two" },
    { startMs: 18_000, text: "♪" },
    { startMs: 25_000, text: "three" },
    { startMs: 30_000, text: "♪" },
  ]);
});

test("addBreakMarkers does not duplicate explicit break markers", () => {
  const lines = addBreakMarkers([
    { startMs: 0, text: "one" },
    { startMs: 10_000, text: "♪" },
    { startMs: 20_000, text: "two" },
  ], 21_000);
  assert.deepEqual(lines, [
    { startMs: 0, text: "one" },
    { startMs: 10_000, text: "♪" },
    { startMs: 20_000, text: "two" },
  ]);
});

test("activeLineIndex finds the latest elapsed line", () => {
  const lines = [{ startMs: 1000 }, { startMs: 2500 }, { startMs: 9000 }];
  assert.equal(activeLineIndex(lines, 999), -1);
  assert.equal(activeLineIndex(lines, 2500), 1);
  assert.equal(activeLineIndex(lines, 20_000), 2);
});

test("lyricWindow shows the active line and following line", () => {
  const lines = [
    { startMs: 0, text: "one" },
    { startMs: 2000, text: "two" },
    { startMs: 4000, text: "three" },
  ];
  assert.deepEqual(lyricWindow(lines, 2500, 2).lines, ["two", "three"]);
  assert.deepEqual(lyricWindow(lines, 4500, 2).lines, ["three"]);
});
