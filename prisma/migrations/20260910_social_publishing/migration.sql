-- Publicación en redes (Facebook / Instagram).
-- Solo crea tablas nuevas: no toca ni una fila existente.

CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "taskId" TEXT,
    "platform" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "caption" TEXT,
    "mediaUrls" TEXT NOT NULL DEFAULT '[]',
    "linkUrl" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "remotePostId" TEXT,
    "permalink" TEXT,
    "containerId" TEXT,
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialPostMetric" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPostMetric_pkey" PRIMARY KEY ("id")
);

-- Idempotencia: un post remoto no puede quedar registrado dos veces.
-- Los borradores tienen remotePostId NULL y Postgres los considera distintos,
-- así que esto no limita cuántos borradores hay.
CREATE UNIQUE INDEX "SocialPost_platform_remotePostId_key" ON "SocialPost"("platform", "remotePostId");
CREATE INDEX "SocialPost_clientId_status_idx" ON "SocialPost"("clientId", "status");
CREATE INDEX "SocialPost_status_scheduledAt_idx" ON "SocialPost"("status", "scheduledAt");
CREATE INDEX "SocialPost_taskId_idx" ON "SocialPost"("taskId");

CREATE UNIQUE INDEX "SocialPostMetric_postId_metricName_date_key" ON "SocialPostMetric"("postId", "metricName", "date");
CREATE INDEX "SocialPostMetric_postId_date_idx" ON "SocialPostMetric"("postId", "date");

ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ContentTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialPostMetric" ADD CONSTRAINT "SocialPostMetric_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
