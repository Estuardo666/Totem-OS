import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

function harness(role = "ADMIN") {
  const calls = [], exports = {};
  const mocks = {
    "zod": { z }, "@/lib/server-access": {}, "@/lib/system-push": {},
    "@/auth": { auth: async () => ({ user: { id: "self", roleCode: role } }) },
    "@/lib/roles": { resolveRoleCode: (user) => user?.roleCode },
    "@/lib/db": { db: {
      user: { findMany: async (query) => { calls.push(["users", query]); return [{ id: "selected" }]; } },
      notification: { createMany: async (query) => { calls.push(["local", query]); return { count: 1 }; } },
    } },
    "@/lib/web-push": { sendPush: async (_payload, target) => {
      calls.push(["web", target]); return { success: false, sent: 0, failed: 1, cleaned: 0, errors: ["HTTP 403"] };
    } },
  };
  const source = fs.readFileSync(new URL("../../src/actions/push-actions.ts", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: (name) => { assert.ok(mocks[name], name); return mocks[name]; } });
  return { calls, send: (targets) => exports.sendCustomPush({ title: "Prueba", body: "iOS", targets }) };
}

test("manual push stores native notices for the selected recipients even when Web Push fails", async () => {
  const h = harness();
  const result = await h.send({ type: "users", userIds: ["selected"] });
  assert.equal(result.data.localQueued, 1);
  assert.equal(result.data.failed, 1);
  const row = h.calls.find(([type]) => type === "local")[1].data[0];
  assert.equal(row.userId, "selected");
  assert.equal(row.type, "PUSH_MESSAGE");
  assert.equal(row.message, "Prueba\niOS");
  assert.equal(JSON.stringify(h.calls.find(([type]) => type === "web")[1]), JSON.stringify({ userIds: ["selected"] }));
});

test("empty roles and user selections never become an accidental broadcast", async () => {
  for (const targets of [{ type: "role", roles: [] }, { type: "users", userIds: [] }]) {
    const h = harness();
    assert.equal((await h.send(targets)).success, false);
    assert.equal(h.calls.length, 0);
  }
});

test("non-admin cannot send or store a test notification", async () => {
  const h = harness("EDITOR");
  assert.equal((await h.send({ type: "all" })).success, false);
  assert.equal(h.calls.length, 0);
});
