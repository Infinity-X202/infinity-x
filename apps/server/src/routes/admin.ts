import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { errors } from "../errors.js";
import { csrfGuard } from "../lib/csrf.js";
import { requireUser, type AuthedRequest } from "../lib/session.js";
import { identityFlags, loadIdentities, normalizeCode, saveIdentities, slugUsername } from "../lib/access-store.js";
import { ensureAccessUsers } from "../lib/identities.js";

const createSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(64),
  canViewLive: z.boolean().optional().default(false),
  isStreamer: z.boolean().optional().default(false),
});

const updateSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  code: z.string().trim().min(1).max(64).optional(),
  canViewLive: z.boolean().optional(),
  isStreamer: z.boolean().optional(),
});

function requireManager(req: AuthedRequest) {
  if (!identityFlags(req.user.username).canManage) throw errors.forbidden("Admin only");
}

export async function adminRoutes(app: FastifyInstance) {
  app.get("/identities", { preHandler: [requireUser] }, async (req) => {
    const me = req as AuthedRequest;
    if (!identityFlags(me.user.username).canViewLive && !identityFlags(me.user.username).canManage) {
      throw errors.forbidden();
    }
    await ensureAccessUsers();
    return { identities: loadIdentities() };
  });

  app.post("/identities", { preHandler: [csrfGuard, requireUser] }, async (req) => {
    requireManager(req as AuthedRequest);
    const body = createSchema.parse(req.body);
    const list = loadIdentities();
    let username = slugUsername(body.displayName);
    if (list.some((i) => i.username === username)) username = `${username}${Math.floor(Math.random() * 90 + 10)}`;
    const codeN = normalizeCode(body.code);
    if (list.some((i) => normalizeCode(i.code) === codeN || i.username === codeN)) {
      throw errors.conflict("That code is already in use");
    }
    if (body.isStreamer) {
      for (const i of list) i.isStreamer = false;
    }
    list.push({
      username,
      displayName: body.displayName,
      code: body.code.trim(),
      canViewLive: body.canViewLive,
      isStreamer: body.isStreamer,
      locked: false,
    });
    saveIdentities(list);
    await ensureAccessUsers();
    return { identity: list.find((i) => i.username === username) };
  });

  app.patch("/identities/:username", { preHandler: [csrfGuard, requireUser] }, async (req) => {
    requireManager(req as AuthedRequest);
    const { username } = req.params as { username: string };
    const body = updateSchema.parse(req.body);
    const list = loadIdentities();
    const ident = list.find((i) => i.username === username);
    if (!ident) throw errors.notFound();
    if (body.displayName) ident.displayName = body.displayName;
    if (body.code) {
      const codeN = normalizeCode(body.code);
      if (list.some((i) => i.username !== username && (normalizeCode(i.code) === codeN || i.username === codeN))) {
        throw errors.conflict("That code is already in use");
      }
      ident.code = body.code.trim();
    }
    if (body.canViewLive !== undefined) ident.canViewLive = body.canViewLive;
    if (body.isStreamer !== undefined) {
      if (body.isStreamer) {
        for (const i of list) i.isStreamer = i.username === username;
      } else {
        ident.isStreamer = false;
      }
    }
    saveIdentities(list);
    await ensureAccessUsers();
    return { identity: ident };
  });

  app.delete("/identities/:username", { preHandler: [csrfGuard, requireUser] }, async (req) => {
    requireManager(req as AuthedRequest);
    const { username } = req.params as { username: string };
    const list = loadIdentities();
    const ident = list.find((i) => i.username === username);
    if (!ident) throw errors.notFound();
    if (ident.locked) throw errors.forbidden("This account cannot be deleted");
    saveIdentities(list.filter((i) => i.username !== username));
    await prisma.user.updateMany({ where: { username }, data: { status: "disabled" } });
    const user = await prisma.user.findUnique({ where: { username } });
    if (user) {
      await prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return { ok: true };
  });
}
