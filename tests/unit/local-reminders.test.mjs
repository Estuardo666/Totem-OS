import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { API_CAPABILITIES, roleCapabilities } from "../../src/lib/roles.ts";

function harness(role, rows = {}) {
  const queries = [];
  const db = Object.fromEntries(["notification", "contentTask", "transaction", "shoot"].map((model) => [model, {
    findMany: async (query) => {
      queries.push({ model, query });
      return model === "contentTask" ? (query.where.status === "PUBLISHED" ? rows.publications ?? [] : [{ title: "Editar video" }]) : model === "notification" && query.where.type === "PUSH_MESSAGE" ? rows.messages ?? [] : rows[model] ?? [];
    },
    count: async () => 4,
  }]));
  const modules = {
    "@/lib/api-actor": { API_CAPABILITIES },
    "@/lib/api-kernel": { apiSuccess: (_context, data) => data },
    "@/lib/api-protection": { withApiProtection: (handler) => handler },
    "@/lib/db": { db },
  };
  const source = fs.readFileSync(new URL("../../src/app/api/v1/local-reminders/route.ts", import.meta.url), "utf8");
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: (name) => { assert.ok(modules[name], name); return modules[name]; }, URL, Date });
  return {
    queries,
    run: (query = "") => exports.GET({ request: new Request("https://example.test/api/v1/local-reminders" + query), actor: {
      userId: "self", role, capabilities: roleCapabilities(role),
    } }),
  };
}

test("personal finance and published tasks remain scoped to their recipient", async () => {
  const h = harness("EDITOR");
  const data = await h.run("?since=2026-01-01T00:00:00Z");
  const finance = h.queries.find((row) => row.model === "transaction").query.where;
  assert.equal(JSON.stringify(finance.OR), JSON.stringify([{ type: "EXPENSE", assignedToId: "self" }, { type: "HONORARIOS", userId: "self" }]));
  const publications = h.queries.find((row) => row.model === "contentTask" && row.query.where.status === "PUBLISHED").query.where;
  assert.equal(publications.OR[0].assignedEditorId, "self");
  assert.match(data.dailySummary, /4 tareas pendientes.*Editar video/);
  assert.equal(h.queries.find((row) => row.model === "notification").query.where.userId, "self");
  assert.equal(h.queries.find((row) => row.model === "shoot").query.where.crew.some.id, "self");
  assert.ok(finance.updatedAt.gt.getTime() >= Date.now() - 7 * 86400_000 - 1000);
});

test("USER cannot query transactions; first synchronization establishes a baseline", async () => {
  const h = harness("USER");
  const data = await h.run();
  assert.equal(h.queries.some((row) => row.model === "transaction"), false);
  const window = h.queries.find((row) => row.model === "notification").query.where.createdAt;
  assert.equal(window.gt.toISOString(), data.cursor);
  assert.equal(window.lte.toISOString(), data.cursor);
});

test("ADMIN receives financial changes and publications with stable deduplication IDs", async () => {
  const date = new Date("2026-10-26T13:00:00Z");
  const h = harness("ADMIN", {
    notification: [{ id: "a", message: "Tarea asignada", createdAt: date }],
    publications: [{ id: "p", title: "Video publicado", publishedAt: date }],
    transaction: [{ id: "t", type: "HONORARIOS", status: "PAID", amount: 75, description: "Edición", updatedAt: date }],
  });
  const data = await h.run("?since=invalid");
  assert.equal(data.notices.length, 3);
  assert.equal(data.notices[0].title, "Nueva tarea asignada");
  assert.equal(data.notices[1].title, "Tarea publicada");
  assert.equal(data.notices[2].title, "Honorarios");
  assert.match(data.notices[2].body, /75\.00.*Pagado/);
  assert.equal(h.queries.find((row) => row.model === "transaction").query.where.OR, undefined);
  assert.equal(data.notices[2].id, "finance-t-2026-10-26T13:00:00.000Z");
});


test("manual iOS messages are user-scoped and include recent tests on first sync", async () => {
  const h = harness("EDITOR", { messages: [{ id: "manual", message: "Prueba\nAviso iPhone" }] });
  const data = await h.run();
  assert.equal(data.notices[0].id, "message-manual");
  assert.equal(data.notices[0].body, "Prueba\nAviso iPhone");
  const query = h.queries.find((row) => row.model === "notification" && row.query.where.type === "PUSH_MESSAGE").query;
  assert.equal(query.where.userId, "self");
  assert.equal(query.where.createdAt.lte - query.where.createdAt.gt, 15 * 60_000);
});
