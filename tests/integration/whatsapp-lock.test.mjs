import assert from "node:assert/strict";
import { after, test } from "node:test";

import { createWhatsAppLockStore } from "../../worker/whatsapp/lock-store.ts";
import { prisma, resetDatabase } from "./prisma-test-db.mjs";

after(() => prisma.$disconnect());

test("PostgreSQL concede el lock a un solo contender y recupera un holder vencido", async () => {
  await resetDatabase();
  const first = createWhatsAppLockStore(prisma.whatsAppLock);
  const second = createWhatsAppLockStore(prisma.whatsAppLock);
  const now = new Date("2026-10-16T12:00:00.000Z");
  const holders = ["hostinger:instance-a", "render:instance-b"];

  const claims = await Promise.all(holders.map((holder, index) =>
    (index === 0 ? first : second).acquire(holder, now)
  ));

  assert.equal(claims.filter(Boolean).length, 1);
  const winnerIndex = claims[0] ? 0 : 1;
  const loserIndex = 1 - winnerIndex;
  const winner = winnerIndex === 0 ? first : second;
  const loser = loserIndex === 0 ? first : second;
  const winningHolder = holders[winnerIndex];
  const losingHolder = holders[loserIndex];

  assert.equal(await loser.refresh(losingHolder, new Date(now.getTime() + 30_000)), false);
  assert.equal(await winner.refresh(winningHolder, new Date(now.getTime() + 30_000)), true);
  assert.equal(await loser.acquire(losingHolder, new Date(now.getTime() + 151_000)), true);

  const row = await prisma.whatsAppLock.findUniqueOrThrow({ where: { id: "default" } });
  assert.equal(row.holder, losingHolder);
});
