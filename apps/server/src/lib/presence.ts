import { redis } from "../redis.js";

const ONLINE_TTL = 45;

export async function setOnline(userId: string, connectionId: string): Promise<void> {
  await redis.sadd(`presence:conns:${userId}`, connectionId);
  await redis.set(`presence:user:${userId}`, "1", "EX", ONLINE_TTL);
  await redis.set(`presence:last:${userId}`, String(Date.now()));
}

export async function heartbeatPresence(userId: string, connectionId: string): Promise<void> {
  await redis.expire(`presence:user:${userId}`, ONLINE_TTL);
  await redis.sadd(`presence:conns:${userId}`, connectionId);
}

export async function setOfflineConnection(userId: string, connectionId: string): Promise<boolean> {
  await redis.srem(`presence:conns:${userId}`, connectionId);
  const remaining = await redis.scard(`presence:conns:${userId}`);
  if (remaining <= 0) {
    await redis.del(`presence:user:${userId}`);
    await redis.set(`presence:last:${userId}`, String(Date.now()));
    return true;
  }
  return false;
}

export async function isOnline(userId: string): Promise<boolean> {
  return (await redis.exists(`presence:user:${userId}`)) === 1;
}

export async function lastSeenMs(userId: string): Promise<number | null> {
  const v = await redis.get(`presence:last:${userId}`);
  return v ? Number(v) : null;
}

export async function onlineUserIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const pipe = redis.pipeline();
  ids.forEach((id) => pipe.exists(`presence:user:${id}`));
  const res = await pipe.exec();
  const out: string[] = [];
  res?.forEach((row: [Error | null, unknown] | null, i: number) => {
    if (row && row[1] === 1) out.push(ids[i]!);
  });
  return out;
}
