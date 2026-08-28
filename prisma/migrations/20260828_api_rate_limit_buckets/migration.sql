-- Durable distributed rate limiting for /api/v1.
CREATE TABLE "api_rate_limit_bucket" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_rate_limit_bucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_rate_limit_bucket_bucket_identifierHash_windowStart_key"
    ON "api_rate_limit_bucket"("bucket", "identifierHash", "windowStart");

CREATE INDEX "api_rate_limit_bucket_expiresAt_idx"
    ON "api_rate_limit_bucket"("expiresAt");
