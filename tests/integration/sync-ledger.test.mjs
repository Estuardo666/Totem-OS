import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { applySyncMutation, bootstrapSync, pullSyncChanges, SyncConflictError } from "../../src/lib/sync-service.ts";
import { prisma, resetDatabase, seedTestDatabase } from "./prisma-test-db.mjs";

beforeEach(async () => {
  await resetDatabase();
});

after(async () => {
  await prisma.$disconnect();
});

test("una mutación registra entidad, cambio y receipt exactamente una vez", async () => {
  const { editor } = await seedTestDatabase();
  const input = {
    mutationId: "cp09-mutation-1",
    clientId: "cp09-client-1",
    entityType: "content.task",
    entityId: "task-1",
    operation: "create",
    baseVersion: null,
    data: { title: "Offline" },
  };

  const first = await applySyncMutation(editor.id, input);
  const duplicate = await applySyncMutation(editor.id, input);
  assert.equal(first.version, 1);
  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(await prisma.syncEntity.count(), 1);
  assert.equal(await prisma.syncChange.count(), 1);
  assert.equal(await prisma.syncMutationReceipt.count(), 1);
});

test("la versión base evita sobrescrituras y delete deja tombstone", async () => {
  const { editor } = await seedTestDatabase();
  const base = {
    mutationId: "cp09-mutation-2",
    clientId: "cp09-client-1",
    entityType: "client.note",
    entityId: "note-1",
    operation: "create",
    baseVersion: null,
    data: { body: "v1" },
  };
  await applySyncMutation(editor.id, base);
  await assert.rejects(
    () => applySyncMutation(editor.id, { ...base, mutationId: "cp09-mutation-3", data: { body: "stale" } }),
    SyncConflictError,
  );
  const deleted = await applySyncMutation(editor.id, {
    ...base, mutationId: "cp09-mutation-4", operation: "delete", baseVersion: 1, data: null,
  });
  assert.equal(deleted.deleted, true);
  const entity = await prisma.syncEntity.findFirst({ where: { entityId: "note-1" } });
  assert.equal(entity?.version, 2);
  assert.ok(entity?.deletedAt);
});

test("pull y bootstrap exponen cambios y cursor", async () => {
  const { editor } = await seedTestDatabase();
  await applySyncMutation(editor.id, {
    mutationId: "cp09-mutation-5", clientId: "cp09-client-1", entityType: "settings",
    entityId: "one", operation: "create", baseVersion: null, data: { enabled: true },
  });
  const page = await pullSyncChanges(editor.id, 0n, 100);
  assert.equal(page.changes.length, 1);
  assert.equal(page.nextSequence, page.changes[0].sequence);
  const boot = await bootstrapSync(editor.id);
  assert.equal(boot.entities.length, 1);
  assert.equal(boot.latestSequence, page.nextSequence);
});
