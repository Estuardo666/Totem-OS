import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function ensureTestUser() {
  const password = await bcrypt.hash("1234567890@@", 10);
  const user = await prisma.user.upsert({
    where: { email: "test@totem.com" },
    update: { password, roleLegacy: "ADMIN" },
    create: {
      email: "test@totem.com",
      name: "Test User",
      password,
      roleLegacy: "ADMIN",
      image: "https://avatar.vercel.sh/test",
    },
  });
  console.log(`✅ Test user ready: ${user.email} (role: ${user.roleLegacy})`);
}

ensureTestUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
