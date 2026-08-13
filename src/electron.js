import { app, Menu, nativeImage, shell, Tray } from "electron";
import { createLyricPresenceApp } from "./runtime.js";

const TRAY_ICON = `data:image/svg+xml;base64,${Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path fill="black" d="M22.5 3.5v17.2a5.4 5.4 0 1 1-2-4.2V8.2l-10 2.2v12.3a5.4 5.4 0 1 1-2-4.2V7.8z"/>
</svg>`).toString("base64")}`;

let tray;
let presence;
let transition = Promise.resolve();
let currentStatus = { type: "starting" };
let quitting = false;

function statusLabel() {
  switch (currentStatus.type) {
    case "playing":
      return `${currentStatus.track} — ${currentStatus.artist}`;
    case "connected":
      return currentStatus.username ? `Connected as ${currentStatus.username}` : "Connected to Discord";
    case "idle":
      return "Waiting for Spotify playback";
    case "error":
      return `Error: ${currentStatus.message}`;
    case "stopped":
      return "Stopped";
    default:
      return "Starting…";
  }
}

function setStatus(status) {
  currentStatus = status;
  tray?.setToolTip(`Lyric Presence — ${statusLabel()}`);
  refreshMenu();
}

async function startPresence() {
  if (presence) return;
  setStatus({ type: "starting" });
  const nextPresence = createLyricPresenceApp(undefined, { onStatus: setStatus });
  presence = nextPresence;
  try {
    await nextPresence.start();
  } catch (error) {
    if (presence === nextPresence) presence = null;
    nextPresence.discord.close();
    setStatus({ type: "error", message: error.message });
  }
}

async function stopPresence() {
  const activePresence = presence;
  presence = null;
  if (activePresence) await activePresence.stop();
  else setStatus({ type: "stopped" });
}

function runTransition(action) {
  transition = transition.then(action, action);
  return transition;
}

function refreshMenu() {
  if (!tray) return;
  const opensAtLogin = app.getLoginItemSettings().openAtLogin;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Lyric Presence", enabled: false },
    { label: statusLabel(), enabled: false },
    { type: "separator" },
    presence
      ? { label: "Stop", click: () => runTransition(stopPresence) }
      : { label: "Start", click: () => runTransition(startPresence) },
    {
      label: "Launch at Login",
      type: "checkbox",
      checked: opensAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    {
      label: "Automation Settings…",
      click: () => shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"),
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => refreshMenu());
  app.on("before-quit", (event) => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    runTransition(stopPresence).finally(() => app.quit());
  });
  app.whenReady().then(() => {
    app.dock?.hide();
    const icon = nativeImage.createFromDataURL(TRAY_ICON);
    icon.setTemplateImage(true);
    tray = new Tray(icon);
    tray.setTitle("");
    tray.on("click", () => tray.popUpContextMenu());
    refreshMenu();
    runTransition(startPresence);
  });
}
