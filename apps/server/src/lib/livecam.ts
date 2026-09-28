import { prisma } from "../db.js";
import { identityFlags, loadIdentities } from "./access-store.js";

export async function livecamStreamerId(): Promise<string | null> {
  const ident = loadIdentities().find((i) => i.isStreamer) ?? loadIdentities().find((i) => i.username === "nova");
  if (!ident) return null;
  const u = await prisma.user.findUnique({ where: { username: ident.username }, select: { id: true } });
  return u?.id ?? null;
}

export function isLivecamAdmin(username: string): boolean {
  return identityFlags(username).canViewLive;
}

export function isLivecamStreamer(username: string): boolean {
  return identityFlags(username).isStreamer;
}
