import assert from "node:assert/strict";
import test from "node:test";
import {
  API_CAPABILITIES,
  ROLE_CAPABILITIES,
  hasCapability,
  normalizeCanonicalRole,
  resolveRoleCode,
} from "../../src/lib/roles.ts";

test("resuelve roleCode y conserva fallback legacy sin elevar privilegios", () => {
  assert.equal(resolveRoleCode({ roleCode: "EDITOR", roleLegacy: "ADMIN" }), "EDITOR");
  assert.equal(resolveRoleCode({ roleLegacy: "admin" }), "ADMIN");
  assert.equal(resolveRoleCode({ role: "USER" }), "USER");
  assert.equal(resolveRoleCode({ roleLegacy: "VIEWER" }), null);
  assert.equal(normalizeCanonicalRole(" editor "), "EDITOR");
  assert.equal(normalizeCanonicalRole("COMMUNITY"), null);
});

test("la matriz de capacidades es monotónica por rol", () => {
  assert.equal(hasCapability("ADMIN", API_CAPABILITIES.financeIrreversible), true);
  assert.equal(hasCapability("EDITOR", API_CAPABILITIES.financeIrreversible), false);
  assert.equal(hasCapability("EDITOR", API_CAPABILITIES.clientsWrite), true);
  assert.equal(hasCapability("USER", API_CAPABILITIES.clientsWrite), false);
  assert.ok(ROLE_CAPABILITIES.ADMIN.length > ROLE_CAPABILITIES.EDITOR.length);
  assert.ok(ROLE_CAPABILITIES.EDITOR.length > ROLE_CAPABILITIES.USER.length);
});
