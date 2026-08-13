import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DISCORD_CLIENT_ID, loadConfig } from "../src/config.js";

test("loadConfig uses the bundled public Discord Application ID", () => {
  const previous = process.env.DISCORD_CLIENT_ID;
  delete process.env.DISCORD_CLIENT_ID;
  try {
    assert.equal(loadConfig().discordClientId, DEFAULT_DISCORD_CLIENT_ID);
    assert.equal(DEFAULT_DISCORD_CLIENT_ID, "1537570466636763146");
  } finally {
    if (previous === undefined) delete process.env.DISCORD_CLIENT_ID;
    else process.env.DISCORD_CLIENT_ID = previous;
  }
});

test("loadConfig permits a Discord Application ID override for development", () => {
  const previous = process.env.DISCORD_CLIENT_ID;
  process.env.DISCORD_CLIENT_ID = "development-id";
  try {
    assert.equal(loadConfig().discordClientId, "development-id");
  } finally {
    if (previous === undefined) delete process.env.DISCORD_CLIENT_ID;
    else process.env.DISCORD_CLIENT_ID = previous;
  }
});
