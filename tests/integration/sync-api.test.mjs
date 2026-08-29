import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { withApiKernel } from "../../src/lib/api-kernel.ts";
import { handleSyncBootstrap, handleSyncPull, handleSyncPush } from "../../src/lib/sync-handler.ts";
import { applySyncMutation, compactSyncHistory, decodeSyncCursor, encodeSyncCursor } from "../../src/lib/sync-service.ts";
import { syncBootstrapResponseSchema, syncPullResponseSchema, syncPushResponseSchema } from "../../src/contracts/api-contracts.ts";
import { prisma, resetDatabase, seedTestDatabase } from "./prisma-test-db.mjs";

let actor;

beforeEach(async () => {
  await resetDatabase();
  const { editor } = await seedTestDatabase();
  actor = { userId: editor.id };
});

after(async () => {
  await prisma.$disconnect();
});

function authenticated(handler, request) {
  return withApiKernel((context) => {
    context.actor = actor;
    return handler(context);
  })(request);
}

function mutation(mutationId, data = { title: "Sync" }) {
  return { mutationId, clientId: "ios-client-1", entityType: "content.task", entityId: "task-1", operation: "create", baseVersion: null, data };
}

test("push HTTP aplica, repite idempotentemente y pull devuelve cursor opaco", async () => {
  const makePush = () => new Request("https://totem.test/api/v1/sync/push", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ mutations: [mutation("http-mutation-1")] }),
  });
  const first = await authenticated(handleSyncPush, makePush());
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(syncPushResponseSchema.safeParse(firstBody).success, true);
  assert.equal(firstBody.data.results[0].duplicate, false);

  const duplicate = await authenticated(handleSyncPush, makePush());
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).data.results[0].duplicate, true);

  const pulled = await authenticated(handleSyncPull, new Request("https://totem.test/api/v1/sync/pull?limit=10"));
  assert.equal(pulled.status, 200);
  const pulledBody = await pulled.json();
  assert.equal(syncPullResponseSchema.safeParse(pulledBody).success, true);
  assert.match(pulledBody.data.nextCursor, /^[A-Za-z0-9_-]+$/u);
  assert.equal(decodeSyncCursor(pulledBody.data.nextCursor), 1n);

  const resumed = await authenticated(handleSyncPull, new Request(`https://totem.test/api/v1/sync/pull?cursor=${encodeURIComponent(pulledBody.data.nextCursor)}`));
  assert.equal((await resumed.json()).data.changes.length, 0);
});

test("push devuelve 409 para una entidad creada con una versión incompatible", async () => {
  await applySyncMutation(actor.userId, mutation("service-mutation-1"));
  const response = await authenticated(handleSyncPush, new Request("https://totem.test/api/v1/sync/push", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ mutations: [mutation("service-mutation-2", { title: "stale" })] }),
  }));
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.code, "CONFLICT");
});

test("bootstrap y compactación conservan el contrato y vencen el cursor antiguo", async () => {
  await applySyncMutation(actor.userId, mutation("compact-mutation-1"));
  const oldDate = new Date("2020-01-01T00:00:00.000Z");
  await prisma.syncChange.updateMany({ data: { createdAt: oldDate } });
  await prisma.syncMutationReceipt.updateMany({ data: { createdAt: oldDate } });
  const compacted = await compactSyncHistory(new Date("2030-01-01T00:00:00.000Z"));
  assert.equal(compacted.changes, 1);
  assert.equal(compacted.receipts, 1);

  const bootstrap = await authenticated(handleSyncBootstrap, new Request("https://totem.test/api/v1/sync/bootstrap"));
  assert.equal(bootstrap.status, 200);
  assert.equal(syncBootstrapResponseSchema.safeParse(await bootstrap.json()).success, true);
  const expired = await authenticated(handleSyncPull, new Request(`https://totem.test/api/v1/sync/pull?cursor=${encodeURIComponent(encodeSyncCursor(0n))}`));
  assert.equal(expired.status, 410);
  assert.equal((await expired.json()).code, "CURSOR_EXPIRED");
});
