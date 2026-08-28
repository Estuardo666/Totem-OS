import assert from "node:assert/strict";
import test from "node:test";
import { handleKernelEcho } from "../../src/lib/api-kernel-demo.ts";
import {
  API_MAX_PAYLOAD_BYTES,
  withApiKernel,
} from "../../src/lib/api-kernel.ts";

const endpoint = withApiKernel(handleKernelEcho);
const endpointUrl = "http://localhost/api/v1/_kernel/echo";

async function json(response) {
  return response.json();
}

test("GET devuelve envelope data/meta, request ID y página por cursor", async () => {
  const response = await endpoint(new Request(endpointUrl));
  const body = await json(response);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.match(response.headers.get("x-request-id"), /^[A-Za-z0-9._:-]+$/);
  assert.equal(body.data.length, 25);
  assert.equal(body.data[0].id, "kernel-item-01");
  assert.equal(body.meta.pagination.limit, 25);
  assert.equal(body.meta.pagination.hasMore, true);
  assert.ok(body.meta.pagination.nextCursor);
  assert.equal(body.meta.requestId, response.headers.get("x-request-id"));
});

test("GET continúa desde un cursor y respeta limit máximo", async () => {
  const first = await endpoint(new Request(endpointUrl));
  const firstBody = await json(first);
  const cursor = firstBody.meta.pagination.nextCursor;

  const response = await endpoint(
    new Request(`${endpointUrl}?cursor=${encodeURIComponent(cursor)}&limit=100`)
  );
  const body = await json(response);

  assert.equal(response.status, 200);
  assert.equal(body.data.length, 35);
  assert.equal(body.data[0].id, "kernel-item-26");
  assert.equal(body.meta.pagination.limit, 100);
  assert.equal(body.meta.pagination.hasMore, false);
  assert.equal(body.meta.pagination.nextCursor, null);
});

test("cursor y limit inválidos producen Problem Details", async () => {
  const response = await endpoint(new Request(`${endpointUrl}?cursor=bad&limit=101`));
  const body = await json(response);

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("content-type"), "application/problem+json");
  assert.equal(body.code, "INVALID_PAGINATION");
  assert.equal(body.status, 400);
  assert.equal(body.requestId, response.headers.get("x-request-id"));
});

test("un cursor con formato inválido se rechaza como Problem Details", async () => {
  const response = await endpoint(new Request(`${endpointUrl}?cursor=bad&limit=25`));
  const body = await json(response);

  assert.equal(response.status, 400);
  assert.equal(body.code, "INVALID_CURSOR");
  assert.equal(body.type, "https://totem-os.com/problems/invalid-cursor");
});

test("POST valida Zod y devuelve errores tipados", async () => {
  const response = await endpoint(new Request(endpointUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "   " }),
  }));
  const body = await json(response);

  assert.equal(response.status, 400);
  assert.equal(body.code, "VALIDATION_ERROR");
  assert.equal(body.errors[0].path[0], "message");
});

test("POST rechaza JSON inválido y payload sobre el límite", async () => {
  const invalidJson = await endpoint(new Request(endpointUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not-json",
  }));
  assert.equal(invalidJson.status, 400);
  assert.equal((await json(invalidJson)).code, "INVALID_JSON");

  const oversized = await endpoint(new Request(endpointUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(API_MAX_PAYLOAD_BYTES + 1),
    },
    body: JSON.stringify({ message: "small" }),
  }));
  assert.equal(oversized.status, 413);
  assert.equal((await json(oversized)).code, "PAYLOAD_TOO_LARGE");
});

test("request ID inválido no se refleja en la respuesta", async () => {
  const response = await endpoint(new Request(endpointUrl, {
    headers: { "x-request-id": "bad id" },
  }));

  assert.notEqual(response.headers.get("x-request-id"), "bad id");
  assert.match(response.headers.get("x-request-id"), /^[A-Za-z0-9._:-]+$/);
});

test("métodos no soportados usan Problem Details y 405", async () => {
  const response = await endpoint(new Request(endpointUrl, { method: "PUT" }));
  const body = await json(response);

  assert.equal(response.status, 405);
  assert.equal(body.code, "METHOD_NOT_ALLOWED");
  assert.equal(body.detail, "Allowed methods: GET, POST.");
});
