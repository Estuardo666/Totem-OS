import assert from "node:assert/strict";
import test from "node:test";
import {
  canReadStrategicClientAnalytics,
  getCurrentEcuadorMonthRange,
  getStrategicClientScope,
} from "../../src/lib/finance-strategic-access.ts";

test("deniega alcance de clientes a sesiones anónimas o roles desconocidos", () => {
  assert.equal(getStrategicClientScope(undefined, undefined), null);
  assert.equal(getStrategicClientScope("user-1", "CLIENT"), null);
  assert.equal(canReadStrategicClientAnalytics(undefined, "ADMIN"), false);
  assert.equal(canReadStrategicClientAnalytics("user-1", "EDITOR"), false);
});

test("limita EDITOR a sus clientes y permite el catálogo básico a ADMIN", () => {
  assert.deepEqual(getStrategicClientScope("editor-1", "EDITOR"), {
    editorId: "editor-1",
  });
  assert.deepEqual(getStrategicClientScope("admin-1", "ADMIN"), {});
  assert.equal(canReadStrategicClientAnalytics("admin-1", "ADMIN"), true);
});

test("mantiene julio en Ecuador hasta las 05:00 UTC del primero de agosto", () => {
  const beforeMidnight = getCurrentEcuadorMonthRange(
    new Date("2026-08-01T04:59:59.999Z")
  );
  assert.equal(beforeMidnight.start.toISOString(), "2026-07-01T05:00:00.000Z");
  assert.equal(beforeMidnight.end.toISOString(), "2026-08-01T05:00:00.000Z");

  const atMidnight = getCurrentEcuadorMonthRange(
    new Date("2026-08-01T05:00:00.000Z")
  );
  assert.equal(atMidnight.start.toISOString(), "2026-08-01T05:00:00.000Z");
  assert.equal(atMidnight.end.toISOString(), "2026-09-01T05:00:00.000Z");
});
