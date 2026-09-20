-- Rendimiento por publicación (Instagram y Facebook).
-- Aditivo: no altera ninguna tabla ni índice existente.

CREATE TABLE "ClientMediaMetric" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "productType" TEXT,
    "permalink" TEXT,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "reach" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "views" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "likes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "comments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saves" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shares" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clicks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profileVisits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "follows" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interactions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMediaMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientMediaMetric_clientId_platform_mediaId_key" ON "ClientMediaMetric"("clientId", "platform", "mediaId");

CREATE INDEX "ClientMediaMetric_clientId_publishedAt_idx" ON "ClientMediaMetric"("clientId", "publishedAt");

ALTER TABLE "ClientMediaMetric" ADD CONSTRAINT "ClientMediaMetric_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
