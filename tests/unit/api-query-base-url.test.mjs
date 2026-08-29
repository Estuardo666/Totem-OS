import assert from "node:assert/strict";
import test from "node:test";
import { resolveTotemApiBaseUrl } from "../../src/lib/api-query.ts";

test("mantiene una base de API configurada en el mismo origen", () => {
  assert.equal(
    resolveTotemApiBaseUrl("https://totem-os.vercel.app", "https://totem-os.vercel.app"),
    "https://totem-os.vercel.app",
  );
});

test("usa rutas relativas cuando la base configurada es cross-origin", () => {
  assert.equal(
    resolveTotemApiBaseUrl("https://api.totem-os.com", "https://totem-os.vercel.app"),
    "",
  );
});

test("usa rutas relativas cuando no hay configuración pública", () => {
  assert.equal(resolveTotemApiBaseUrl(undefined, "https://totem-os.vercel.app"), "");
});

test("conserva la configuración en contextos sin runtime de navegador", () => {
  assert.equal(resolveTotemApiBaseUrl("https://api.totem-os.com"), "https://api.totem-os.com");
});
