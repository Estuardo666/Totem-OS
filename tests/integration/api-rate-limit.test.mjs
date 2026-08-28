import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { checkDistributedRateLimit } from "../../src/lib/api-rate-limiter.ts";
import { prisma, resetDatabase } from "./prisma-test-db.mjs";

const windowMs = 60_000;
const now = new Date("2030-01-01T00:00:00.000Z");

before(async () => {
  await resetDatabase();
});

after(async () => {
  await prisma.$disconnect();
});

test("rate limit distribuido incrementa atómicamente y reinicia por ventana", async () => {
  const options = {
    identifier: "cp04-integration-user",
    bucket: "cp04.integration",
    limit: 2,
    windowMs,
    now,
  };

  const first = await checkDistributedRateLimit(options);
  const second = await checkDistributedRateLimit(options);
  const third = await checkDistributedRateLimit(options);

  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
  assert.ok(third.retryAfter);

  const nextWindow = await checkDistributedRateLimit({
    ...options,
    now: new Date(now.getTime() + windowMs),
  });
  assert.equal(nextWindow.allowed, true);

  const rows = await prisma.apiRateLimitBucket.findMany({
    where: { bucket: options.bucket },
  });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.count).sort((a, b) => a - b), [1, 3]);
});
