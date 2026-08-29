import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const dashboardRoute = readFileSync(resolve(root, "src/app/(dashboard)/page.tsx"), "utf8");

test("la portada web conserva el dashboard completo mientras Swift usa la API nativa", () => {
  assert.match(dashboardRoute, /HomeCommandCenter/);
  assert.match(dashboardRoute, /getTasks\(\)/);
  assert.match(dashboardRoute, /getClients\(\)/);
  assert.match(dashboardRoute, /getFinancialStats\(\)/);
  assert.match(dashboardRoute, /getReceivables\(\)/);
  assert.doesNotMatch(dashboardRoute, /ApiDashboardView/);
});
