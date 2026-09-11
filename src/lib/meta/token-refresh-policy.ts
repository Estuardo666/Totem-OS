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

/** Qué hacer con el token de la agencia en esta corrida. */
export type RefreshDecision =
  | { action: "exchange" }
  | { action: "skip"; reason: string }
  | { action: "pages_only"; reason: string };

/**
 * Decide si toca renovar, no hacer nada, o solo refrescar tokens de página.
 *
 * Un token de usuario del sistema no vence y no se renueva: pasarlo por
 * `fb_exchange_token` no devuelve otro token de sistema, así que el intercambio
 * se salta siempre, incluso con `force`. Lo que sí hay que seguir haciendo es
 * volver a pedir los tokens de página, porque es la vía por la que se emiten
 * desde el usuario del sistema y por la que aparecen los activos recién
 * asignados en Business Manager.
 */
export function decideAgencyRefresh(input: {
  mode: "oauth" | "system_user";
  expiresAt: Date | null;
  force?: boolean;
  thresholdDays?: number;
  now?: Date;
}): RefreshDecision {
  if (input.mode === "system_user") {
    return {
      action: "pages_only",
      reason:
        "Token de usuario del sistema: no vence, solo se refrescan los tokens de página.",
    };
  }

  // Defensivo: en modo OAuth siempre hay fecha. Si faltara, no inventar una
  // renovación sobre un dato que no existe.
  if (!input.expiresAt) {
    return { action: "skip", reason: "El token no tiene fecha de vencimiento registrada." };
  }

  if (input.force) return { action: "exchange" };

  if (!needsRefresh(input.expiresAt, input.thresholdDays, input.now)) {
    return { action: "skip", reason: "El token todavía no necesita renovarse." };
  }

  return { action: "exchange" };
}
