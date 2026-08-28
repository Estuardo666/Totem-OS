import assert from "node:assert/strict";
import test from "node:test";
import { API_CAPABILITIES, apiActorFromSession } from "../../src/lib/api-actor.ts";
import { API_CSRF_COOKIE, API_CSRF_HEADER } from "../../src/lib/api-csrf.ts";
import { withApiProtection } from "../../src/lib/api-protection.ts";
import { handleKernelEcho } from "../../src/lib/api-kernel-demo.ts";

const endpointUrl = "http://localhost/api/v1/_kernel/echo";

function actor(role, userId = `cp04-${role.toLowerCase()}`) {
  return apiActorFromSession({
    user: {
      id: userId,
      email: `${userId}@totem.test`,
      roleLegacy: role,
      role,
    },
  });
}

async function json(response) {
  return response.json();
}

test("ApiActor normaliza roles y deniega valores desconocidos sin fallback", () => {
  assert.equal(actor("admin").role, "ADMIN");
  assert.ok(actor("EDITOR").capabilities.has(API_CAPABILITIES.kernelEchoWrite));
  assert.ok(!actor("USER").capabilities.has(API_CAPABILITIES.kernelEchoWrite));
  assert.equal(actor("CLIENT"), null);
  assert.equal(apiActorFromSession({
    expires: new Date(Date.now() - 60_000).toISOString(),
    user: { id: "expired", roleLegacy: "ADMIN" },
  }), null);
});

test("guard responde 401 sin sesión y distingue sesión expirada", async () => {
  const endpoint = withApiProtection(handleKernelEcho, {
    requiredCapability: API_CAPABILITIES.kernelEchoRead,
    resolveActor: async () => null,
  });

  const unauthenticated = await endpoint(new Request(endpointUrl));
  assert.equal(unauthenticated.status, 401);
  assert.equal((await json(unauthenticated)).code, "UNAUTHENTICATED");

  const expired = await endpoint(new Request(endpointUrl, {
    headers: { cookie: "authjs.session-token=expired-token" },
  }));
  assert.equal(expired.status, 401);
  assert.equal((await json(expired)).code, "SESSION_EXPIRED");
});

test("guard es default-deny por capacidad", async () => {
  const endpoint = withApiProtection(handleKernelEcho, {
    requiredCapability: API_CAPABILITIES.kernelEchoWrite,
    resolveActor: async () => actor("USER"),
  });

  const response = await endpoint(new Request(endpointUrl, { method: "POST" }));
  assert.equal(response.status, 403);
  assert.equal((await json(response)).code, "FORBIDDEN");
});

test("CSRF usa doble envío de cookie y header en mutaciones", async () => {
  const endpoint = withApiProtection(handleKernelEcho, {
    requiredCapability: API_CAPABILITIES.kernelEchoWrite,
    resolveActor: async () => actor("EDITOR"),
    csrf: true,
  });

  const missing = await endpoint(new Request(endpointUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "hola" }),
  }));
  assert.equal(missing.status, 403);
  assert.equal((await json(missing)).code, "CSRF_FAILED");

  const token = "csrf-test-token";
  const valid = await endpoint(new Request(endpointUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${API_CSRF_COOKIE}=${token}`,
      [API_CSRF_HEADER]: token,
    },
    body: JSON.stringify({ message: "hola" }),
  }));
  assert.equal(valid.status, 200);
  assert.equal((await json(valid)).data.echo, "hola");
});

test("GET autenticado emite cookie CSRF para la siguiente mutación", async () => {
  const endpoint = withApiProtection(handleKernelEcho, {
    requiredCapability: API_CAPABILITIES.kernelEchoRead,
    csrf: true,
    resolveActor: async () => actor("EDITOR"),
  });

  const response = await endpoint(new Request(endpointUrl));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /totem\.csrf-token=/);
});

test("rate limit devuelve 429, Retry-After y metadata de límite", async () => {
  let received;
  const endpoint = withApiProtection(handleKernelEcho, {
    requiredCapability: API_CAPABILITIES.kernelEchoRead,
    resolveActor: async () => actor("EDITOR", "cp04-rate-user"),
    rateLimit: {
      bucket: "test",
      limit: 2,
      windowMs: 60_000,
      check: async (options) => {
        received = options;
        return { allowed: false, remaining: 0, resetTime: Date.now() + 7_000, retryAfter: 7 };
      },
    },
  });

  const response = await endpoint(new Request(endpointUrl));
  const body = await json(response);
  assert.equal(response.status, 429);
  assert.equal(body.code, "RATE_LIMITED");
  assert.equal(body.retryAfter, 7);
  assert.equal(response.headers.get("retry-after"), "7");
  assert.equal(response.headers.get("x-ratelimit-limit"), "2");
  assert.equal(received.identifier, "cp04-rate-user");
});

test("falla cerrado si el almacén distribuido de rate limit no está disponible", async () => {
  const endpoint = withApiProtection(handleKernelEcho, {
    requiredCapability: API_CAPABILITIES.kernelEchoRead,
    resolveActor: async () => actor("EDITOR"),
    rateLimit: {
      bucket: "test",
      limit: 2,
      windowMs: 60_000,
      check: async () => {
        const { RateLimitStoreError } = await import("../../src/lib/api-rate-limiter.ts");
        throw new RateLimitStoreError();
      },
    },
  });

  const response = await endpoint(new Request(endpointUrl));
  assert.equal(response.status, 503);
  assert.equal((await json(response)).code, "RATE_LIMIT_STORE_UNAVAILABLE");
});
