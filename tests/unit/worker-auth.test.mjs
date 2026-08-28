import assert from "node:assert/strict";
import test from "node:test";
import { isWorkerRequestAuthorized } from "../../src/lib/worker-auth.ts";

const secret = "worker-secret-with-at-least-32-characters";

test("acepta exclusivamente el Bearer correcto", () => {
  assert.equal(isWorkerRequestAuthorized(`Bearer ${secret}`, secret), true);
  assert.equal(isWorkerRequestAuthorized(`Bearer incorrecto`, secret), false);
  assert.equal(isWorkerRequestAuthorized(secret, secret), false);
});

test("falla cerrado sin configuracion o con secretos debiles", () => {
  assert.equal(isWorkerRequestAuthorized(`Bearer ${secret}`, undefined), false);
  assert.equal(isWorkerRequestAuthorized("Bearer corto", "corto"), false);
  assert.equal(isWorkerRequestAuthorized(null, secret), false);
});
