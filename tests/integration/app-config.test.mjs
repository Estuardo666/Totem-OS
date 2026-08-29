import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { apiCapabilitiesForRole } from "../../src/lib/api-actor.ts";
import { APP_CONFIG_KEY, loadAppConfig, routeModeForPath } from "../../src/lib/app-config-service.ts";
import { prisma, resetDatabase, seedTestDatabase } from "./prisma-test-db.mjs";

beforeEach(async () => {
  await resetDatabase();
});

after(async () => {
  await prisma.$disconnect();
});

test("la configuración global y el rollback por usuario se resuelven en PostgreSQL", async () => {
  const { editor } = await seedTestDatabase();
  await prisma.globalConfig.create({
    data: {
      key: APP_CONFIG_KEY,
      value: JSON.stringify({
        version: 1,
        defaultMode: "web",
        routes: [
          { path: "/clients", mode: "native" },
          { path: "/content", mode: "native" },
        ],
      }),
    },
  });
  await prisma.userRouteOverride.create({
    data: { userId: editor.id, path: "/clients", mode: "web" },
  });

  const config = await loadAppConfig({ userId: editor.id });
  assert.equal(routeModeForPath(config, "/clients"), "web");
  assert.equal(routeModeForPath(config, "/content/tasks"), "native");
  assert.equal(config.defaultMode, "web");
  assert.ok(apiCapabilitiesForRole("EDITOR").has("dashboard.read"));
});
