import { buildApp } from "./app.js";
import { env } from "./config.js";
import { prisma } from "./db.js";
import { redis } from "./redis.js";
import { logger } from "./logger.js";
import { ensureAccessUsers } from "./lib/identities.js";

const app = await buildApp();

try {
  await redis.ping();
  await prisma.$queryRaw`SELECT 1`;
  await ensureAccessUsers();
  await app.listen({ host: env.HOST, port: env.PORT });
  logger.info({ port: env.PORT }, "infinity_x_started");
} catch (err) {
  logger.error({ err }, "startup_failed");
  process.exit(1);
}

async function shutdown() {
  await app.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
