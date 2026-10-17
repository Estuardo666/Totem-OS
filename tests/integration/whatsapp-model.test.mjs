import assert from "node:assert/strict";
import test from "node:test";
import { prisma, resetDatabase, seedTestDatabase } from "./prisma-test-db.mjs";

test("WhatsApp inicia cerrado y sus migraciones preservan clientes y tareas", async () => {
  try {
    await resetDatabase();
    const { admin, client, task } = await seedTestDatabase();
    assert.equal(admin.whatsappOptIn, false);
    assert.equal(admin.phone, null);
    assert.equal(client.paymentReminderTarget, "GROUP");
    const group = await prisma.whatsAppGroup.create({ data: { jid: "local-model@g.us", name: "Pruebas", clientId: client.id } });
    assert.equal(group.enabled, false);
    assert.equal(group.aiMode, "DRAFT");
    assert.equal(group.approvalMode, "DRAFT");
    const request = await prisma.whatsAppApprovalRequest.create({ data: {
      groupJid: group.jid, messageId: "local-video", senderJid: "local-team", taskId: task.id, sentAt: new Date(),
    } });
    await prisma.contentTask.delete({ where: { id: task.id } });
    assert.equal((await prisma.whatsAppApprovalRequest.findUniqueOrThrow({ where: { id: request.id } })).taskId, null);
    await prisma.client.delete({ where: { id: client.id } });
    assert.equal((await prisma.whatsAppGroup.findUniqueOrThrow({ where: { id: group.id } })).clientId, null);
  } finally { await prisma.$disconnect(); }
});

test("PostgreSQL impide duplicar encolados y la toma de una decisión tiene un solo ganador", async () => {
  try {
    await resetDatabase();
    const dedupeKey = "local:concurrent:notification";
    const inserts = await Promise.allSettled(Array.from({ length: 8 }, () => prisma.whatsAppMessage.create({
      data: { to: "593999999999@s.whatsapp.net", body: "Local", kind: "MANUAL", dedupeKey },
    })));
    assert.equal(inserts.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(await prisma.whatsAppMessage.count({ where: { dedupeKey } }), 1);
    await prisma.whatsAppOwnerPrompt.create({ data: { id: "TEST1", type: "ALERT", payload: {}, options: ["Entendido"], expiresAt: new Date(Date.now() + 60000) } });
    const claims = await Promise.all(Array.from({ length: 8 }, () => prisma.whatsAppOwnerPrompt.updateMany({
      where: { id: "TEST1", status: "OPEN", expiresAt: { gt: new Date() } }, data: { status: "ANSWERED", answer: "1" },
    })));
    assert.equal(claims.reduce((sum, result) => sum + result.count, 0), 1);
  } finally { await prisma.$disconnect(); }
});
