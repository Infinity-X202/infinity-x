import type { FastifyRequest } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { wsClientMessageSchema } from "@ixm/shared";
import { loadSession, readSessionToken } from "../lib/session.js";
import { hub } from "./hub.js";
import { createMessage, serializeMessage } from "../routes/conversations.js";
import { assertMember } from "../lib/access.js";
import { prisma } from "../db.js";
import { heartbeatPresence, setOfflineConnection, setOnline } from "../lib/presence.js";
import { consumeRateLimit } from "../lib/rate-limit.js";
import { env } from "../config.js";
import { logger } from "../logger.js";
import { isLivecamAdmin, isLivecamStreamer, livecamStreamerId } from "../lib/livecam.js";

const livecamWatchers = new Set<string>();

export async function registerWebsocket(app: any) {
  app.get("/ws", { websocket: true }, async (socket: WebSocket, req: FastifyRequest) => {
    const token = readSessionToken(req);
    if (!token) {
      socket.close(4401, "unauthorized");
      return;
    }
    const session = await loadSession(token);
    if (!session) {
      socket.close(4401, "unauthorized");
      return;
    }
    const userId = session.user.id;
    const client = hub.add(userId, socket);
    await setOnline(userId, client.id);
    await prisma.user.update({ where: { id: userId }, data: { lastSeen: new Date() } });
    hub.sendToUser(userId, { type: "hello", payload: { connectionId: client.id } });
    await broadcastPresence(userId, "online");
    void markIncomingDelivered(userId);
    if (isLivecamStreamer(session.user.username) && livecamWatchers.size > 0) {
      for (const viewerId of livecamWatchers) {
        hub.sendToUser(userId, { type: "livecam.viewer_join", payload: { viewerId } });
      }
    }

    const ping = setInterval(() => {
      try {
        socket.send(JSON.stringify({ type: "ping", ts: Date.now() }));
      } catch {
        /* closed */
      }
    }, 25000);

    socket.on("message", async (raw: Buffer | string) => {
      try {
        const parsed = wsClientMessageSchema.safeParse(JSON.parse(String(raw)));
        if (!parsed.success) {
          socket.send(JSON.stringify({ type: "error", payload: { code: "VALIDATION_ERROR" } }));
          return;
        }
        const msg = parsed.data;
        if (msg.type === "ping") {
          await heartbeatPresence(userId, client.id);
          socket.send(JSON.stringify({ type: "pong", ts: Date.now() }));
          return;
        }
        if (msg.type === "message.send") {
          const rl = await consumeRateLimit({
            key: `message:${userId}`,
            max: env.MESSAGE_RATE_LIMIT_MAX,
            windowSeconds: env.MESSAGE_RATE_LIMIT_WINDOW_SECONDS,
          });
          if (!rl.ok) {
            socket.send(JSON.stringify({ type: "error", payload: { code: "RATE_LIMITED" } }));
            return;
          }
          const message = await createMessage(userId, msg.payload);
          await hub.broadcastToConversation(msg.payload.conversationId, {
            type: "message.new",
            payload: { ...serializeMessage(message), clientId: msg.payload.clientId },
          });
          return;
        }
        if (msg.type === "typing") {
          await assertMember(userId, msg.payload.conversationId);
          await hub.broadcastToConversation(msg.payload.conversationId, {
            type: "typing",
            payload: { conversationId: msg.payload.conversationId, userId, isTyping: msg.payload.isTyping },
          });
          return;
        }
        if (msg.type === "recording") {
          await assertMember(userId, msg.payload.conversationId);
          await hub.broadcastToConversation(msg.payload.conversationId, {
            type: "recording",
            payload: { conversationId: msg.payload.conversationId, userId, isRecording: msg.payload.isRecording },
          });
          return;
        }
        if (msg.type === "livecam.watch") {
          const user = session.user;
          if (!isLivecamAdmin(user.username)) {
            socket.send(JSON.stringify({ type: "error", payload: { code: "FORBIDDEN" } }));
            return;
          }
          const already = livecamWatchers.has(userId);
          livecamWatchers.add(userId);
          const streamerId = await livecamStreamerId();
          if (streamerId) hub.sendToUser(streamerId, { type: "livecam.viewer_join", payload: { viewerId: userId, resume: already } });
          return;
        }
        if (msg.type === "livecam.unwatch") {
          if (!isLivecamAdmin(session.user.username)) return;
          livecamWatchers.delete(userId);
          const streamerId = await livecamStreamerId();
          if (streamerId) hub.sendToUser(streamerId, { type: "livecam.viewer_left", payload: { viewerId: userId } });
          return;
        }
        if (msg.type === "livecam.switch") {
          if (!isLivecamAdmin(session.user.username)) return;
          const streamerId = await livecamStreamerId();
          if (streamerId && livecamWatchers.has(userId)) {
            hub.sendToUser(streamerId, { type: "livecam.switch_camera", payload: { facing: msg.payload.facing } });
          }
          return;
        }
        if (msg.type === "livecam.offer") {
          if (!isLivecamStreamer(session.user.username)) return;
          if (!livecamWatchers.size) return;
          for (const viewerId of livecamWatchers) {
            hub.sendToUser(viewerId, { type: "livecam.offer", payload: { sdp: msg.payload.sdp, fromUserId: userId } });
          }
          return;
        }
        if (msg.type === "livecam.answer") {
          if (!isLivecamAdmin(session.user.username)) return;
          const streamerId = await livecamStreamerId();
          if (!streamerId) return;
          hub.sendToUser(streamerId, { type: "livecam.answer", payload: { sdp: msg.payload.sdp, fromUserId: userId } });
          return;
        }
        if (msg.type === "livecam.ice") {
          if (isLivecamStreamer(session.user.username)) {
            for (const viewerId of livecamWatchers) {
              hub.sendToUser(viewerId, { type: "livecam.ice", payload: { ...msg.payload, fromUserId: userId } });
            }
            return;
          }
          if (isLivecamAdmin(session.user.username)) {
            const streamerId = await livecamStreamerId();
            if (streamerId) hub.sendToUser(streamerId, { type: "livecam.ice", payload: { ...msg.payload, fromUserId: userId } });
          }
          return;
        }
        if (msg.type === "receipt") {
          await assertMember(userId, msg.payload.conversationId);
          const message = await prisma.message.findUnique({ where: { id: msg.payload.messageId } });
          if (!message || message.conversationId !== msg.payload.conversationId) return;
          await prisma.messageReceipt.upsert({
            where: { messageId_userId: { messageId: message.id, userId } },
            update: {
              deliveredAt: msg.payload.status === "delivered" ? new Date() : undefined,
              readAt: msg.payload.status === "read" ? new Date() : undefined,
            },
            create: {
              messageId: message.id,
              userId,
              deliveredAt: new Date(),
              readAt: msg.payload.status === "read" ? new Date() : null,
            },
          });
          if (msg.payload.status === "read") {
            await prisma.conversationMember.update({
              where: { conversationId_userId: { conversationId: msg.payload.conversationId, userId } },
              data: { lastReadMessageId: message.id },
            });
          }
          await hub.broadcastToConversation(msg.payload.conversationId, {
            type: "receipt",
            payload: { ...msg.payload, userId },
          });
        }
      } catch (err) {
        logger.warn({ err }, "ws_handler_error");
        try {
          socket.send(JSON.stringify({ type: "error", payload: { code: "FORBIDDEN" } }));
        } catch {
          /* ignore */
        }
      }
    });

    socket.on("close", async () => {
      clearInterval(ping);
      if (isLivecamAdmin(session.user.username)) {
        livecamWatchers.delete(userId);
        const streamerId = await livecamStreamerId();
        if (streamerId) hub.sendToUser(streamerId, { type: "livecam.viewer_left", payload: { viewerId: userId } });
      }
      hub.remove(client.id);
      const last = await setOfflineConnection(userId, client.id);
      if (last) {
        await prisma.user.update({ where: { id: userId }, data: { lastSeen: new Date() } });
        await broadcastPresence(userId, "offline");
      }
    });
  });
}

async function broadcastPresence(userId: string, status: "online" | "offline") {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    select: { conversationId: true },
  });
  const peerIds = new Set<string>();
  for (const m of memberships) {
    const members = await prisma.conversationMember.findMany({
      where: { conversationId: m.conversationId },
      select: { userId: true },
    });
    members.forEach((x) => {
      if (x.userId !== userId) peerIds.add(x.userId);
    });
  }
  const payload = { type: "presence", payload: { userId, status, at: new Date().toISOString() } };
  for (const id of peerIds) hub.sendToUser(id, payload);
}

async function markIncomingDelivered(userId: string) {
  const memberships = await prisma.conversationMember.findMany({ where: { userId }, select: { conversationId: true } });
  const ids = memberships.map((m) => m.conversationId);
  if (!ids.length) return;
  const messages = await prisma.message.findMany({
    where: { conversationId: { in: ids }, senderId: { not: userId }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: { receipts: true },
  });
  for (const message of messages) {
    const mine = message.receipts.find((r) => r.userId === userId);
    if (mine?.deliveredAt) continue;
    await prisma.messageReceipt.upsert({
      where: { messageId_userId: { messageId: message.id, userId } },
      update: { deliveredAt: new Date() },
      create: { messageId: message.id, userId, deliveredAt: new Date() },
    });
    hub.broadcastToConversation(message.conversationId, {
      type: "receipt",
      payload: { conversationId: message.conversationId, messageId: message.id, status: "delivered", userId },
    });
  }
}
