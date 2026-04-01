-- Aplicacion segura de la tabla ClientMonthlyClosure en produccion
-- Recomendado: ejecutar primero un backup o point-in-time restore antes de aplicar cambios.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

CREATE TABLE IF NOT EXISTS "ClientMonthlyClosure" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "accrualStatus" TEXT NOT NULL,
  "accruedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "recommendation" TEXT,
  "recommendationReason" TEXT,
  "evidenceSummary" TEXT,
  "notes" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientMonthlyClosure_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientMonthlyClosure_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClientMonthlyClosure_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientMonthlyClosure_clientId_year_month_key"
  ON "ClientMonthlyClosure" ("clientId", "year", "month");

CREATE INDEX IF NOT EXISTS "ClientMonthlyClosure_year_month_idx"
  ON "ClientMonthlyClosure" ("year", "month");

CREATE INDEX IF NOT EXISTS "ClientMonthlyClosure_clientId_idx"
  ON "ClientMonthlyClosure" ("clientId");

CREATE INDEX IF NOT EXISTS "ClientMonthlyClosure_accrualStatus_idx"
  ON "ClientMonthlyClosure" ("accrualStatus");

CREATE INDEX IF NOT EXISTS "ClientMonthlyClosure_approvedById_idx"
  ON "ClientMonthlyClosure" ("approvedById");

COMMIT;

-- Verificaciones sugeridas despues del COMMIT
SELECT to_regclass('public."ClientMonthlyClosure"') AS created_table;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'ClientMonthlyClosure'
ORDER BY indexname;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ClientMonthlyClosure'
ORDER BY ordinal_position;
