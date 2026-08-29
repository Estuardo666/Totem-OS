import assert from "node:assert/strict";
import test from "node:test";
import { TotemApiError } from "../../src/generated/api-client.ts";
import { isAuthenticationError, isConflictError, toApiErrorViewModel } from "../../src/lib/api-errors.ts";
import { queryKeys } from "../../src/lib/api-query.ts";

test("centraliza query keys estables para sync", () => {
  assert.deepEqual(queryKeys.sync.pull(undefined), ["sync", "pull", "head"]);
  assert.deepEqual(queryKeys.sync.pull("cursor-1"), ["sync", "pull", "cursor-1"]);
});

test("mapea Problem Details sin perder requestId ni retryAfter semantics", () => {
  const error = new TotemApiError(429, {
    type: "https://totem.invalid/problems/rate-limited",
    title: "Too Many Requests",
    status: 429,
    detail: "Espera antes de reintentar",
    instance: "/api/v1/sync/push",
    code: "RATE_LIMITED",
    requestId: "req-123",
    retryAfter: 3,
  });
  const view = toApiErrorViewModel(error);
  assert.equal(view.code, "RATE_LIMITED");
  assert.equal(view.requestId, "req-123");
  assert.equal(view.retryable, true);
});

test("identifica autenticación y conflictos para que la UI decida", () => {
  assert.equal(isAuthenticationError(new TotemApiError(401, null)), true);
  assert.equal(isConflictError(new TotemApiError(409, null)), true);
  assert.equal(isConflictError(new TotemApiError(500, null)), false);
});
