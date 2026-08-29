import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { apiCapabilitiesForRole } from "../../src/lib/api-actor.ts";
import { dashboardDataSchema } from "../../src/contracts/api-contracts.ts";
import { loadDashboard } from "../../src/lib/dashboard-service.ts";
import { prisma, resetDatabase, seedTestDatabase } from "./prisma-test-db.mjs";

beforeEach(async () => {
  await resetDatabase();
});

after(async () => {
  await prisma.$disconnect();
});

test("PostgreSQL construye el dashboard compacto respetando el alcance del editor", async () => {
  const { editor } = await seedTestDatabase();
  const data = await loadDashboard({
    userId: editor.id,
    email: editor.email,
    role: "EDITOR",
    capabilities: apiCapabilitiesForRole("EDITOR"),
    sessionExpiresAt: null,
  });

  assert.equal(dashboardDataSchema.safeParse(data).success, true);
  assert.equal(data.user.role, "EDITOR");
  assert.equal(data.summary.activeClients, 1);
  assert.equal(data.summary.assignedTasks, 1);
  assert.equal(data.pipeline.find((stage) => stage.key === "IDEA")?.count, 1);
  assert.equal(data.workloads[0]?.pendingTasksCount, 0);
  assert.equal(data.recentTransactions.length, 0);
});

test("el dashboard normaliza descripciones de transacciones vacías", async () => {
  const { admin } = await seedTestDatabase();
  await prisma.transaction.create({
    data: { amount: 100, type: "INCOME", status: "PAID", description: "" },
  });

  const data = await loadDashboard({
    userId: admin.id,
    email: admin.email,
    role: "ADMIN",
    capabilities: apiCapabilitiesForRole("ADMIN"),
    sessionExpiresAt: null,
  });

  assert.equal(dashboardDataSchema.safeParse(data).success, true);
  assert.equal(data.recentTransactions[0]?.description, "Transacción");
});
