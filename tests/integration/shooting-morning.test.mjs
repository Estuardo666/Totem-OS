import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, beforeEach, test } from "node:test";
import { prisma, resetDatabase, seedTestDatabase } from "./prisma-test-db.mjs";

const originalCronSecret = process.env.CRON_SECRET;
const originalHealthUrl = process.env.WA_HEALTH_URL;
const fakePusherUrl = new URL("./fakes/whatsapp-local-pusher.mjs", import.meta.url);

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/pusher") return nextResolve(fakePusherUrl.href, context);
  if (["next/server", "next/headers", "next/navigation", "next/cache"].includes(specifier)) {
    return nextResolve(`${specifier}.js`, context);
  }
  let url;
  if (specifier.startsWith("@/")) url = new URL(`../../src/${specifier.slice(2)}`, import.meta.url);
  else if (specifier.startsWith(".") && context.parentURL?.includes("/src/")) url = new URL(specifier, context.parentURL);
  if (url?.protocol === "file:") {
    const path = fileURLToPath(url);
    for (const candidate of [path, `${path}.ts`, `${path}/index.ts`]) {
      if (existsSync(candidate) && candidate.endsWith(".ts")) return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  return nextResolve(specifier, context);
} });

const { POST } = await import("../../src/app/api/cron/shooting-reminders-morning/route.ts");
const { readPusherCalls, resetPusherCalls } = await import("./fakes/whatsapp-local-pusher.mjs");

beforeEach(async () => {
  await resetDatabase();
  resetPusherCalls();
  process.env.CRON_SECRET = "local-shooting-cron-secret";
  delete process.env.WA_HEALTH_URL;
});

after(async () => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
  if (originalHealthUrl === undefined) delete process.env.WA_HEALTH_URL;
  else process.env.WA_HEALTH_URL = originalHealthUrl;
  await prisma.$disconnect();
});

function cronRequest() {
  return new Request("http://localhost/api/cron/shooting-reminders-morning", {
    method: "POST",
    headers: { Authorization: "Bearer local-shooting-cron-secret" },
  });
}

async function setWhatsAppConfig(key, value) {
  await prisma.globalConfig.upsert({
    where: { key: `whatsapp.${key}` },
    create: { key: `whatsapp.${key}`, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
}

test("el recordatorio de la mañana encola grupo y crew una sola vez", async () => {
  const { client, editor } = await seedTestDatabase();
  await setWhatsAppConfig("paused", false);
  await setWhatsAppConfig("clientsEnabled", true);
  await prisma.user.update({
    where: { id: editor.id },
    data: { phone: "0991111111", whatsappOptIn: true },
  });
  await prisma.whatsAppGroup.create({
    data: { jid: "morning-shoot@g.us", name: "Cliente", clientId: client.id, enabled: true, purposes: ["SHOOT"] },
  });
  const now = new Date();
  const ecuadorNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  ecuadorNow.setUTCHours(0, 0, 0, 0);
  const startTime = new Date(ecuadorNow.getTime() + 5 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000);
  await prisma.shoot.create({
    data: {
      title: "Rodaje de mañana local",
      clientId: client.id,
      startTime,
      endTime: new Date(startTime.getTime() + 2 * 60 * 60 * 1000),
      crew: { connect: { id: editor.id } },
    },
  });

  const firstResponse = await POST(cronRequest());
  assert.equal(firstResponse.status, 200);
  assert.deepEqual((await firstResponse.json()).data, { shootsProcessed: 1, notificationsSent: 2, errors: 0 });
  const firstMessages = await prisma.whatsAppMessage.findMany({ where: { kind: "SHOOT_REMINDER" } });
  assert.equal(firstMessages.length, 2);
  assert.deepEqual(firstMessages.map((message) => message.to).sort(), ["593991111111@s.whatsapp.net", "morning-shoot@g.us"]);
  assert.ok(firstMessages.every((message) => message.dedupeKey.includes(":morning:")));
  assert.ok(firstMessages.every((message) => message.body.includes("hoy")));
  assert.equal(await prisma.notification.count({ where: { userId: editor.id, type: "SHOOT_REMINDER" } }), 1);
  assert.equal(readPusherCalls().length, 1);

  const secondResponse = await POST(cronRequest());
  assert.deepEqual((await secondResponse.json()).data, { shootsProcessed: 0, notificationsSent: 0, errors: 0 });
  assert.equal(await prisma.whatsAppMessage.count({ where: { kind: "SHOOT_REMINDER" } }), 2);
  assert.equal(await prisma.notification.count({ where: { userId: editor.id, type: "SHOOT_REMINDER" } }), 1);
  assert.equal(readPusherCalls().length, 1);
});
