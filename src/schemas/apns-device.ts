import { z } from "zod";

const apnsEnvironmentSchema = z.enum(["SANDBOX", "PRODUCTION"]);

export const registerApnsDeviceSchema = z.object({
  installationId: z.string().uuid(),
  deviceToken: z
    .string()
    .trim()
    .min(32)
    .max(512)
    .regex(/^[a-fA-F0-9]+$/, "deviceToken debe ser hexadecimal")
    .transform((value) => value.toLowerCase()),
  environment: apnsEnvironmentSchema,
  bundleId: z.string().trim().min(3).max(255),
  appVersion: z.string().trim().min(1).max(64),
  appBuild: z.string().trim().min(1).max(32).optional(),
  deviceModel: z.string().trim().min(1).max(128).optional(),
  osVersion: z.string().trim().min(1).max(64).optional(),
  locale: z.string().trim().min(2).max(35).optional(),
}).strict();

export const revokeApnsDeviceSchema = z.object({
  installationId: z.string().uuid(),
  environment: apnsEnvironmentSchema,
}).strict();

export type RegisterApnsDeviceInput = z.infer<typeof registerApnsDeviceSchema>;
export type RevokeApnsDeviceInput = z.infer<typeof revokeApnsDeviceSchema>;

export function isAllowedApnsBundleId(
  suppliedBundleId: string,
  configuredBundleId: string | undefined
): boolean {
  return Boolean(configuredBundleId && suppliedBundleId === configuredBundleId);
}
