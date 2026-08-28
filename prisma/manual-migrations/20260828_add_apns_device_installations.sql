CREATE TABLE IF NOT EXISTS "ApnsDeviceInstallation" (
  "id" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "deviceToken" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "appVersion" TEXT NOT NULL,
  "appBuild" TEXT,
  "deviceModel" TEXT,
  "osVersion" TEXT,
  "locale" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "userId" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "invalidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApnsDeviceInstallation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApnsDeviceInstallation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApnsDeviceInstallation_installationId_environment_key"
  ON "ApnsDeviceInstallation"("installationId", "environment");
CREATE UNIQUE INDEX IF NOT EXISTS "ApnsDeviceInstallation_deviceToken_environment_key"
  ON "ApnsDeviceInstallation"("deviceToken", "environment");
CREATE INDEX IF NOT EXISTS "ApnsDeviceInstallation_userId_status_idx"
  ON "ApnsDeviceInstallation"("userId", "status");
CREATE INDEX IF NOT EXISTS "ApnsDeviceInstallation_environment_status_idx"
  ON "ApnsDeviceInstallation"("environment", "status");
