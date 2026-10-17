import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, beforeEach, test } from "node:test";
import { prisma, resetDatabase, seedTestDatabase } from "./prisma-test-db.mjs";

// Resolve the application's TS aliases without bundling or replacing its DB.
registerHooks({ resolve(specifier, context, nextResolve) {
  // Next's bundler resolves these extensionless package subpaths in the app.
  if (["next/server", "next/headers", "next/navigation", "next/cache"].includes(specifier)) {
    return nextResolve(`${specifier}.js`, context);
  }
  let url;
  if (specifier.startsWith("@/")) url = new URL(`../../src/${specifier.slice(2)}`, import.meta.url);
  else if (specifier.startsWith(".") && (context.parentURL?.includes("/src/") || context.parentURL?.includes("/worker/whatsapp/"))) url = new URL(specifier, context.parentURL);
  if (url?.protocol === "file:") {
    const path = fileURLToPath(url);
    for (const candidate of [path, `${path}.ts`, `${path}/index.ts`]) {
      if (existsSync(candidate) && candidate.endsWith(".ts")) return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  return nextResolve(specifier, context);
} });
const { db } = await import("../../src/lib/db.ts");
const { enqueueWhatsApp, canSendToWhatsAppDestination } = await import("../../src/lib/whatsapp/enqueue.ts");
const { applyOwnerPromptAnswer } = await import("../../src/lib/whatsapp/decisions.ts");
const { buildClientScopedTools } = await import("../../src/lib/assistant/client-scoped-tools.ts");
const { proposeWhatsAppRollout, isWhatsAppPromotionEligible } = await import("../../src/lib/whatsapp/rollout.ts");
const { enqueueWhatsAppApprovalReminders } = await import("../../src/lib/whatsapp/approval-reminders.ts");
const { enqueueWhatsAppTeamDailySummaries } = await import("../../src/lib/whatsapp/team-daily.ts");
const { buildAssistantTools } = await import("../../src/lib/assistant/tools.ts");
const { verifyDraftToken } = await import("../../src/lib/assistant/drafts.ts");
const { sendNextWhatsAppMessage } = await import("../../worker/whatsapp/sender.ts");
const { enqueueWhatsAppPaymentReminders } = await import("../../src/lib/finance-cobranza-service.ts");
const { routeClientApprovalReply } = await import("../../worker/whatsapp/approvals.ts");
const { useWhatsAppAuthState } = await import("../../worker/whatsapp/auth-store.ts");
const { identifyContact, resolveContact } = await import("../../worker/whatsapp/contacts.ts");

beforeEach(async () => { await resetDatabase(); });
after(async () => { await Promise.all([prisma.$disconnect(), db.$disconnect()]); });

async function config(key, value) {
  await prisma.globalConfig.upsert({ where: { key: `whatsapp.${key}` }, create: { key: `whatsapp.${key}`, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
}

test("la cola bloquea destinos desconocidos y clientes antes de habilitarlos", async () => {
  await seedTestDatabase();
  await config("paused", false);
  await config("ownerPhone", "593999999999");
  assert.equal(await canSendToWhatsAppDestination("593911111111@s.whatsapp.net"), false);
  await prisma.whatsAppGroup.create({ data: { jid: "service-test@g.us", name: "Cliente", enabled: true } });
  assert.equal(await canSendToWhatsAppDestination("service-test@g.us"), false);
  await assert.rejects(enqueueWhatsApp({ to: "service-test@g.us", body: "No enviar", kind: "MANUAL" }));
  const input = { to: "593999999999@s.whatsapp.net", body: "Prueba local", kind: "MANUAL", dedupeKey: "service-owner-once" };
  const results = await Promise.all(Array.from({ length: 5 }, () => enqueueWhatsApp(input)));
  assert.equal(results.filter((result) => result.created).length, 1);
  assert.equal(await prisma.whatsAppMessage.count(), 1);
  await config("paused", true);
  assert.equal(await canSendToWhatsAppDestination(input.to), false);
});

test("rechazar un borrador no cambia la tarea y aprobarlo concurrentemente aplica una vez", async () => {
  const { client, task } = await seedTestDatabase();
  await prisma.contentTask.update({ where: { id: task.id }, data: { status: "REVIEW_CLIENT" } });
  await prisma.whatsAppGroup.create({ data: { jid: "decision@g.us", name: "Cliente", clientId: client.id } });
  const request = await prisma.whatsAppApprovalRequest.create({ data: { groupJid: "decision@g.us", messageId: "video1", senderJid: "team", taskId: task.id, sentAt: new Date(), previousTaskStatus: task.status } });
  for (const id of ["REJECT1", "APPROVE1"]) await prisma.whatsAppOwnerPrompt.create({ data: { id, type: "APPROVAL_DRAFT", payload: { requestId: request.id, groupJid: "decision@g.us", intent: "APPROVE" }, options: ["Sí", "No", "Ver"], expiresAt: new Date(Date.now() + 60000) } });
  await applyOwnerPromptAnswer({ id: "REJECT1", answer: "2" });
  assert.equal((await prisma.contentTask.findUniqueOrThrow({ where: { id: task.id } })).status, "REVIEW_CLIENT");
  const navigation = await applyOwnerPromptAnswer({ id: "APPROVE1", answer: "3" });
  assert.equal(navigation.url, "/admin/whatsapp");
  assert.equal((await prisma.whatsAppOwnerPrompt.findUniqueOrThrow({ where: { id: "APPROVE1" } })).status, "OPEN");
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => applyOwnerPromptAnswer({ id: "APPROVE1", answer: "1" })));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal((await prisma.contentTask.findUniqueOrThrow({ where: { id: task.id } })).status, "CLIENT_APPROVED");
  assert.equal(await prisma.whatsAppMessage.count(), 0, "no confirmation escapes a blocked client destination");
});

test("una decisión atrasada no revierte contenido publicado y deja el prompt sin consumir", async () => {
  const { client, task } = await seedTestDatabase();
  await prisma.contentTask.update({ where: { id: task.id }, data: { status: "PUBLISHED" } });
  await prisma.whatsAppGroup.create({ data: { jid: "stale@g.us", name: "Cliente", clientId: client.id } });
  const request = await prisma.whatsAppApprovalRequest.create({ data: { groupJid: "stale@g.us", messageId: "old-video", senderJid: "team", taskId: task.id, sentAt: new Date(), previousTaskStatus: "EDITING" } });
  await prisma.whatsAppOwnerPrompt.create({ data: { id: "STALE1", type: "APPROVAL_DRAFT", payload: { requestId: request.id, groupJid: "stale@g.us", intent: "APPROVE" }, options: ["Sí", "No"], expiresAt: new Date(Date.now() + 60000) } });
  await assert.rejects(applyOwnerPromptAnswer({ id: "STALE1", answer: "1" }));
  assert.equal((await prisma.contentTask.findUniqueOrThrow({ where: { id: task.id } })).status, "PUBLISHED");
  assert.equal((await prisma.whatsAppOwnerPrompt.findUniqueOrThrow({ where: { id: "STALE1" } })).status, "OPEN");
});

test("las herramientas del cliente no exponen campos internos ni otros clientes", async () => {
  const { client, task } = await seedTestDatabase();
  await prisma.client.create({ data: { id: "private-client", name: "Otro cliente" } });
  await prisma.contentTask.create({ data: { title: "SECRETO OTRO CLIENTE", type: "REEL", status: "EDITING", clientId: "private-client" } });
  const tools = buildClientScopedTools(client.id);
  const rows = await tools.proximosContenidos();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].titulo, task.title);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["estado", "fecha", "tipo", "titulo"]);
  assert.equal(JSON.stringify(await tools.buscarContenido("SECRETO")).includes("SECRETO"), false);
  assert.equal("enviarWhatsApp" in tools, false);
});

test("AUTO se propone con cinco aciertos y solo activa la función aprobada", async () => {
  const { client } = await seedTestDatabase();
  await config("paused", false);
  await config("ownerPhone", "593999999999");
  await prisma.whatsAppGroup.create({ data: { jid: "promotion@g.us", name: "Cliente", clientId: client.id, enabled: true } });
  for (let i = 0; i < 5; i++) await prisma.whatsAppOwnerPrompt.create({ data: { id: `AI${i}`, type: "AI_DRAFT", status: "ANSWERED", answer: "1", payload: { groupJid: "promotion@g.us" }, options: ["Sí", "No"], expiresAt: new Date(Date.now() + 60000) } });
  assert.equal(await isWhatsAppPromotionEligible("promotion@g.us", "AI"), true);
  assert.equal(await isWhatsAppPromotionEligible("promotion@g.us", "APPROVAL"), false);
  await proposeWhatsAppRollout();
  await proposeWhatsAppRollout();
  const prompts = await prisma.whatsAppOwnerPrompt.findMany({ where: { type: "PROMOTE_AUTO" } });
  assert.equal(prompts.length, 1);
  assert.equal((await prisma.whatsAppGroup.findUniqueOrThrow({ where: { jid: "promotion@g.us" } })).aiMode, "DRAFT");
  await applyOwnerPromptAnswer({ id: prompts[0].id, answer: "1" });
  const group = await prisma.whatsAppGroup.findUniqueOrThrow({ where: { jid: "promotion@g.us" } });
  assert.equal(group.aiMode, "AUTO");
  assert.equal(group.approvalMode, "DRAFT");
});

test("reasignar un grupo no reutiliza métricas del cliente anterior para AUTO", async () => {
  const { client } = await seedTestDatabase();
  await prisma.whatsAppGroup.create({ data: { jid: "reassigned@g.us", name: "Cliente", clientId: client.id, enabled: true } });
  for (let i = 0; i < 5; i++) await prisma.whatsAppOwnerPrompt.create({ data: { id: `OLD${i}`, type: "AI_DRAFT", status: "ANSWERED", answer: "1", payload: { groupJid: "reassigned@g.us" }, options: ["Sí", "No"], createdAt: new Date(Date.now() - 60000), expiresAt: new Date() } });
  assert.equal(await isWhatsAppPromotionEligible("reassigned@g.us", "AI"), true);
  await prisma.whatsAppEvent.create({ data: { type: "GROUP_REASSIGNED", groupJid: "reassigned@g.us", payload: {} } });
  assert.equal(await isWhatsAppPromotionEligible("reassigned@g.us", "AI"), false);
});

test("recordatorio cita el video una vez y una respuesta detiene recordatorios sin cancelar la aprobación", async () => {
  const { client, task } = await seedTestDatabase();
  const now = new Date("2026-10-16T15:00:00Z");
  await config("paused", false);
  await config("clientsEnabled", true);
  await prisma.contentTask.update({ where: { id: task.id }, data: { status: "REVIEW_CLIENT" } });
  await prisma.whatsAppGroup.create({ data: { jid: "reminder@g.us", name: "Cliente", clientId: client.id, enabled: true } });
  const request = await prisma.whatsAppApprovalRequest.create({ data: { groupJid: "reminder@g.us", messageId: "video-remind", senderJid: "team", taskId: task.id, sentAt: new Date("2026-10-14T14:00:00Z") } });
  await enqueueWhatsAppApprovalReminders(now);
  await enqueueWhatsAppApprovalReminders(now);
  const messages = await prisma.whatsAppMessage.findMany({ where: { kind: "APPROVAL_REMINDER" } });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].quotedId, "video-remind");
  await prisma.whatsAppInbound.create({ data: { id: "client-followup", chatJid: "reminder@g.us", senderJid: "client", isTeam: false, type: "text", text: "Lo vemos hoy", rawKey: {}, ts: new Date("2026-10-16T15:30:00Z") } });
  await enqueueWhatsAppApprovalReminders(new Date("2026-10-19T15:00:00Z"));
  assert.equal((await prisma.whatsAppApprovalRequest.findUniqueOrThrow({ where: { id: request.id } })).status, "PENDING");
  assert.equal(await prisma.whatsAppMessage.count({ where: { kind: "APPROVAL_REMINDER", status: "PENDING" } }), 0);
});

test("resumen usa las 08:00 de Ecuador y respeta miembro de medio mes sin duplicados", async () => {
  const { editor, task } = await seedTestDatabase();
  await config("paused", false);
  await prisma.user.update({ where: { id: editor.id }, data: { phone: "0991111111", whatsappOptIn: true, activeSchedule: { type: "monthRange", from: 1, to: 15 } } });
  await prisma.contentTask.update({ where: { id: task.id }, data: { dueDate: new Date("2026-10-14T15:00:00Z") } });
  await enqueueWhatsAppTeamDailySummaries(new Date("2026-10-16T13:00:00Z"));
  assert.equal(await prisma.whatsAppMessage.count(), 0, "day 16 must be inactive");
  await enqueueWhatsAppTeamDailySummaries(new Date("2026-10-15T12:00:00Z"));
  assert.equal(await prisma.whatsAppMessage.count(), 0, "07:00 must not enqueue the 08:00 digest");
  await enqueueWhatsAppTeamDailySummaries(new Date("2026-10-15T13:00:00Z"));
  await enqueueWhatsAppTeamDailySummaries(new Date("2026-10-15T13:00:00Z"));
  const rows = await prisma.whatsAppMessage.findMany();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].to, "593991111111@s.whatsapp.net");
  assert.match(rows[0].body, /Atrasada/);
});

test("chat y voz preparan recordatorios con datos reales y firma sin enviar antes de confirmar", async () => {
  const { admin, editor, client } = await seedTestDatabase();
  const previousKey = process.env.TOKEN_ENCRYPTION_KEY;
  // Synthetic signing key used only by this isolated test process.
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  try {
    await config("paused", false);
    await config("clientsEnabled", true);
    await prisma.whatsAppGroup.create({ data: { jid: "assistant@g.us", name: "Cliente", clientId: client.id, enabled: true } });
    await prisma.invoice.create({ data: { clientId: client.id, amount: 321.45, status: "PENDING", dueDate: new Date("2026-10-20T15:00:00Z") } });
    const tools = buildAssistantTools({ id: admin.id, name: admin.name, role: "ADMIN" });
    const proposal = await tools.enviarWhatsApp.execute({ tipo: "recordatorio_pago", clientId: client.id });
    assert.equal(proposal.status, "requires_confirmation");
    const verified = verifyDraftToken(proposal.draftToken, admin.id);
    assert.equal(verified.ok, true);
    assert.equal(verified.payload.action, "enviarWhatsApp");
    assert.equal(verified.payload.input.to, "assistant@g.us");
    assert.match(verified.payload.input.body, /Cliente CP02/);
    assert.doesNotMatch(verified.payload.input.body, /321/);
    assert.equal(verifyDraftToken(proposal.draftToken, editor.id).ok, false);
    const [payload, signature] = proposal.draftToken.split(".");
    const altered = JSON.parse(Buffer.from(payload, "base64url").toString());
    altered.input.body = "Texto alterado";
    assert.equal(verifyDraftToken(`${Buffer.from(JSON.stringify(altered)).toString("base64url")}.${signature}`, admin.id).ok, false);
    assert.equal(await prisma.whatsAppMessage.count(), 0);
    const free = await tools.enviarWhatsApp.execute({ tipo: "libre", clientId: client.id, texto: "Hola, confirmamos la coordinación." });
    assert.equal(free.status, "requires_confirmation");
    assert.equal(verifyDraftToken(free.draftToken, admin.id).payload.input.to, "assistant@g.us");
    assert.match(free.summary.Destino, /Cliente/);
    await config("clientsEnabled", false);
    assert.ok((await tools.enviarWhatsApp.execute({ tipo: "libre", clientId: client.id, texto: "Hola" })).error);
    await config("clientsEnabled", true);
    const editorTools = buildAssistantTools({ id: editor.id, name: editor.name, role: "EDITOR" });
    assert.ok((await editorTools.enviarWhatsApp.execute({ tipo: "recordatorio_pago", clientId: client.id })).error);
    const pauseDraft = await tools.pausarBot.execute({ pausado: true });
    assert.equal(pauseDraft.status, "requires_confirmation");
    assert.equal((await prisma.globalConfig.findUniqueOrThrow({ where: { key: "whatsapp.paused" } })).value, "false");
  } finally {
    if (previousKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = previousKey;
  }
});

test("sender cancela si cambia el cliente durante el jitter", async () => {
  const { client } = await seedTestDatabase();
  await config("paused", false);
  await config("clientsEnabled", true);
  await prisma.client.create({ data: { id: "new-sender-client", name: "Otro cliente" } });
  await prisma.whatsAppGroup.create({ data: { jid: "sender@g.us", name: "Cliente", clientId: client.id, enabled: true } });
  const message = await prisma.whatsAppMessage.create({ data: { to: "sender@g.us", body: "Datos del cliente anterior", kind: "SHOOT_REMINDER" } });
  let sends = 0;
  await sendNextWhatsAppMessage({ sendPresenceUpdate: async () => {}, sendMessage: async () => { sends++; return { key: { id: "should-not-send" } }; } }, async () => true, {
    sleep: async () => { await prisma.whatsAppGroup.update({ where: { jid: "sender@g.us" }, data: { clientId: "new-sender-client" } }); },
  });
  assert.equal(sends, 0);
  const row = await prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: message.id } });
  assert.equal(row.status, "CANCELLED");
  assert.equal(row.error, "GROUP_POLICY_CHANGED");
});

test("sender reconstruye la cita del video y entrega solo una vez al adaptador local", async () => {
  const { client, task } = await seedTestDatabase();
  await config("paused", false);
  await config("clientsEnabled", true);
  await prisma.contentTask.update({ where: { id: task.id }, data: { status: "REVIEW_CLIENT" } });
  await prisma.whatsAppGroup.create({ data: { jid: "quoted@g.us", name: "Cliente", clientId: client.id, enabled: true } });
  const ts = new Date(Date.now() - 3600000);
  await prisma.whatsAppInbound.create({ data: { id: "quoted-video", chatJid: "quoted@g.us", senderJid: "593991111111@s.whatsapp.net", isTeam: true, type: "video", fileName: "local.mp4", rawKey: { id: "quoted-video", remoteJid: "quoted@g.us", participant: "593991111111@s.whatsapp.net" }, ts } });
  await prisma.whatsAppApprovalRequest.create({ data: { groupJid: "quoted@g.us", messageId: "quoted-video", senderJid: "team", taskId: task.id, sentAt: ts } });
  const message = await prisma.whatsAppMessage.create({ data: { to: "quoted@g.us", body: "Recordatorio local", kind: "APPROVAL_REMINDER", quotedId: "quoted-video" } });
  const calls = [];
  const socket = { sendPresenceUpdate: async () => {}, sendMessage: async (...args) => { calls.push(args); return { key: { id: "local-sent-id" } }; } };
  await sendNextWhatsAppMessage(socket, async () => true, { sleep: async () => {} });
  await sendNextWhatsAppMessage(socket, async () => true, { sleep: async () => {} });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2].quoted.key.id, "quoted-video");
  assert.equal(calls[0][2].quoted.key.participant, "593991111111@s.whatsapp.net");
  assert.ok(calls[0][2].quoted.message.videoMessage);
  const sent = await prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: message.id } });
  assert.equal(sent.status, "SENT");
  assert.equal(sent.waMessageId, "local-sent-id");
});

test("sender no envía un borrador IA si el equipo ya respondió hace más de diez minutos", async () => {
  const { client } = await seedTestDatabase();
  await config("paused", false);
  await config("clientsEnabled", true);
  await prisma.whatsAppGroup.create({ data: { jid: "ai-guard@g.us", name: "Cliente", clientId: client.id, enabled: true } });
  await prisma.whatsAppInbound.create({ data: { id: "old-question", chatJid: "ai-guard@g.us", senderJid: "client", isTeam: false, type: "text", text: "¿Cuándo sale?", rawKey: {}, ts: new Date(Date.now() - 1800000) } });
  await prisma.whatsAppInbound.create({ data: { id: "old-team-answer", chatJid: "ai-guard@g.us", senderJid: "team", isTeam: true, type: "text", text: "Ya lo coordinamos", rawKey: {}, ts: new Date(Date.now() - 1200000) } });
  await prisma.whatsAppEvent.create({ data: { type: "AI_QUESTION", groupJid: "ai-guard@g.us", payload: { inboundId: "old-question", clientId: client.id } } });
  const message = await prisma.whatsAppMessage.create({ data: { to: "ai-guard@g.us", body: "🤖 Totem Bot: Respuesta antigua", kind: "AI_REPLY", quotedId: "old-question" } });
  let sends = 0;
  await sendNextWhatsAppMessage({ sendPresenceUpdate: async () => {}, sendMessage: async () => { sends++; return { key: {} }; } }, async () => true, { sleep: async () => {} });
  assert.equal(sends, 0);
  const row = await prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: message.id } });
  assert.equal(row.status, "CANCELLED");
  assert.equal(row.error, "TEAM_REPLIED");
});

test("cobro respeta 72 horas reales, destino personal y montos privados", async () => {
  const { client } = await seedTestDatabase();
  await config("paused", false);
  await config("clientsEnabled", true);
  await prisma.whatsAppGroup.create({ data: { jid: "payments@g.us", name: "Cliente", clientId: client.id, enabled: true } });
  await prisma.invoice.create({ data: { clientId: client.id, amount: 321.45, status: "SENT", dueDate: new Date("2026-10-13T18:00:00Z") } });
  await enqueueWhatsAppPaymentReminders(new Date("2026-10-16T14:00:00Z"));
  assert.equal(await prisma.whatsAppMessage.count(), 0, "68 hours must not count as 72 hours");
  await enqueueWhatsAppPaymentReminders(new Date("2026-10-17T14:00:00Z"));
  await enqueueWhatsAppPaymentReminders(new Date("2026-10-17T14:00:00Z"));
  const grouped = await prisma.whatsAppMessage.findMany();
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].to, "payments@g.us");
  assert.doesNotMatch(grouped[0].body, /321|\$/);
  await prisma.client.update({ where: { id: client.id }, data: { whatsappPhone: "0992222222", paymentReminderTarget: "PERSONAL" } });
  await prisma.invoice.create({ data: { clientId: client.id, amount: 500.25, status: "SENT", dueDate: new Date("2026-10-17T05:00:00Z") } });
  await enqueueWhatsAppPaymentReminders(new Date("2026-10-17T14:00:00Z"));
  const personal = await prisma.whatsAppMessage.findFirstOrThrow({ where: { to: "593992222222@s.whatsapp.net" } });
  assert.match(personal.body, /\$500\.25/);
});

test("rodaje 24 horas antes se encola para grupo y crew privado una vez", async () => {
  const { enqueueDueShoot24h } = await import("../../src/lib/shooting-notifications.ts");
  const { client, editor } = await seedTestDatabase();
  await config("paused", false);
  await config("clientsEnabled", true);
  await prisma.user.update({ where: { id: editor.id }, data: { phone: "0991111111", whatsappOptIn: true } });
  await prisma.whatsAppGroup.create({ data: { jid: "shoots@g.us", name: "Cliente", clientId: client.id, enabled: true } });
  const shoot = await prisma.shoot.create({ data: { title: "Rodaje local", clientId: client.id, startTime: new Date("2026-10-17T14:00:00Z"), endTime: new Date("2026-10-17T16:00:00Z"), crew: { connect: { id: editor.id } } } });
  await enqueueDueShoot24h(new Date("2026-10-16T14:00:00Z"));
  await enqueueDueShoot24h(new Date("2026-10-16T14:00:00Z"));
  const messages = await prisma.whatsAppMessage.findMany({ where: { kind: "SHOOT_REMINDER" } });
  assert.equal(messages.length, 2);
  assert.deepEqual(messages.map((message) => message.to).sort(), ["593991111111@s.whatsapp.net", "shoots@g.us"]);
  assert.ok(messages.every((message) => message.dedupeKey.startsWith(`shoot:${shoot.id}:24h:`)));
});

test("dos videos no se aprueban a ciegas; citar uno crea borrador y el dueño confirma solo ese", async () => {
  const { client, task } = await seedTestDatabase();
  await config("paused", false);
  await config("clientsEnabled", true);
  await prisma.contentTask.update({ where: { id: task.id }, data: { status: "REVIEW_CLIENT" } });
  const second = await prisma.contentTask.create({ data: { title: "Segundo video", type: "REEL", status: "REVIEW_CLIENT", clientId: client.id } });
  await prisma.whatsAppGroup.create({ data: { jid: "reply@g.us", name: "Cliente", clientId: client.id, enabled: true } });
  for (const [id, taskId] of [["first-video", task.id], ["second-video", second.id]]) await prisma.whatsAppApprovalRequest.create({ data: { groupJid: "reply@g.us", messageId: id, senderJid: "team", taskId, sentAt: new Date(Date.now() - 3600000), previousTaskStatus: "REVIEW_CLIENT" } });
  const incoming = { id: "approval-reply", groupJid: "reply@g.us", senderJid: "client", caption: "aprobado", quotedId: null, isTeam: false, type: "text", ts: new Date() };
  await routeClientApprovalReply(incoming);
  assert.equal(await prisma.whatsAppOwnerPrompt.count({ where: { type: "APPROVAL_DRAFT" } }), 0);
  assert.equal(await prisma.contentTask.count({ where: { status: "CLIENT_APPROVED" } }), 0);
  await routeClientApprovalReply({ ...incoming, id: "quoted-approval-reply", quotedId: "first-video" });
  const draft = await prisma.whatsAppOwnerPrompt.findFirstOrThrow({ where: { type: "APPROVAL_DRAFT" } });
  assert.equal((await prisma.contentTask.findUniqueOrThrow({ where: { id: task.id } })).status, "REVIEW_CLIENT");
  await applyOwnerPromptAnswer({ id: draft.id, answer: "1" });
  assert.equal((await prisma.contentTask.findUniqueOrThrow({ where: { id: task.id } })).status, "CLIENT_APPROVED");
  assert.equal((await prisma.contentTask.findUniqueOrThrow({ where: { id: second.id } })).status, "REVIEW_CLIENT");
  assert.equal((await prisma.whatsAppMessage.findFirstOrThrow({ where: { kind: "APPROVAL_CONFIRM" } })).quotedId, "first-video");
});

test("credenciales y claves de sesión sobreviven a reconstruir el worker desde PostgreSQL", async () => {
  const first = await useWhatsAppAuthState();
  const registrationId = first.state.creds.registrationId;
  const privateKey = Buffer.from(first.state.creds.noiseKey.private);
  await first.saveCreds();
  await first.state.keys.set({ session: { "local-session": Buffer.from([1, 2, 3, 4]) } });
  const restored = await useWhatsAppAuthState();
  assert.equal(restored.state.creds.registrationId, registrationId);
  assert.deepEqual(Buffer.from(restored.state.creds.noiseKey.private), privateKey);
  assert.deepEqual(Buffer.from((await restored.state.keys.get("session", ["local-session"]))["local-session"]), Buffer.from([1, 2, 3, 4]));
  await restored.state.keys.set({ session: { "local-session": null } });
  assert.equal((await restored.state.keys.get("session", ["local-session"]))["local-session"], undefined);
});

test("los eventos repetidos de contactos/lid no duplican el contacto del equipo", async () => {
  const { editor } = await seedTestDatabase();
  await prisma.user.update({ where: { id: editor.id }, data: { phone: "0990000003", whatsappOptIn: true } });
  await Promise.all(Array.from({ length: 8 }, () => identifyContact("local-user@lid", "593990000003@s.whatsapp.net", "Fixture teammate")));
  assert.equal(await prisma.whatsAppContact.count(), 1);
  const resolved = await resolveContact("local-user@lid");
  assert.equal(resolved.pnJid, "593990000003@s.whatsapp.net");
  assert.equal(resolved.userId, editor.id);
});
