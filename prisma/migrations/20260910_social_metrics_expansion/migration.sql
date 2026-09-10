-- Expansión de métricas sociales: Instagram, Meta Ads (multi-cuenta), TikTok
-- y ciclo de vida de tokens. Todo es aditivo: ninguna columna ni índice
-- existente se altera, así que las filas FACEBOOK actuales quedan intactas.

-- Ciclo de vida del token de Meta
ALTER TABLE "AgencyMetaAccount" ADD COLUMN     "scopes" TEXT,
ADD COLUMN     "lastRefreshedAt" TIMESTAMP(3),
ADD COLUMN     "refreshFailedAt" TIMESTAMP(3);

-- Vinculación de TikTok en el cliente
ALTER TABLE "Client" ADD COLUMN     "tiktokOpenId" TEXT,
ADD COLUMN     "tiktokUsername" TEXT;

-- CreateTable
CREATE TABLE "AgencyTikTokAccount" (
    "id" TEXT NOT NULL,
    "openId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT NOT NULL,
    "lastRefreshedAt" TIMESTAMP(3),
    "refreshFailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyTikTokAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAdAccount" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'META_ADS',
    "adAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAdMetric" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reach" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clicks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frequency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "objective" TEXT,
    "actionsJson" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientAdMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgencyTikTokAccount_openId_key" ON "AgencyTikTokAccount"("openId");

-- CreateIndex
CREATE INDEX "ClientAdAccount_clientId_idx" ON "ClientAdAccount"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAdAccount_clientId_platform_adAccountId_key" ON "ClientAdAccount"("clientId", "platform", "adAccountId");

-- CreateIndex
CREATE INDEX "ClientAdMetric_clientId_date_idx" ON "ClientAdMetric"("clientId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAdMetric_clientId_platform_adAccountId_campaignId_dat_key" ON "ClientAdMetric"("clientId", "platform", "adAccountId", "campaignId", "date");

-- AddForeignKey
ALTER TABLE "ClientAdAccount" ADD CONSTRAINT "ClientAdAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAdMetric" ADD CONSTRAINT "ClientAdMetric_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrar la cuenta publicitaria legacy (Client.adAccountId) a la nueva tabla.
-- Client.adAccountId se conserva como deprecado, no se borra.
INSERT INTO "ClientAdAccount" ("id", "clientId", "platform", "adAccountId", "name", "currency", "isActive", "createdAt", "updatedAt")
SELECT
    md5(random()::text || clock_timestamp()::text),
    c."id",
    'META_ADS',
    c."adAccountId",
    COALESCE(c."name", 'Cuenta publicitaria'),
    'USD',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Client" c
WHERE c."adAccountId" IS NOT NULL AND c."adAccountId" <> ''
ON CONFLICT ("clientId", "platform", "adAccountId") DO NOTHING;
