import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { apiCapabilitiesForRole } from "../../src/lib/api-actor.ts";
import { loadShellBootstrap } from "../../src/lib/shell-bootstrap-service.ts";
import { shellBootstrapDataSchema } from "../../src/contracts/api-contracts.ts";
import { prisma, resetDatabase, seedTestDatabase } from "./prisma-test-db.mjs";

beforeEach(async () => {
  await resetDatabase();
});

after(async () => {
  await prisma.$disconnect();
});

test("PostgreSQL construye el bootstrap nativo desde sesión, permisos y contadores", async () => {
  const { admin, editor, task } = await seedTestDatabase();
  await prisma.contentTask.update({
    where: { id: task.id },
    data: { status: "EDITING" },
  });
  await prisma.notification.create({
    data: {
      id: "cp07-notification",
      userId: editor.id,
      message: "Tarea lista para revisar",
      type: "STATUS_CHANGE",
      createdBy: admin.id,
    },
  });
  await prisma.globalConfig.create({
    data: {
      id: "cp07-brand",
      key: "brand_settings",
      value: JSON.stringify({ logoLight: "/logo-light.png" }),
    },
  });

  const data = await loadShellBootstrap({
    userId: editor.id,
    email: editor.email,
    role: "EDITOR",
    capabilities: apiCapabilitiesForRole("EDITOR"),
    sessionExpiresAt: null,
  });

  assert.equal(shellBootstrapDataSchema.safeParse(data).success, true);
  assert.equal(data.user.role, "EDITOR");
  assert.equal(data.counters.pendingTasks, 1);
  assert.equal(data.counters.unreadNotifications, 1);
  assert.equal(data.notifications[0].authorName, admin.name);
  assert.equal(data.brand.logoLight, "/logo-light.png");
  assert.ok(data.capabilities.includes("content.write"));
  assert.ok(!data.capabilities.includes("admin.users"));
});
