-- Registro de acciones confirmadas del asistente de IA (auditoría + idempotencia).
-- Aditivo: tabla nueva, no altera datos existentes.
CREATE TABLE "AiActionLog" (
    "id" TEXT NOT NULL,
    "draftHash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "resultId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiActionLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiActionLog_draftHash_key" ON "AiActionLog"("draftHash");
CREATE INDEX "AiActionLog_userId_idx" ON "AiActionLog"("userId");
CREATE INDEX "AiActionLog_createdAt_idx" ON "AiActionLog"("createdAt");
