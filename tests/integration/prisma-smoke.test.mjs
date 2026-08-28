import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { prisma, resetDatabase, seedTestDatabase } from "./prisma-test-db.mjs";

let fixtures;

before(async () => {
  await resetDatabase();
  fixtures = await seedTestDatabase();
});

after(async () => {
  await prisma.$disconnect();
});

test("Prisma reads the deterministic CP02 fixture through PostgreSQL", async () => {
  const task = await prisma.contentTask.findUnique({
    where: { id: fixtures.task.id },
    include: { client: true, assignedEditor: true },
  });

  assert.ok(task);
  assert.equal(task.title, "Tarea de humo CP02");
  assert.equal(task.client.id, fixtures.client.id);
  assert.equal(task.assignedEditor?.id, fixtures.editor.id);
  assert.equal(task.assignedEditor?.roleCode, "EDITOR");
});

test("foreign-key cascade cleanup is available to every test run", async () => {
  await resetDatabase();
  assert.equal(await prisma.contentTask.count(), 0);
  assert.equal(await prisma.client.count(), 0);
  assert.equal(await prisma.user.count(), 0);
});
