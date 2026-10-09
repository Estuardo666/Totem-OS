/**
 * Errores de los callbacks OAuth que vuelven a /admin/settings/integrations.
 *
 * El callback redirige con un código (`?error=invalid_state`), nunca con texto
 * libre: si la página mostrara lo que llega en la URL, cualquiera podría armar
 * un enlace al dominio con un mensaje falso ("tu cuenta fue suspendida,
 * escribe a…"). Un código desconocido cae en el mensaje genérico.
 */

export const INTEGRATION_ERRORS = {
  unauthorized: "No tienes permisos para conectar esta integración.",
  provider_denied: "La autorización fue cancelada o rechazada en la plataforma.",
  missing_code: "La plataforma no devolvió un código de autorización.",
  invalid_state: "La sesión de autorización expiró o no es válida. Intenta de nuevo.",
  token_exchange_failed: "No se pudo obtener el token de acceso. Intenta de nuevo.",
  user_info_failed: "No se pudo leer la información de la cuenta conectada.",
  save_failed: "No se pudo guardar la conexión.",
  unexpected: "Ocurrió un error inesperado al conectar la integración.",
} as const;

export type IntegrationErrorCode = keyof typeof INTEGRATION_ERRORS;

export function integrationErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return Object.hasOwn(INTEGRATION_ERRORS, code)
    ? INTEGRATION_ERRORS[code as IntegrationErrorCode]
    : INTEGRATION_ERRORS.unexpected;
}
