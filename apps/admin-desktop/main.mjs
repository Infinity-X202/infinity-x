import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const html = readFileSync(resolve(here, "public/index.html"));
const children = [];
let publicUrl = "";
let log = "";
let running = false;

function pushLog(line) {
  log = (log + line).slice(-4000);
  const m = String(line).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m) publicUrl = m[0];
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

function startAll() {
  if (running) return;
  running = true;
  publicUrl = "";
  log = "Starting API, website and Cloudflare tunnel…\n";
  startOne("npm", ["run", "dev:server"]);
  startOne("npm", ["run", "dev:web"]);
  setTimeout(() => {
    startOne(cloudflaredBin(), ["tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:5173"]);
  }, 4000);
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
  pushLog("\nStopped.\n");
}

function openTarget(target) {
  const base = publicUrl || "http://127.0.0.1:5173";
  const dest = target === "desk" ? `${base}/desk` : base;
  const cmd = process.platform === "win32" ? `start "" "${dest}"` : `xdg-open "${dest}"`;
  spawn(cmd, { shell: true, windowsHide: true });
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/api/status") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ running, publicUrl, log }));
    return;
  }
  if (url.pathname === "/api/start" && req.method === "POST") {
    startAll();
    res.end("ok");
    return;
  }
  if (url.pathname === "/api/stop" && req.method === "POST") {
    stopAll();
    res.end("ok");
    return;
  }
  if (url.pathname === "/api/open" && req.method === "POST") {
    openTarget(url.searchParams.get("target"));
    res.end("ok");
    return;
  }
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(html);
});

server.listen(4399, "127.0.0.1", () => {
  const page = "http://127.0.0.1:4399";
  console.log(`Infinity X Admin Panel ${page}`);
  if (process.platform === "win32") spawn(`start "" "${page}"`, { shell: true, windowsHide: true });
});
