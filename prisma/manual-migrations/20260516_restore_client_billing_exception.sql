CREATE TABLE IF NOT EXISTS "ClientBillingException" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "overrideAmount" DOUBLE PRECISION,
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientBillingException_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientBillingException_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientBillingException_clientId_year_month_key"
ON "ClientBillingException" ("clientId", "year", "month");

CREATE INDEX IF NOT EXISTS "ClientBillingException_clientId_idx"
ON "ClientBillingException" ("clientId");

CREATE INDEX IF NOT EXISTS "ClientBillingException_year_month_idx"
ON "ClientBillingException" ("year", "month");

CREATE INDEX IF NOT EXISTS "ClientBillingException_type_idx"
ON "ClientBillingException" ("type");