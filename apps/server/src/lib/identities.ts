import { prisma } from "../db.js";
import { env } from "../config.js";
import { hashPassword } from "./password.js";
import {
  identityFlags,
  loadIdentities,
  normalizeCode,
  type StoredIdentity,
} from "./access-store.js";

export type AccessIdentity = StoredIdentity;

export function accessIdentities(): AccessIdentity[] {
  return loadIdentities();
}

export function matchAccessCode(input: string): AccessIdentity | null {
  const n = normalizeCode(input);
  if (!n) return null;
  for (const ident of accessIdentities()) {
    const extras =
      ident.username === "orbit"
        ? env.ACCESS_CODE_ORBIT_ALT.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    if (n === normalizeCode(ident.code) || extras.some((c) => n === normalizeCode(c)) || n === ident.username) {
      return ident;
    }
  }
  return null;
}

export { identityFlags };

async function ensureDirectChat(userA: string, userB: string): Promise<void> {
  const existing = await prisma.conversation.findFirst({
    where: {
      type: "direct",
      AND: [{ members: { some: { userId: userA } } }, { members: { some: { userId: userB } } }],
    },
    include: { members: true },
  });
  if (existing && existing.members.length === 2) return;
  await prisma.conversation.create({
    data: {
      type: "direct",
      members: {
        create: [
          { userId: userA, role: "owner" },
          { userId: userB, role: "member" },
        ],
      },
    },
  });
}

async function ensureGroupChat(userIds: string[]): Promise<void> {
  const groupTitle = "Infinity X";
  const existingGroup = await prisma.conversation.findFirst({
    where: { type: "group", title: { in: [groupTitle, "Infinity X Lounge"] } },
    include: { members: true },
  });
  if (!existingGroup) {
    await prisma.conversation.create({
      data: {
        type: "group",
        title: groupTitle,
        members: {
          create: userIds.map((userId, i) => ({
            userId,
            role: i === 0 ? "owner" : "member",
          })),
        },
      },
    });
    return;
  }
  if (existingGroup.title !== groupTitle) {
    await prisma.conversation.update({
      where: { id: existingGroup.id },
      data: { title: groupTitle },
    });
  }
  const memberIds = new Set(existingGroup.members.map((m) => m.userId));
  for (const userId of userIds) {
    if (!memberIds.has(userId)) {
      await prisma.conversationMember.create({
        data: { conversationId: existingGroup.id, userId, role: "member" },
      });
    }
  }
}

export async function ensureAccessUsers(): Promise<void> {
  const created: { id: string; username: string }[] = [];
  let dummy: string | null = null;
  for (const ident of accessIdentities()) {
    const email = `${ident.username}@infinityx.local`;
    const existing = await prisma.user.findUnique({ where: { username: ident.username } });
    if (existing) {
      created.push({ id: existing.id, username: existing.username });
      const data: { status: "active"; displayName?: string; emailVerifiedAt: Date; role?: "admin" | "user" } = {
        status: "active",
        emailVerifiedAt: new Date(),
      };
      if (existing.displayName !== ident.displayName) data.displayName = ident.displayName;
      if (ident.username === "orbit" && existing.role !== "admin") data.role = "admin";
      await prisma.user.update({ where: { id: existing.id }, data });
      continue;
    }
    dummy ??= await hashPassword(`locked-${env.SESSION_SECRET}`);
    const user = await prisma.user.create({
      data: {
        username: ident.username,
        email,
        passwordHash: dummy,
        displayName: ident.displayName,
        status: "active",
        emailVerifiedAt: new Date(),
        role: ident.username === "orbit" ? "admin" : "user",
      },
    });
    created.push({ id: user.id, username: user.username });
  }

  for (let i = 0; i < created.length; i++) {
    for (let j = i + 1; j < created.length; j++) {
      await ensureDirectChat(created[i]!.id, created[j]!.id);
    }
  }

  await ensureGroupChat(created.map((u) => u.id));
}
