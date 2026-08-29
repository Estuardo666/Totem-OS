import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  apiContractRegistry,
  kernelEchoGetResponseSchema,
  kernelEchoPostResponseSchema,
  shellBootstrapResponseSchema,
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
    ],
  );
});

test("el artefacto OpenAPI 3.1 refleja el registro", () => {
  const openapi = JSON.parse(readFileSync(resolve(root, "contracts", "openapi.json"), "utf8"));
  assert.equal(openapi.openapi, "3.1.0");
  assert.ok(openapi.paths["/api/v1/_kernel/echo"].get);
  assert.ok(openapi.paths["/api/v1/_kernel/echo"].post);
  assert.ok(openapi.paths["/api/v1/shell/bootstrap"].get);
  assert.equal(openapi.paths["/api/v1/_kernel/echo"].get["x-required-capability"], "kernel.echo.read");
  assert.equal(openapi.paths["/api/v1/_kernel/echo"].post["x-required-capability"], "kernel.echo.write");
  assert.ok(openapi.components.schemas.KernelEchoGetResponse);
  assert.ok(openapi.components.schemas.ShellBootstrapResponse);
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
