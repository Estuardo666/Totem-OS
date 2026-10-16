import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { chromium, expect } from "@playwright/test";
import QRCode from "qrcode";

if (process.env.TOTEM_TEST_DATABASE !== "1" || !process.env.DATABASE_URL?.includes("127.0.0.1:55439/totem_whatsapp_test")) throw new Error("Requires the isolated local WhatsApp test database");
const secret = "local-whatsapp-browser-fixture-only-secret";
const baseURL = "http://localhost:3080";
const db = new PrismaClient();
const qrToken = "local-qr-proxy-fixture-only";
const png = await QRCode.toBuffer("LOCAL TEST ONLY - NOT A WHATSAPP SESSION");
let authenticatedQrRequests = 0;
const fakeWorker = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "local-test", connected: false }));
  } else if (request.url === "/health/qr" && request.headers.authorization === `Bearer ${qrToken}`) {
    authenticatedQrRequests++;
    response.writeHead(200, { "Content-Type": "image/png" });
    response.end(png);
  } else { response.writeHead(401); response.end(); }
});
await new Promise((resolve) => fakeWorker.listen(3082, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true });
try {
  await mkdir("reports", { recursive: true });
  await db.globalConfig.upsert({ where: { key: "whatsapp.paused" }, create: { key: "whatsapp.paused", value: "true" }, update: { value: "true" } });
  await db.whatsAppOwnerPrompt.upsert({ where: { id: "BROWSER1" }, create: { id: "BROWSER1", type: "ALERT", payload: { summary: "Aviso local verificable" }, options: ["Entendido"], expiresAt: new Date(Date.now() + 600000) }, update: { status: "OPEN", answer: null, expiresAt: new Date(Date.now() + 600000) } });
  await db.client.upsert({ where: { id: "wa-browser-client" }, create: { id: "wa-browser-client", name: "Cliente local WhatsApp" }, update: {} });
  await db.whatsAppGroup.upsert({ where: { jid: "browser@g.us" }, create: { jid: "browser@g.us", name: "Grupo local WhatsApp", clientId: "wa-browser-client" }, update: {} });
  await db.contentTask.upsert({ where: { id: "wa-browser-task" }, create: { id: "wa-browser-task", title: "Video local para deshacer", type: "REEL", status: "CLIENT_APPROVED", clientId: "wa-browser-client" }, update: { status: "CLIENT_APPROVED" } });
  await db.whatsAppApprovalRequest.upsert({ where: { id: "wa-browser-request" }, create: { id: "wa-browser-request", groupJid: "browser@g.us", messageId: "local-video", senderJid: "local-team", taskId: "wa-browser-task", status: "APPROVED", previousTaskStatus: "REVIEW_CLIENT", sentAt: new Date() }, update: { status: "APPROVED", previousTaskStatus: "REVIEW_CLIENT" } });
  await db.whatsAppMessage.upsert({ where: { dedupeKey: "approval-confirm:wa-browser-request" }, create: { to: "browser@g.us", body: "Confirmación local", kind: "APPROVAL_CONFIRM", dedupeKey: "approval-confirm:wa-browser-request", status: "PENDING" }, update: { status: "PENDING" } });
  const aiDraft = await db.whatsAppMessage.upsert({ where: { dedupeKey: "browser-ai-draft" }, create: { to: "browser@g.us", body: "🤖 Totem Bot: Borrador local", kind: "AI_REPLY", dedupeKey: "browser-ai-draft", status: "DRAFT" }, update: { status: "DRAFT", body: "🤖 Totem Bot: Borrador local" } });
  await db.whatsAppOwnerPrompt.upsert({ where: { id: "BROWSERAI" }, create: { id: "BROWSERAI", type: "AI_DRAFT", payload: { messageId: aiDraft.id, groupJid: "browser@g.us", question: "Pregunta local", proposedText: aiDraft.body }, options: ["Enviar", "Descartar", "Responder yo"], expiresAt: new Date(Date.now() + 600000) }, update: { status: "OPEN", answer: null, payload: { messageId: aiDraft.id, groupJid: "browser@g.us", question: "Pregunta local", proposedText: aiDraft.body }, expiresAt: new Date(Date.now() + 600000) } });
  for (const role of ["ADMIN", "EDITOR"]) {
    const id = `wa-browser-${role.toLowerCase()}`;
    await db.user.upsert({ where: { id }, create: { id, name: `WA Local ${role}`, email: `${id}@totem.test`, roleCode: role, roleLegacy: role }, update: { roleCode: role, roleLegacy: role } });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return ["localhost", "127.0.0.1"].includes(url.hostname) ? route.continue() : route.abort();
    });
    const token = await encode({ token: { id, sub: id, email: `${id}@totem.test`, roleCode: role, role, name: `WA Local ${role}` }, secret, salt: "authjs.session-token", maxAge: 3600 });
    await context.addCookies([{ name: "authjs.session-token", value: token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(`${baseURL}/admin/whatsapp`, { waitUntil: "networkidle", timeout: 120000 });
    assert.ok(response && response.status() < 500, `route failed for ${role}`);
    if (role === "ADMIN") {
      if (!page.url().includes("/admin/whatsapp")) {
        await page.screenshot({ path: "reports/whatsapp-admin-failure.png", fullPage: true });
        throw new Error(`Admin unexpectedly redirected to ${page.url()}`);
      }
      await page.getByRole("heading", { name: /WhatsApp/ }).first().waitFor();
      assert.deepEqual(errors, [], "admin must hydrate without runtime errors");
      await page.getByRole("button", { name: "Reanudar", exact: true }).evaluate((button) => new Promise((resolve) => {
        const check = () => Object.keys(button).some((key) => key.startsWith("__reactProps")) ? resolve(true) : setTimeout(check, 100);
        check();
      }));
      await page.getByRole("button", { name: "Reanudar", exact: true }).click();
      await expect.poll(async () => (await db.globalConfig.findUniqueOrThrow({ where: { key: "whatsapp.paused" } })).value, { timeout: 30000 }).toBe("false");
      await page.getByRole("button", { name: "Pausar bot", exact: true }).click();
      await expect.poll(async () => (await db.globalConfig.findUniqueOrThrow({ where: { key: "whatsapp.paused" } })).value).toBe("true");
      await page.getByRole("tab", { name: "Bandeja", exact: true }).click();
      const prompt = page.locator("article").filter({ hasText: "#BROWSER1" });
      await expect(prompt).toContainText("Aviso local verificable");
      await prompt.getByRole("button", { name: "Entendido", exact: true }).click();
      await expect.poll(async () => (await db.whatsAppOwnerPrompt.findUniqueOrThrow({ where: { id: "BROWSER1" } })).status).toBe("ANSWERED");
      const draftBox = page.locator("textarea").first();
      await draftBox.fill("🤖 Totem Bot: Edición local");
      await draftBox.locator("..").getByRole("button", { name: "Guardar edición", exact: true }).click();
      await expect.poll(async () => (await db.whatsAppMessage.findUniqueOrThrow({ where: { id: aiDraft.id } })).body).toBe("🤖 Totem Bot: Edición local");
      const editedPrompt = await db.whatsAppOwnerPrompt.findUniqueOrThrow({ where: { id: "BROWSERAI" } });
      assert.equal(editedPrompt.status, "OPEN");
      assert.equal(editedPrompt.payload.edited, true);
      await draftBox.locator("..").getByRole("button", { name: "Descartar", exact: true }).click();
      await expect.poll(async () => (await db.whatsAppMessage.findUniqueOrThrow({ where: { id: aiDraft.id } })).status).toBe("CANCELLED");
      await page.getByRole("tab", { name: "Aprobaciones", exact: true }).click();
      const approvalRow = page.locator("div.rounded-lg.border.p-3").filter({ has: page.getByText("Video local para deshacer", { exact: true }) });
      await approvalRow.getByRole("button", { name: "Deshacer", exact: true }).click();
      await expect.poll(async () => (await db.contentTask.findUniqueOrThrow({ where: { id: "wa-browser-task" } })).status).toBe("REVIEW_CLIENT");
      assert.equal((await db.whatsAppMessage.findUniqueOrThrow({ where: { dedupeKey: "approval-confirm:wa-browser-request" } })).status, "CANCELLED");
      await page.getByRole("tab", { name: /Equipo/ }).click();
      await page.getByText("WA Local ADMIN", { exact: true }).first().waitFor();
      await page.screenshot({ path: "reports/whatsapp-admin-local.png", fullPage: true });
      assert.deepEqual(errors, [], "admin must render without runtime errors");
      const qrResponse = await context.request.get(`${baseURL}/api/admin/whatsapp/qr`);
      assert.equal(qrResponse.status(), 200);
      assert.match(qrResponse.headers()["content-type"], /image\/png/);
      assert.equal(qrResponse.headers()["cache-control"], "private, no-store, max-age=0");
      assert.ok(authenticatedQrRequests > 0, "server must authenticate to the worker");
      assert.equal((await page.content()).includes(qrToken), false, "worker token must not reach page HTML");
      await page.getByRole("button", { name: "Ver QR", exact: true }).click();
      const qrImage = page.getByRole("dialog").locator("img");
      await expect(qrImage).toBeVisible();
      await expect.poll(async () => qrImage.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
      const qrUrl = new URL(await qrImage.getAttribute("src"), baseURL);
      assert.equal(qrUrl.origin, baseURL);
      assert.equal(qrUrl.pathname, "/api/admin/whatsapp/qr");
      assert.equal(qrUrl.searchParams.has("token"), false);
      await page.keyboard.press("Escape");
      assert.equal((await context.request.post(`${baseURL}/api/internal/whatsapp/notify`, { data: { event: "QR_REQUIRED" } })).status(), 401);
      assert.equal((await context.request.post(`${baseURL}/api/internal/whatsapp/notify`, {
        headers: { Authorization: "Bearer local-worker-bridge-fixture-only-32-characters" },
        data: { event: "QR_REQUIRED", text: "Untrusted text", userIds: ["someone-else"] },
      })).status(), 400, "bridge must reject caller-selected text and recipients");
    } else {
      assert.ok(!page.url().includes("/admin/whatsapp"), "EDITOR must be redirected from admin");
      assert.equal((await context.request.get(`${baseURL}/api/admin/whatsapp/qr`)).status(), 403);
    }
    console.log(`WhatsApp local browser ${role}: PASS`);
    await context.close();
  }
  const anonymous = await browser.newContext();
  assert.equal((await anonymous.request.get(`${baseURL}/api/admin/whatsapp/qr`)).status(), 401);
  await anonymous.close();
} finally {
  await browser.close();
  await new Promise((resolve) => fakeWorker.close(resolve));
  await db.$disconnect();
}
