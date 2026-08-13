import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const SCOPES = "user-read-currently-playing user-read-playback-state";

function base64Url(buffer) {
  return buffer.toString("base64url");
}

async function readTokens(tokenPath) {
  try {
    return JSON.parse(await fs.readFile(tokenPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeTokens(tokenPath, tokens) {
  await fs.mkdir(path.dirname(tokenPath), { recursive: true });
  await fs.writeFile(tokenPath, `${JSON.stringify(tokens, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(tokenPath, 0o600);
}

async function tokenRequest(body) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Spotify authorization failed (${response.status}): ${payload.error_description || payload.error}`);
  }
  return payload;
}

function waitForAuthorizationCode(redirectUri, expectedState) {
  const redirect = new URL(redirectUri);
  if (redirect.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(redirect.hostname)) {
    throw new Error("SPOTIFY_REDIRECT_URI must use an HTTP loopback address such as http://127.0.0.1:43821/callback.");
  }

  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, redirectUri);
      if (url.pathname !== redirect.pathname) {
        response.writeHead(404).end("Not found");
        return;
      }
      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (error || !code || state !== expectedState) {
        response.writeHead(400, { "content-type": "text/plain" }).end("Authorization failed. You can close this tab.");
        server.close();
        reject(new Error(error || "Spotify returned an invalid authorization response."));
        return;
      }
      response.writeHead(200, { "content-type": "text/plain" }).end("Spotify connected. You can close this tab.");
      server.close();
      resolve(code);
    });
    server.on("error", reject);
    server.listen(Number(redirect.port), redirect.hostname);
  });
}

export class SpotifyAuth {
  constructor({ clientId, redirectUri, tokenPath }) {
    this.clientId = clientId;
    this.redirectUri = redirectUri;
    this.tokenPath = tokenPath;
    this.tokens = null;
  }

  async accessToken() {
    this.tokens ||= await readTokens(this.tokenPath);
    if (!this.tokens) await this.authorize();
    if (Date.now() >= this.tokens.expiresAt - 60_000) await this.refresh();
    return this.tokens.accessToken;
  }

  async authorize() {
    const verifier = base64Url(crypto.randomBytes(64));
    const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
    const state = base64Url(crypto.randomBytes(18));
    const authorizationUrl = new URL(AUTHORIZE_URL);
    authorizationUrl.search = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: this.redirectUri,
      scope: SCOPES,
      code_challenge_method: "S256",
      code_challenge: challenge,
      state,
    });

    const codePromise = waitForAuthorizationCode(this.redirectUri, state);
    console.log("\nConnect Spotify by opening this URL:\n");
    console.log(`${authorizationUrl}\n`);
    const code = await codePromise;
    const payload = await tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      code_verifier: verifier,
    });
    this.tokens = this.normalizeTokens(payload);
    await writeTokens(this.tokenPath, this.tokens);
  }

  async refresh() {
    if (!this.tokens?.refreshToken) throw new Error("Spotify did not return a refresh token; remove .data and authorize again.");
    const payload = await tokenRequest({
      grant_type: "refresh_token",
      refresh_token: this.tokens.refreshToken,
      client_id: this.clientId,
    });
    this.tokens = this.normalizeTokens(payload, this.tokens.refreshToken);
    await writeTokens(this.tokenPath, this.tokens);
  }

  normalizeTokens(payload, fallbackRefreshToken) {
    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || fallbackRefreshToken,
      expiresAt: Date.now() + payload.expires_in * 1000,
    };
  }
}
