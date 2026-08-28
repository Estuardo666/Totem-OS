import { createHash, timingSafeEqual } from "crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Autoriza el latido solo con `Authorization: Bearer <secret>`. */
export function isWorkerRequestAuthorized(
  authorizationHeader: string | null,
  configuredSecret: string | undefined
): boolean {
  if (!configuredSecret || configuredSecret.length < 32 || !authorizationHeader) {
    return false;
  }

  const prefix = "Bearer ";
  if (!authorizationHeader.startsWith(prefix)) return false;

  const suppliedSecret = authorizationHeader.slice(prefix.length);
  return timingSafeEqual(digest(suppliedSecret), digest(configuredSecret));
}
