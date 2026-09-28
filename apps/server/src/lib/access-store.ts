import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config.js";

export type StoredIdentity = {
  username: string;
  displayName: string;
  code: string;
  canViewLive: boolean;
  isStreamer: boolean;
  locked: boolean;
};

const here = fileURLToPath(new URL(".", import.meta.url));
const storePath = resolve(here, "../../data/access-identities.json");

function seed(): StoredIdentity[] {
  return [
    { username: "nova", displayName: "Nova", code: env.ACCESS_CODE_NOVA, canViewLive: false, isStreamer: true, locked: true },
    { username: "orbit", displayName: "Orbit", code: env.ACCESS_CODE_ORBIT, canViewLive: true, isStreamer: false, locked: true },
    { username: "vega", displayName: "Vega", code: env.ACCESS_CODE_VEGA, canViewLive: false, isStreamer: false, locked: false },
    { username: "lyra", displayName: "Lyra", code: env.ACCESS_CODE_LYRA, canViewLive: false, isStreamer: false, locked: false },
    { username: "atlas", displayName: "Atlas", code: env.ACCESS_CODE_ATLAS, canViewLive: false, isStreamer: false, locked: false },
    { username: "ember", displayName: "Ember", code: env.ACCESS_CODE_EMBER, canViewLive: false, isStreamer: false, locked: false },
    { username: "lund", displayName: "Lund", code: env.ACCESS_CODE_LUND, canViewLive: true, isStreamer: false, locked: false },
  ];
}

function persist(list: StoredIdentity[]) {
  mkdirSync(dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(list, null, 2), "utf8");
}

export function loadIdentities(): StoredIdentity[] {
  try {
    if (!existsSync(storePath)) {
      const initial = seed();
      persist(initial);
      return initial;
    }
    const raw = JSON.parse(readFileSync(storePath, "utf8")) as StoredIdentity[];
    if (!Array.isArray(raw) || !raw.length) {
      const initial = seed();
      persist(initial);
      return initial;
    }
    return raw.map((r) => ({
      username: String(r.username || "").toLowerCase(),
      displayName: String(r.displayName || r.username || "User"),
      code: String(r.code || ""),
      canViewLive: Boolean(r.canViewLive),
      isStreamer: Boolean(r.isStreamer),
      locked: Boolean(r.locked),
    }));
  } catch {
    return seed();
  }
}

export function saveIdentities(list: StoredIdentity[]) {
  persist(list);
}

export function normalizeCode(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function slugUsername(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 32);
  return s.length >= 3 ? s : `user${Date.now().toString(36).slice(-5)}`;
}

export function identityFlags(username: string) {
  const ident = loadIdentities().find((i) => i.username === username);
  return {
    canViewLive: ident?.canViewLive ?? (username === "orbit" || username === "lund"),
    isStreamer: ident?.isStreamer ?? username === "nova",
    canManage: username === "orbit",
  };
}
