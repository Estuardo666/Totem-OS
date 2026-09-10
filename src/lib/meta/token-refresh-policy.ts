/**
 * Política de renovación de tokens: decisiones puras, sin base de datos.
 *
 * Vive aparte de token-refresh.ts porque esa capa importa Prisma, y estas
 * reglas deben poder probarse sin levantar una conexión.
 */

/** Días de margen antes del vencimiento para renovar. */
export const REFRESH_THRESHOLD_DAYS = 14;

/** Duración asumida cuando Meta omite `expires_in` en la respuesta. */
export const DEFAULT_TTL_SECONDS = 60 * 86400;

/**
 * Indica si un token debe renovarse ya.
 *
 * La comparación es `<=` para que el umbral exacto cuente como vencido:
 * renovar un día antes es preferible a renovar un día tarde.
 */
export function needsRefresh(
  expiresAt: Date,
  thresholdDays: number = REFRESH_THRESHOLD_DAYS,
  now: Date = new Date()
): boolean {
  const remainingMs = expiresAt.getTime() - now.getTime();
  return remainingMs <= thresholdDays * 86400 * 1000;
}

/**
 * Calcula la fecha de expiración a partir de la respuesta de Meta.
 * Un `expires_in` ausente o no numérico cae a 60 días en vez de producir una
 * fecha inválida que dispararía renovaciones en bucle.
 */
export function resolveExpiryDate(
  expiresIn: unknown,
  now: Date = new Date()
): Date {
  const seconds = Number(expiresIn);
  const ttl = Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_TTL_SECONDS;
  return new Date(now.getTime() + ttl * 1000);
}
