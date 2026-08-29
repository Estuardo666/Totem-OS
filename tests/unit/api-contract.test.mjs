import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  apiContractRegistry,
  kernelEchoGetResponseSchema,
  kernelEchoPostResponseSchema,
  shellBootstrapResponseSchema,
  appConfigResponseSchema,
  dashboardResponseSchema,
} from "../../src/contracts/api-contracts.ts";
import { TotemApiClient } from "../../src/generated/api-client.ts";

const root = resolve(import.meta.dirname, "../..");

function readFixture(name) {
  return JSON.parse(readFileSync(resolve(root, "contracts", "fixtures", name), "utf8"));
}

test("los fixtures compartidos cumplen los DTOs Zod registrados", () => {
  assert.equal(kernelEchoGetResponseSchema.safeParse(readFixture("kernel-echo-get.json")).success, true);
  assert.equal(kernelEchoPostResponseSchema.safeParse(readFixture("kernel-echo-post.json")).success, true);
  assert.equal(shellBootstrapResponseSchema.safeParse(readFixture("shell-bootstrap.json")).success, true);
  assert.equal(appConfigResponseSchema.safeParse(readFixture("app-config.json")).success, true);
});

test("el registro contiene operaciones y capacidades explícitas", () => {
  assert.deepEqual(
    apiContractRegistry.map(({ method, path, operationId, requiredCapability }) => ({ method, path, operationId, requiredCapability })),
    [
      {
        method: "get",
        path: "/api/v1/_kernel/echo",
        operationId: "kernelEchoList",
        requiredCapability: "kernel.echo.read",
      },
      {
        method: "post",
        path: "/api/v1/_kernel/echo",
        operationId: "kernelEcho",
        requiredCapability: "kernel.echo.write",
      },
      {
        method: "get",
        path: "/api/v1/shell/bootstrap",
        operationId: "shellBootstrap",
        requiredCapability: "dashboard.read",
      },
      {
        method: "get",
        path: "/api/v1/app-config",
        operationId: "appConfig",
        requiredCapability: "dashboard.read",
      },
      {
        method: "get",
        path: "/api/v1/sync/pull",
        operationId: "syncPull",
        requiredCapability: "dashboard.read",
      },
      {
        method: "post",
        path: "/api/v1/sync/push",
        operationId: "syncPush",
        requiredCapability: "dashboard.read",
      },
      {
        method: "get",
        path: "/api/v1/sync/bootstrap",
        operationId: "syncBootstrap",
        requiredCapability: "dashboard.read",
      },
      {
        method: "get",
        path: "/api/v1/dashboard",
        operationId: "dashboard",
        requiredCapability: "dashboard.read",
      },
    ],
  );
});

test("el artefacto OpenAPI 3.1 refleja el registro", () => {
  const openapi = JSON.parse(readFileSync(resolve(root, "contracts", "openapi.json"), "utf8"));
  assert.equal(openapi.openapi, "3.1.0");
  assert.ok(openapi.paths["/api/v1/_kernel/echo"].get);
  assert.ok(openapi.paths["/api/v1/_kernel/echo"].post);
  assert.ok(openapi.paths["/api/v1/shell/bootstrap"].get);
  assert.ok(openapi.paths["/api/v1/app-config"].get);
  assert.equal(openapi.paths["/api/v1/_kernel/echo"].get["x-required-capability"], "kernel.echo.read");
  assert.equal(openapi.paths["/api/v1/_kernel/echo"].post["x-required-capability"], "kernel.echo.write");
  assert.ok(openapi.components.schemas.KernelEchoGetResponse);
  assert.ok(openapi.components.schemas.ShellBootstrapResponse);
  assert.ok(openapi.components.schemas.AppConfigResponse);
  assert.ok(openapi.paths["/api/v1/dashboard"].get);
  assert.ok(openapi.components.schemas.DashboardResponse);
  assert.ok(openapi.components.securitySchemes.csrfToken);
});

test("el cliente TypeScript generado decodifica el fixture GET", async () => {
  const fixture = readFixture("kernel-echo-get.json");
  let requestedUrl = "";
  const client = new TotemApiClient({
    baseUrl: "https://api.example.test",
    fetchImpl: async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const response = await client.kernelEchoList({ limit: 25 });
  assert.equal(response.data[0].id, "kernel-item-01");
  assert.equal(response.meta.pagination.nextCursor, "eyJ2ZXJzaW9uIjoxLCJvZmZzZXQiOjI1fQ");
  assert.equal(requestedUrl, "https://api.example.test/api/v1/_kernel/echo?limit=25");
});

test("el cliente TypeScript generado decodifica el bootstrap del shell", async () => {
  const fixture = readFixture("shell-bootstrap.json");
  let requestedUrl = "";
  const client = new TotemApiClient({
    baseUrl: "https://api.example.test",
    fetchImpl: async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const response = await client.shellBootstrap();
  assert.equal(response.data.user.role, "EDITOR");
  assert.equal(response.data.counters.pendingTasks, 3);
  assert.equal(requestedUrl, "https://api.example.test/api/v1/shell/bootstrap");
});

test("el cliente TypeScript generado solicita el dashboard compartido", async () => {
  let requestedUrl = "";
  const client = new TotemApiClient({
    baseUrl: "https://api.example.test",
    fetchImpl: async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({
        data: {
          generatedAt: "2026-08-28T00:00:00.000Z",
          user: { id: "u1", name: "Ada Lovelace", role: "EDITOR", specialty: null },
          summary: { activeClients: 0, assignedTasks: 0, overdueEditingTasks: 0, overduePublicationTasks: 0, publishedThisMonth: 0, pendingApprovals: 0, scheduledToday: 0, priorityTasks: 0, totalIncome: null, totalReceivable: null },
          pipeline: [], agenda: [], priorityTasks: [], approvals: [], workloads: [], recentTransactions: [],
        },
        meta: { requestId: "dashboard-test" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const response = await client.dashboard();
  assert.equal(response.data.user.name, "Ada Lovelace");
  assert.equal(requestedUrl, "https://api.example.test/api/v1/dashboard");
  assert.equal(dashboardResponseSchema.safeParse(response).success, true);
});

test("el cliente enlaza fetch nativo cuando se invoca como método", async () => {
  const originalFetch = globalThis.fetch;
  let receiver;

  globalThis.fetch = async function (input) {
    receiver = this;
    return new Response(JSON.stringify({
      data: {
        generatedAt: "2026-08-28T00:00:00.000Z",
        user: { id: "u1", name: "Ada Lovelace", role: "EDITOR", specialty: null },
        summary: { activeClients: 0, assignedTasks: 0, overdueEditingTasks: 0, overduePublicationTasks: 0, publishedThisMonth: 0, pendingApprovals: 0, scheduledToday: 0, priorityTasks: 0, totalIncome: null, totalReceivable: null },
        pipeline: [], agenda: [], priorityTasks: [], approvals: [], workloads: [], recentTransactions: [],
      },
      meta: { requestId: "bound-fetch-test" },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const client = new TotemApiClient({ baseUrl: "https://api.example.test" });
    await client.dashboard();
    assert.equal(receiver, globalThis);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
