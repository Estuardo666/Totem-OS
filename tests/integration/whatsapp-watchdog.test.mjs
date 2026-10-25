import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, beforeEach, test } from "node:test";
import { prisma, resetDatabase, seedTestDatabase } from "./prisma-test-db.mjs";

const originalFetch = globalThis.fetch;
const originalCronSecret = process.env.CRON_SECRET;
const originalHealthUrl = process.env.WA_HEALTH_URL;
const fakePushUrl = new URL("./fakes/whatsapp-watchdog-push.mjs", import.meta.url);

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/system-push") return nextResolve(fakePushUrl.href, context);
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

const { POST } = await import("../../src/app/api/cron/whatsapp-watchdog/route.ts");
const { readPushCalls, resetPushCalls } = await import("./fakes/whatsapp-watchdog-push.mjs");

beforeEach(async () => {
  await resetDatabase();
  resetPushCalls();
  process.env.CRON_SECRET = "local-watchdog-cron-secret";
  process.env.WA_HEALTH_URL = "http://worker.test";
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
  if (originalHealthUrl === undefined) delete process.env.WA_HEALTH_URL;
  else process.env.WA_HEALTH_URL = originalHealthUrl;
  await prisma.$disconnect();
});

function request(authorization = "Bearer local-watchdog-cron-secret") {
  return new Request("http://localhost/api/cron/whatsapp-watchdog", {
    method: "POST",
    headers: { authorization },
  });
}

async function setOwnerPhone(adminId) {
  await prisma.user.update({ where: { id: adminId }, data: { phone: "593999000001" } });
  await prisma.globalConfig.upsert({
    where: { key: "whatsapp.ownerPhone" },
    create: { key: "whatsapp.ownerPhone", value: JSON.stringify("593999000001") },
    update: { value: JSON.stringify("593999000001") },
  });
}

async function addFailedChecks(minutesAgo) {
  const createdAt = new Date(Date.now() - minutesAgo * 60_000);
  await prisma.whatsAppEvent.create({
    data: { type: "WATCHDOG_CHECK", payload: { healthy: false }, createdAt },
  });
}

test("watchdog fails closed and does not check health without the cron bearer", async () => {
  globalThis.fetch = async () => { throw new Error("health must not be queried"); };
  const response = await POST(request("Bearer wrong-local-secret"));
  assert.equal(response.status, 401);
  assert.equal(await prisma.whatsAppEvent.count({ where: { type: "WATCHDOG_CHECK" } }), 0);
  assert.deepEqual(readPushCalls(), []);
});

test("watchdog does not alert before five minutes", async () => {
  const { admin } = await seedTestDatabase();
  await setOwnerPhone(admin.id);
  await addFailedChecks(4);
  globalThis.fetch = async () => new Response(null, { status: 503 });

  const response = await POST(request());
  const body = await response.json();
  assert.equal(body.data.alerted, false);
  assert.equal(body.data.minutesDown, 4);
  assert.deepEqual(readPushCalls(), []);
});

test("watchdog alerts after five minutes and notifies only the configured owner once", async () => {
  const { admin } = await seedTestDatabase();
  await setOwnerPhone(admin.id);
  await addFailedChecks(6);
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(null, { status: 503 });
  };

  const alertResponse = await POST(request());
  const alertBody = await alertResponse.json();
  assert.equal(alertBody.data.alerted, true);
  assert.equal(alertBody.data.healthy, false);
  assert.equal(new URL(requestedUrl).pathname, "/health");
  assert.equal(readPushCalls().length, 1);
  assert.deepEqual(readPushCalls()[0].userIds, [admin.id]);
  assert.equal(await prisma.whatsAppEvent.count({ where: { type: "WATCHDOG_ALERT" } }), 1);

  const duplicateResponse = await POST(request());
  assert.equal((await duplicateResponse.json()).data.alerted, false);
  assert.equal(readPushCalls().length, 1);
  assert.equal(await prisma.whatsAppEvent.count({ where: { type: "WATCHDOG_ALERT" } }), 1);
});

test("un chequeo sano reinicia el periodo del watchdog", async () => {
  const { admin } = await seedTestDatabase();
  await setOwnerPhone(admin.id);
  const healthyAt = new Date(Date.now() - 4 * 60_000);
  await prisma.whatsAppEvent.create({
    data: { type: "WATCHDOG_CHECK", payload: { healthy: true }, createdAt: healthyAt },
  });
  await addFailedChecks(3);
  globalThis.fetch = async () => new Response(null, { status: 503 });

  const response = await POST(request());
  const body = await response.json();
  assert.equal(body.data.alerted, false);
  assert.equal(body.data.minutesDown, 3);
  assert.deepEqual(readPushCalls(), []);
  assert.equal(await prisma.whatsAppEvent.count({ where: { type: "WATCHDOG_ALERT" } }), 0);
});
