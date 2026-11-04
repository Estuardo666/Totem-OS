import assert from "node:assert/strict";
import test from "node:test";
import {
  checkRouteRateLimit,
  getClientIP,
  rateLimitUnavailableResponse,
} from "../../src/lib/api-rate-limiter.ts";

test("route limiter reports an unavailable store instead of allowing the request", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    // Un identificador vacío falla la validación antes de tocar PostgreSQL;
    // ejercita la misma ruta de error que una base caída.
    const result = await checkRouteRateLimit({ identifier: "", bucket: "assistant-chat", limit: 30, windowMs: 60_000 });
    assert.equal(result, null);
  } finally {
    console.error = originalError;
  }
});

test("unavailable store response fails closed with 503", async () => {
  const response = rateLimitUnavailableResponse();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "5");
  assert.match((await response.json()).error, /límite de solicitudes/);
});

test("client IP prefers the first forwarded address", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "x-real-ip": "10.0.0.2" });
  assert.equal(getClientIP({ headers }), "203.0.113.7");
  assert.equal(getClientIP({ headers: new Headers({ "cf-connecting-ip": "198.51.100.4" }) }), "198.51.100.4");
  assert.equal(getClientIP({ headers: new Headers() }), "unknown");
});
