import { createHmac } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db.ts";

export interface DistributedRateLimitOptions {
  identifier: string;
  bucket: string;
  limit: number;
  windowMs: number;
  now?: Date;
}

export interface DistributedRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RateLimitStoreError extends Error {
  constructor(message = "Rate limit store unavailable") {
    super(message);
    this.name = "RateLimitStoreError";
  }
}

function identifierHash(bucket: string, identifier: string): string {
  const secret = process.env.RATE_LIMIT_HASH_SECRET
    ?? process.env.AUTH_SECRET
    ?? process.env.NEXTAUTH_SECRET
    ?? "totem-api-rate-limit-development-only";
  return createHmac("sha256", secret).update(`${bucket}:${identifier}`).digest("hex");
}

function assertOptions(options: DistributedRateLimitOptions): void {
  if (!options.bucket || options.bucket.length > 128) {
    throw new RateLimitStoreError("Invalid rate-limit bucket");
  }
  if (!options.identifier || options.identifier.length > 512) {
    throw new RateLimitStoreError("Invalid rate-limit identifier");
  }
  if (!Number.isSafeInteger(options.limit) || options.limit < 1) {
    throw new RateLimitStoreError("Invalid rate-limit limit");
  }
  if (!Number.isSafeInteger(options.windowMs) || options.windowMs < 1000) {
    throw new RateLimitStoreError("Invalid rate-limit window");
  }
}

/**
 * Fixed-window check atómico en PostgreSQL. El contador se incrementa dentro
 * del upsert para que varias instancias de Next no puedan sobrepasar el límite
 * por carreras entre lecturas y escrituras.
 */
export async function checkDistributedRateLimit(
  options: DistributedRateLimitOptions
): Promise<DistributedRateLimitResult> {
  assertOptions(options);
  const now = options.now ?? new Date();
  const windowStartMs = Math.floor(now.getTime() / options.windowMs) * options.windowMs;
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(windowStartMs + options.windowMs);
  const hash = identifierHash(options.bucket, options.identifier);

  try {
    const rows = await db.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`DELETE FROM "api_rate_limit_bucket" WHERE "expiresAt" < ${now}`
      );

      return tx.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        INSERT INTO "api_rate_limit_bucket"
          ("id", "bucket", "identifierHash", "windowStart", "count", "expiresAt", "createdAt", "updatedAt")
        VALUES
          (${globalThis.crypto.randomUUID()}, ${options.bucket}, ${hash}, ${windowStart}, 1, ${expiresAt}, ${now}, ${now})
        ON CONFLICT ("bucket", "identifierHash", "windowStart")
        DO UPDATE SET
          "count" = "api_rate_limit_bucket"."count" + 1,
          "updatedAt" = ${now}
        RETURNING "count"
      `);
    });

    const count = Number(rows[0]?.count ?? 0);
    const allowed = count <= options.limit;
    const retryAfter = allowed
      ? undefined
      : Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));

    return {
      allowed,
      remaining: Math.max(0, options.limit - count),
      resetTime: expiresAt.getTime(),
      ...(retryAfter === undefined ? {} : { retryAfter }),
    };
  } catch (error) {
    if (error instanceof RateLimitStoreError) throw error;
    throw new RateLimitStoreError(error instanceof Error ? error.message : undefined);
  }
}
