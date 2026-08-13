import { app, Menu, nativeImage, shell, Tray } from "electron";
import path from "node:path";
import { createLyricPresenceApp } from "./runtime.js";

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
    const trayIconPath = app.isPackaged
      ? path.join(process.resourcesPath, "trayTemplate.png")
      : path.join(app.getAppPath(), "build", "trayTemplate.png");
    const icon = nativeImage.createFromPath(trayIconPath);
    if (icon.isEmpty()) throw new Error(`Could not load menu-bar icon from ${trayIconPath}`);
    icon.setTemplateImage(true);
    tray = new Tray(icon);
    tray.setTitle("");
    tray.on("click", () => tray.popUpContextMenu());
    refreshMenu();
    runTransition(startPresence);
  });
}
