import type { PrismaClient } from "@prisma/client";

const LOCK_ID = "default";
const STALE_AFTER_MS = 120_000;
type LockDelegate = Pick<PrismaClient["whatsAppLock"], "updateMany" | "createMany">;

/** Isolated so lock ownership and expiry can be exercised without a live database. */
export function createWhatsAppLockStore(delegate: LockDelegate, staleAfterMs = STALE_AFTER_MS) {
  return {
    async acquire(holder: string, now = new Date()): Promise<boolean> {
      if (!holder.trim()) return false;
      const staleBefore = new Date(now.getTime() - staleAfterMs);
      const claimed = await delegate.updateMany({
        where: { id: LOCK_ID, OR: [{ holder }, { heartbeat: { lt: staleBefore } }] },
        data: { holder, heartbeat: now },
      });
      if (claimed.count > 0) return true;
      // skipDuplicates keeps the unique-row race quiet while only one contender wins.
      const created = await delegate.createMany({ data: [{ id: LOCK_ID, holder, heartbeat: now }], skipDuplicates: true });
      return created.count === 1;
    },
    async refresh(holder: string, now = new Date()): Promise<boolean> {
      const result = await delegate.updateMany({ where: { id: LOCK_ID, holder }, data: { heartbeat: now } });
      return result.count === 1;
    },
    async release(holder: string): Promise<void> {
      // Keep the row for audit and let another process claim it as stale.
      await delegate.updateMany({ where: { id: LOCK_ID, holder }, data: { heartbeat: new Date(0) } });
    },
  };
}
