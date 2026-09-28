import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEGACY_USERNAMES = ["dua", "adil", "alice", "bob", "luna", "echo"];
const ACCESS_USERNAMES = ["nova", "orbit", "vega", "lyra", "atlas", "ember", "lund"];

async function main() {
  await prisma.messageReaction.deleteMany();
  await prisma.messageReceipt.deleteMany();
  await prisma.messageAttachment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationMember.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.blockedUser.deleteMany();
  await prisma.session.deleteMany();
  await prisma.device.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();

  const removed = await prisma.user.deleteMany({
    where: { username: { in: [...LEGACY_USERNAMES, ...ACCESS_USERNAMES] } },
  });

  console.log(`Reset complete: all messages cleared, ${removed.count} user(s) removed.`);
  console.log("New users (Nova / Orbit / Vega / Lyra / Atlas / Ember) will be created on next sign-in.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
