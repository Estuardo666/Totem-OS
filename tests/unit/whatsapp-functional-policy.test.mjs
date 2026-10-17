import assert from "node:assert/strict";
import test from "node:test";
import {
  filterFunctionalTestMessages,
  functionalMessageWhere,
  readFunctionalTestScope,
} from "../../worker/whatsapp/functional-test-policy.ts";

const validEnv = {
  WA_FUNCTIONAL_TEST_ONLY: "1",
  WA_TEST_GROUP_ONLY: "0",
  WA_PAIRING_ONLY: "0",
  SRI_ENABLED: "0",
  WA_FUNCTIONAL_TEST_DATABASE: "totem_whatsapp_test",
  DATABASE_URL: "postgresql://test_user:secret@localhost:5432/totem_whatsapp_test?schema=public",
  WA_FUNCTIONAL_TEST_GROUP_JID: "120363000000000000@g.us",
  WA_FUNCTIONAL_TEST_RUN_ID: "run-20261016",
};

test("el opt-in ausente conserva el modo normal", () => {
  assert.equal(readFunctionalTestScope({ ...validEnv, WA_FUNCTIONAL_TEST_ONLY: "0" }), null);
});

test("requiere aislamiento de flags, base exacta y grupo configurado", () => {
  for (const patch of [
    { WA_TEST_GROUP_ONLY: "1" },
    { WA_PAIRING_ONLY: "1" },
    { SRI_ENABLED: "1" },
    { WA_FUNCTIONAL_TEST_DATABASE: "neondb" },
    { WA_FUNCTIONAL_TEST_DATABASE: "totem_prod" },
    { DATABASE_URL: "postgresql://user:pass@db.example/totem_prod" },
    { DATABASE_URL: "not a url" },
    { WA_FUNCTIONAL_TEST_GROUP_JID: undefined },
    { WA_FUNCTIONAL_TEST_GROUP_JID: "593999999999@s.whatsapp.net" },
  ]) {
    assert.throws(() => readFunctionalTestScope({ ...validEnv, ...patch }));
  }
});

test("devuelve scope de ejecución y prefijo deduplicable", () => {
  assert.deepEqual(readFunctionalTestScope(validEnv), {
    groupJid: "120363000000000000@g.us",
    runId: "run-20261016",
    messagePrefix: "functional:run-20261016:",
  });
  assert.throws(() => readFunctionalTestScope({ ...validEnv, WA_FUNCTIONAL_TEST_RUN_ID: "tiny" }));
});

test("solo permite inbound del grupo exacto, incluidos mensajes sin id", () => {
  const scope = readFunctionalTestScope(validEnv);
  const group = { key: { remoteJid: scope.groupJid } };
  const dm = { key: { remoteJid: "593999999999@s.whatsapp.net" } };
  const otherGroup = { key: { remoteJid: "120363999999999999@g.us" } };
  assert.deepEqual(filterFunctionalTestMessages([group, dm, otherGroup], scope), [group]);
});

test("construye el filtro Prisma acotado a grupo, ejecución y tipos manuales", () => {
  const scope = readFunctionalTestScope(validEnv);
  assert.deepEqual(functionalMessageWhere(scope), {
    to: scope.groupJid,
    OR: [
      { kind: "MANUAL", dedupeKey: { startsWith: "functional:run-20261016:" } },
      { kind: "APPROVAL_CONFIRM", dedupeKey: { startsWith: "approval-confirm:functional:run-20261016:" } },
    ],
    kind: { in: ["MANUAL", "APPROVAL_CONFIRM"] },
  });
});
