-- CP10: persistent boundary used to reject cursors older than compacted history.
CREATE TABLE "SyncCursorBoundary" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "oldestSequence" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SyncCursorBoundary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SyncCursorBoundary_ownerId_key" ON "SyncCursorBoundary"("ownerId");
CREATE INDEX "SyncCursorBoundary_oldestSequence_idx" ON "SyncCursorBoundary"("oldestSequence");
