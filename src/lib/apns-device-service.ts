import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { RegisterApnsDeviceInput } from "@/schemas/apns-device";

const APNS_REGISTRATION_MAX_ATTEMPTS = 3;

function isRetryableRegistrationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && (error.code === "P2002" || error.code === "P2034");
}

export async function registerApnsInstallation(
  userId: string,
  input: RegisterApnsDeviceInput
) {
  for (let attempt = 1; attempt <= APNS_REGISTRATION_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        const installationKey = {
          installationId_environment: {
            installationId: input.installationId,
            environment: input.environment,
          },
        };
        const tokenKey = {
          deviceToken_environment: {
            deviceToken: input.deviceToken,
            environment: input.environment,
          },
        };

        const [byInstallation, byToken] = await Promise.all([
          tx.apnsDeviceInstallation.findUnique({ where: installationKey }),
          tx.apnsDeviceInstallation.findUnique({ where: tokenKey }),
        ]);

        // APNs puede rotar el token y una instalación puede cambiar de usuario.
        // Si ambas claves apuntan a filas distintas, se conserva la fila del token
        // vigente y se retira primero la instalación anterior para evitar colisiones.
        if (byToken && byInstallation && byToken.id !== byInstallation.id) {
          await tx.apnsDeviceInstallation.delete({ where: { id: byInstallation.id } });
        }

        const data = {
          installationId: input.installationId,
          deviceToken: input.deviceToken,
          environment: input.environment,
          bundleId: input.bundleId,
          appVersion: input.appVersion,
          appBuild: input.appBuild,
          deviceModel: input.deviceModel,
          osVersion: input.osVersion,
          locale: input.locale,
          status: "ACTIVE",
          userId,
          lastSeenAt: new Date(),
          invalidatedAt: null,
        };

        if (byToken) {
          return tx.apnsDeviceInstallation.update({ where: { id: byToken.id }, data });
        }

        return tx.apnsDeviceInstallation.upsert({
          where: installationKey,
          update: data,
          create: data,
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt === APNS_REGISTRATION_MAX_ATTEMPTS || !isRetryableRegistrationConflict(error)) {
        throw error;
      }
    }
  }

  throw new Error("No se pudo registrar la instalacion APNs");
}

export async function revokeApnsInstallation(
  userId: string,
  installationId: string,
  environment: "SANDBOX" | "PRODUCTION"
) {
  return db.apnsDeviceInstallation.updateMany({
    where: { userId, installationId, environment, status: "ACTIVE" },
    data: { status: "REVOKED", invalidatedAt: new Date() },
  });
}

/** Usar al recibir 410/Unregistered o BadDeviceToken desde APNs. */
export async function markApnsTokenInvalid(
  deviceToken: string,
  environment: "SANDBOX" | "PRODUCTION"
) {
  return db.apnsDeviceInstallation.updateMany({
    where: { deviceToken, environment },
    data: { status: "INVALID", invalidatedAt: new Date() },
  });
}
