import assert from "node:assert/strict";
import { test } from "node:test";
import { routeModeForPath } from "../../src/lib/app-config-service.ts";

test("el router híbrido prioriza la regla más específica", () => {
  const config = {
    version: 1,
    defaultMode: "web",
    routes: [
      { path: "/clients", mode: "native" },
      { path: "/clients/reports", mode: "web" },
    ],
  };

  assert.equal(routeModeForPath(config, "/clients"), "native");
  assert.equal(routeModeForPath(config, "/clients/123"), "native");
  assert.equal(routeModeForPath(config, "/clients/reports"), "web");
  assert.equal(routeModeForPath(config, "/finance"), "web");
});

test("el router híbrido mantiene web para rutas inválidas", () => {
  const config = { version: 1, defaultMode: "web", routes: [] };
  assert.equal(routeModeForPath(config, "https://evil.example"), "web");
  assert.equal(routeModeForPath(config, "/finance/../admin"), "web");
});
