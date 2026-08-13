import net from "node:net";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const OPCODE_HANDSHAKE = 0;
const OPCODE_FRAME = 1;

export function encodeFrame(opcode, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const header = Buffer.alloc(8);
  header.writeInt32LE(opcode, 0);
  header.writeInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

function socketCandidates() {
  if (process.platform === "win32") {
    return Array.from({ length: 10 }, (_, index) => `\\\\?\\pipe\\discord-ipc-${index}`);
  }
  const roots = [
    process.env.XDG_RUNTIME_DIR,
    process.env.TMPDIR,
    process.env.TMP,
    process.env.TEMP,
    process.platform === "darwin" ? path.join(os.homedir(), "Library", "Application Support", "discord") : null,
    "/tmp",
  ].filter(Boolean);
  return [...new Set(roots.flatMap((root) => Array.from({ length: 10 }, (_, index) => path.join(root, `discord-ipc-${index}`))))];
}

function connectSocket(socketPath) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

async function findDiscordSocket() {
  for (const candidate of socketCandidates()) {
    try {
      return await connectSocket(candidate);
    } catch (error) {
      if (!["ENOENT", "ECONNREFUSED"].includes(error.code)) throw error;
    }
  }
  throw new Error("Could not connect to Discord. Make sure the desktop app is running.");
}

export class DiscordIpcClient {
  constructor(clientId) {
    this.clientId = clientId;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
    this.ready = null;
  }

  async connect() {
    if (this.socket && !this.socket.destroyed) return this.ready;
    this.socket = await findDiscordSocket();
    this.socket.on("data", (chunk) => this.onData(chunk));
    this.socket.on("close", () => this.onClose());
    this.socket.on("error", () => {});
    this.ready = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Discord did not complete the Rich Presence handshake.")), 10_000);
      this.pending.set("READY", {
        resolve: (payload) => { clearTimeout(timeout); resolve(payload); },
        reject,
      });
    });
    this.socket.write(encodeFrame(OPCODE_HANDSHAKE, { v: 1, client_id: this.clientId }));
    return this.ready;
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 8) {
      const length = this.buffer.readInt32LE(4);
      if (this.buffer.length < 8 + length) return;
      const payload = JSON.parse(this.buffer.subarray(8, 8 + length).toString("utf8"));
      this.buffer = this.buffer.subarray(8 + length);
      const key = payload.evt === "READY" ? "READY" : payload.nonce;
      const pending = this.pending.get(key);
      if (!pending) continue;
      this.pending.delete(key);
      if (payload.evt === "ERROR") pending.reject(new Error(payload.data?.message || "Discord RPC error."));
      else pending.resolve(payload.data);
    }
  }

  onClose() {
    this.socket = null;
    this.ready = null;
    for (const pending of this.pending.values()) pending.reject(new Error("Discord disconnected."));
    this.pending.clear();
  }

  async command(cmd, args) {
    await this.connect();
    const nonce = crypto.randomUUID();
    const response = new Promise((resolve, reject) => this.pending.set(nonce, { resolve, reject }));
    this.socket.write(encodeFrame(OPCODE_FRAME, { cmd, args, nonce }));
    return response;
  }

  setActivity(activity) {
    return this.command("SET_ACTIVITY", { pid: process.pid, activity });
  }

  clearActivity() {
    return this.setActivity(null);
  }

  close() {
    this.socket?.destroy();
  }
}
