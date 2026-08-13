import test from "node:test";
import assert from "node:assert/strict";
import { encodeFrame } from "../src/discord-ipc.js";

test("encodeFrame creates Discord's little-endian IPC frame", () => {
  const frame = encodeFrame(1, { hello: "world" });
  assert.equal(frame.readInt32LE(0), 1);
  assert.equal(frame.readInt32LE(4), frame.length - 8);
  assert.deepEqual(JSON.parse(frame.subarray(8).toString()), { hello: "world" });
});
