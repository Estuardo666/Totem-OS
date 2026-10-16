import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

// Explicit command only: no automatic changes on application startup.
const config = JSON.parse(await readFile(new URL("../docs/whatsapp-bot.config.json", import.meta.url), "utf8"));
const keys = ["paused", "clientsEnabled", "ownerPhone", "approvalReminderHours", "maxApprovalReminders", "skipWeekends", "teamDailyHour", "amountsInGroups", "aiModel"];
const prisma = new PrismaClient();
try {
  await prisma.$transaction(keys.map((key) => prisma.globalConfig.upsert({
    where: { key: `whatsapp.${key}` },
    create: { key: `whatsapp.${key}`, value: JSON.stringify(config[key]) },
    // Re-running bootstrap must never overwrite approvals or pause changes.
    update: {},
  })));
  console.log("Configuración inicial de WhatsApp creada; se conservaron los valores existentes.");
} finally {
  await prisma.$disconnect();
}
