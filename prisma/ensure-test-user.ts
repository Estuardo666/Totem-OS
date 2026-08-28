import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

for (const envFile of [".env.local", ".env"]) {
  if (existsSync(envFile)) {
    loadEnvFile(envFile);
  }
}

const prisma = new PrismaClient();

async function ensureTestUser() {
  const testEmail = process.env.E2E_TEST_EMAIL?.trim();
  const testPassword = process.env.E2E_TEST_PASSWORD;

  if (!testEmail || !testPassword) {
    throw new Error(
      "E2E_TEST_EMAIL and E2E_TEST_PASSWORD are required to prepare the E2E user.",
    );
  }

  const password = await bcrypt.hash(testPassword, 12);
  const user = await prisma.user.upsert({
    where: { email: testEmail },
    update: { password },
    create: {
      email: testEmail,
      name: "Test User",
      password,
      roleLegacy: "EDITOR",
      roleCode: "EDITOR",
      image: "https://avatar.vercel.sh/test",
    },
  });
  console.log(`✅ E2E test user ready (role: ${user.roleLegacy})`);
}

ensureTestUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
