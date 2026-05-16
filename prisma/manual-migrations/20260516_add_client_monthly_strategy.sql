CREATE TABLE IF NOT EXISTS "ClientMonthlyStrategy" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "prepared" BOOLEAN NOT NULL DEFAULT FALSE,
  "sentAt" TIMESTAMP(3),
  "approved" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientMonthlyStrategy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientMonthlyStrategy_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientMonthlyStrategy_clientId_month_year_key"
ON "ClientMonthlyStrategy" ("clientId", "month", "year");

CREATE INDEX IF NOT EXISTS "ClientMonthlyStrategy_clientId_idx"
ON "ClientMonthlyStrategy" ("clientId");

CREATE INDEX IF NOT EXISTS "ClientMonthlyStrategy_month_year_idx"
ON "ClientMonthlyStrategy" ("month", "year");