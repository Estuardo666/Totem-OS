-- CP09: generic sync materialization, append-only change feed and idempotency receipts.
CREATE TABLE "SyncEntity" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "payload" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SyncEntity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SyncEntity_ownerId_entityType_entityId_key"
    ON "SyncEntity"("ownerId", "entityType", "entityId");
CREATE INDEX "SyncEntity_ownerId_updatedAt_id_idx"
    ON "SyncEntity"("ownerId", "updatedAt", "id");
CREATE INDEX "SyncEntity_ownerId_entityType_updatedAt_idx"
    ON "SyncEntity"("ownerId", "entityType", "updatedAt");
CREATE INDEX "SyncEntity_ownerId_deletedAt_idx"
    ON "SyncEntity"("ownerId", "deletedAt");

CREATE TABLE "SyncChange" (
    "id" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "ownerId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncChange_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SyncChange_sequence_key" ON "SyncChange"("sequence");
CREATE UNIQUE INDEX "SyncChange_ownerId_entityType_entityId_version_key"
    ON "SyncChange"("ownerId", "entityType", "entityId", "version");
CREATE INDEX "SyncChange_ownerId_sequence_idx" ON "SyncChange"("ownerId", "sequence");
CREATE INDEX "SyncChange_ownerId_createdAt_id_idx" ON "SyncChange"("ownerId", "createdAt", "id");
CREATE INDEX "SyncChange_ownerId_entityType_sequence_idx" ON "SyncChange"("ownerId", "entityType", "sequence");

CREATE TABLE "SyncMutationReceipt" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "mutationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "resultVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncMutationReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SyncMutationReceipt_ownerId_clientId_mutationId_key"
    ON "SyncMutationReceipt"("ownerId", "clientId", "mutationId");
CREATE INDEX "SyncMutationReceipt_ownerId_createdAt_idx"
    ON "SyncMutationReceipt"("ownerId", "createdAt");
CREATE INDEX "SyncMutationReceipt_ownerId_entityType_entityId_idx"
    ON "SyncMutationReceipt"("ownerId", "entityType", "entityId");
