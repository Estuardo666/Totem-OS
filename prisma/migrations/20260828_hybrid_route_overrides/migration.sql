-- CP08: per-user rollback switches for native/web route selection.
CREATE TABLE "UserRouteOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRouteOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserRouteOverride_userId_path_key"
    ON "UserRouteOverride"("userId", "path");
CREATE INDEX "UserRouteOverride_userId_idx"
    ON "UserRouteOverride"("userId");
CREATE INDEX "UserRouteOverride_path_idx"
    ON "UserRouteOverride"("path");

ALTER TABLE "UserRouteOverride"
    ADD CONSTRAINT "UserRouteOverride_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
