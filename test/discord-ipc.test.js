import test from "node:test";
import assert from "node:assert/strict";
import { encodeFrame, LatestActivityQueue } from "../src/discord-ipc.js";

test("encodeFrame creates Discord's little-endian IPC frame", () => {
  const frame = encodeFrame(1, { hello: "world" });
  assert.equal(frame.readInt32LE(0), 1);
  assert.equal(frame.readInt32LE(4), frame.length - 8);
  assert.deepEqual(JSON.parse(frame.subarray(8).toString()), { hello: "world" });
});

test("LatestActivityQueue sends no more than the rolling-window limit", async () => {
  let now = 1000;
  let scheduled;
  const sent = [];
  const queue = new LatestActivityQueue(async (activity) => sent.push(activity), {
    maxUpdates: 2,
    windowMs: 20_000,
    now: () => now,
    schedule: (callback, delay) => { scheduled = { callback, delay }; return 1; },
    cancel: () => {},
  });

  await queue.enqueue({ state: "one" });
  await queue.enqueue({ state: "two" });
  const third = queue.enqueue({ state: "three" });
  await Promise.resolve();
  assert.deepEqual(sent, [{ state: "one" }, { state: "two" }]);
  assert.equal(scheduled.delay, 20_001);

  now = 21_001;
  scheduled.callback();
  await third;
  assert.deepEqual(sent.at(-1), { state: "three" });
});

test("LatestActivityQueue coalesces pending updates and ignores duplicates", async () => {
  let now = 0;
  let releaseFirst;
  let scheduled;
  const sent = [];
  const queue = new LatestActivityQueue((activity) => {
    sent.push(activity);
    if (sent.length === 1) return new Promise((resolve) => { releaseFirst = resolve; });
  }, {
    maxUpdates: 1,
    windowMs: 20_000,
    now: () => now,
    schedule: (callback) => { scheduled = callback; return 1; },
    cancel: () => {},
  });

  const first = queue.enqueue({ state: "one" });
  const second = queue.enqueue({ state: "two" });
  const third = queue.enqueue({ state: "three" });
  assert.deepEqual(await second, { superseded: true });
  releaseFirst();
  await first;
  await Promise.resolve();
  now = 20_001;
  scheduled();
  await third;
  await queue.enqueue({ state: "three" });
  assert.deepEqual(sent, [{ state: "one" }, { state: "three" }]);
});

test("LatestActivityQueue cancels a pending change when the latest state matches the in-flight state", async () => {
  let releaseFirst;
  const sent = [];
  const queue = new LatestActivityQueue((activity) => {
    sent.push(activity);
    return new Promise((resolve) => { releaseFirst = resolve; });
  });

  const first = queue.enqueue({ state: "one" });
  const obsolete = queue.enqueue({ state: "obsolete" });
  await queue.enqueue({ state: "one" });
  assert.deepEqual(await obsolete, { superseded: true });
  releaseFirst();
  await first;
  await Promise.resolve();
  assert.deepEqual(sent, [{ state: "one" }]);
});
