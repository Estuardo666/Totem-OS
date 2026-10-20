import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../../src/lib/calendar-to-shoot-sync.ts", import.meta.url), "utf8");

function loadSync(failImport) {
  const checkpoints = [];
  const testModule = { exports: {} };
  const mocks = {
    "@/lib/db": { db: {
      googleCalendarToken: {
        findUnique: async () => ({ lastSyncToken: "previous" }),
        update: async (args) => checkpoints.push(args),
      },
      shoot: {
        findFirst: async () => null,
        create: async () => { if (failImport) throw new Error("database unavailable"); },
      },
    } },
    "@/lib/google-calendar": { GoogleCalendarService: {
      listEvents: async () => ({ events: [{
        id: "event-1", summary: "Rodaje", status: "confirmed",
        start: { dateTime: "2026-10-20T10:00:00-05:00" },
        end: { dateTime: "2026-10-20T11:00:00-05:00" },
      }], nextSyncToken: "next" }),
    } },
    "@/lib/client-matcher": { matchClientFromCalendarEvent: async () => ({ clientId: "client" }) },
    "@/actions/notification-actions": { notifyAdminsWithPush: async () => {} },
  };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(compiled, {
    module: testModule, exports: testModule.exports, require: (id) => mocks[id] ?? require(id), Date,
  });
  return { sync: testModule.exports.syncCalendarEventsToShoots, checkpoints };
}

test("failed imports preserve the previous cursor so Google events are retried", async () => {
  const { sync, checkpoints } = loadSync(true);
  const result = await sync("user");
  assert.equal(result.errors.length, 1);
  assert.equal(checkpoints.length, 0);
});

test("successful imports advance the cursor", async () => {
  const { sync, checkpoints } = loadSync(false);
  const result = await sync("user");
  assert.equal(result.created, 1);
  assert.equal(result.errors.length, 0);
  assert.equal(checkpoints[0].data.lastSyncToken, "next");
});

function loadRoute(path, mocks) {
  const testModule = { exports: {} };
  const code = readFileSync(new URL(`../../src/app/api/google-calendar/${path}/route.ts`, import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module: testModule, exports: testModule.exports,
    require: (id) => mocks[id] ?? require(id),
    console: { log() {}, error() {}, warn() {} }, Date,
    process: { env: { GOOGLE_CALENDAR_WEBHOOK_SECRET: "test-secret" } },
  });
  return testModule.exports;
}

for (const scenario of ["unauthenticated", "disconnected", "success", "partial-failure"]) {
  test(`manual sync: ${scenario}`, async () => {
    const calls = [];
    const { POST } = loadRoute("sync", {
      "@/auth": { auth: async () => scenario === "unauthenticated" ? null : { user: { id: "session-owner" } } },
      "@/lib/google-calendar": { GoogleCalendarService: { isConnected: async () => scenario !== "disconnected" } },
      "@/lib/calendar-to-shoot-sync": { fullCalendarSync: async (userId) => {
        calls.push(userId);
        return { created: 2, updated: 0, cancelled: 0, errors: scenario === "partial-failure" ? ["private event error"] : [] };
      } },
      "next/cache": { revalidatePath: () => {} },
    });
    const response = await POST();
    assert.equal(response.status, { unauthenticated: 401, disconnected: 409, success: 200, "partial-failure": 502 }[scenario]);
    assert.deepEqual(calls, ["success", "partial-failure"].includes(scenario) ? ["session-owner"] : []);
    assert.doesNotMatch(await response.text(), /private event error/);
  });
}

test("webhook waits for persistence and requests retry when import fails", async () => {
  let finishSync;
  const pendingSync = new Promise((resolve) => { finishSync = resolve; });
  const { POST } = loadRoute("webhook", {
    "@/lib/db": { db: { googleCalendarToken: { findFirst: async () => ({ userId: "owner" }) } } },
    "@/lib/calendar-to-shoot-sync": { syncCalendarEventsToShoots: () => pendingSync },
  });
  let returned = false;
  const responsePromise = POST({ headers: new Headers({
    "x-goog-channel-id": "channel", "x-goog-resource-state": "exists", "x-goog-channel-token": "test-secret",
  }) }).then((response) => { returned = true; return response; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(returned, false);
  finishSync({ errors: ["retry"] });
  assert.equal((await responsePromise).status, 503);
});
