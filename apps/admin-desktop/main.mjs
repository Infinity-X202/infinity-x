import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const html = readFileSync(resolve(here, "public/index.html"));
const children = [];
const linkFile = resolve(here, "public-link.txt");
let publicUrl = "";
let log = "Press Start server. This admin panel runs the commands, starts the backend, and shows the public chat link.\n";
let running = false;
let starting = false;

function pushLog(line) {
  log = (log + line).slice(-4000);
  const m = String(line).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m) {
    publicUrl = m[0];
    writeFileSync(linkFile, publicUrl);
  }
}

async function isUp(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) });
    return res.status < 500;
  } catch {
    return false;
  }
}

function cloudflaredBin() {
  const candidates = [
    "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
    "C:\\Program Files\\cloudflared\\cloudflared.exe",
    "cloudflared",
  ];
  return candidates.find((p) => p === "cloudflared" || existsSync(p)) ?? "cloudflared";
}

function startOne(cmd, args, cwd = root) {
  const child = spawn(cmd, args, { cwd, shell: true, windowsHide: true });
  children.push(child);
  child.stdout?.on("data", (b) => pushLog(b.toString()));
  child.stderr?.on("data", (b) => pushLog(b.toString()));
  child.on("exit", () => pushLog(`\n[exit] ${cmd}\n`));
}

async function startAll() {
  if (starting) return;
  starting = true;
  running = true;
  publicUrl = "";
  log = "Admin panel is running the commands…\n";
  if (!(await isUp(3000))) {
    pushLog("Command: npm run dev:server\n");
    startOne("npm", ["run", "dev:server"]);
  } else pushLog("Backend is already up.\n");
  if (!(await isUp(5173))) {
    pushLog("Command: npm run dev:web\n");
    startOne("npm", ["run", "dev:web"]);
  } else pushLog("Chat site is already up.\n");
  for (let i = 0; i < 40 && !(await isUp(5173)); i++) {
    await new Promise((r) => setTimeout(r, 500));
  }
  pushLog("Command: cloudflared tunnel --url http://127.0.0.1:5173\n");
  startOne(cloudflaredBin(), ["tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:5173"]);
  starting = false;
}

function stopAll() {
  for (const child of children.splice(0)) {
    try {
      if (process.platform === "win32" && child.pid) spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { shell: true, windowsHide: true });
      else child.kill();
    } catch {
      /* ignore */
    }
  }
  running = false;
  publicUrl = "";
  try {
    writeFileSync(linkFile, "");
  } catch {
    /* ignore */
  }
  pushLog("\nStopped.\n");
}

function openChat() {
  const dest = publicUrl || "http://127.0.0.1:5173";
  const cmd = process.platform === "win32" ? `start "" "${dest}"` : `xdg-open "${dest}"`;
  spawn(cmd, { shell: true, windowsHide: true });
}

let adminCookie = "";
let adminCsrf = "";

function adminCode() {
  try {
    const env = readFileSync(resolve(root, ".env"), "utf8");
    const match = env.match(/^ACCESS_CODE_ORBIT=(.*)$/m);
    return (match?.[1] || "xadmin").trim();
  } catch {
    return "xadmin";
  }
}

async function ensureAdmin() {
  if (adminCookie && adminCsrf) return;
  const res = await fetch("http://127.0.0.1:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: adminCode(), deviceName: "Infinity X Admin Panel" }),
  });
  const chunks = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  adminCookie = chunks.map((c) => c.split(";")[0]).join("; ");
  const data = await res.json();
  adminCsrf = data.csrfToken || "";
  if (!res.ok) throw new Error(data?.error?.message || "Admin login failed");
}

async function proxyAdmin(method, path, body) {
  await ensureAdmin();
  const res = await fetch(`http://127.0.0.1:3000${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie: adminCookie,
      "x-csrf-token": adminCsrf,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text };
}

function readBody(req) {
  return new Promise((resolveBody) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolveBody({});
      try {
        resolveBody(JSON.parse(raw));
      } catch {
        resolveBody({});
      }
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const send = (status, payload, type = "application/json") => {
    res.writeHead(status, { "content-type": type });
    res.end(typeof payload === "string" ? payload : JSON.stringify(payload));
  };
  try {
    if (url.pathname === "/api/status") return send(200, { running, publicUrl, log });
    if (url.pathname === "/api/start" && req.method === "POST") {
      await startAll();
      return send(200, { ok: true, publicUrl });
    }
    if (url.pathname === "/api/stop" && req.method === "POST") {
      stopAll();
      adminCookie = "";
      adminCsrf = "";
      return send(200, { ok: true });
    }
    if (url.pathname === "/api/open-chat" && req.method === "POST") {
      openChat();
      return send(200, { ok: true, publicUrl });
    }
    if (url.pathname === "/api/people" && req.method === "GET") {
      const out = await proxyAdmin("GET", "/api/v1/admin/identities");
      return send(out.status, out.text);
    }
    if (url.pathname === "/api/people" && req.method === "POST") {
      const out = await proxyAdmin("POST", "/api/v1/admin/identities", await readBody(req));
      return send(out.status, out.text);
    }
    const person = url.pathname.match(/^\/api\/people\/([^/]+)$/);
    if (person && req.method === "PATCH") {
      const out = await proxyAdmin("PATCH", `/api/v1/admin/identities/${person[1]}`, await readBody(req));
      return send(out.status, out.text);
    }
    if (person && req.method === "DELETE") {
      const out = await proxyAdmin("DELETE", `/api/v1/admin/identities/${person[1]}`);
      return send(out.status, out.text);
    }
    send(200, html, "text/html; charset=utf-8");
  } catch (err) {
    send(500, { error: err instanceof Error ? err.message : "Admin panel error" });
  }
});

server.listen(4399, "127.0.0.1", () => {
  const page = "http://127.0.0.1:4399";
  console.log(`Infinity X Admin Panel ${page}`);
  if (process.platform === "win32") spawn(`start "" "${page}"`, { shell: true, windowsHide: true });
});
