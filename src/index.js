import { createLyricPresenceApp } from "./runtime.js";

async function main() {
  const app = createLyricPresenceApp();

  const shutdown = async () => {
    console.log("\nClearing Rich Presence…");
    await app.stop();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  await app.start();
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
