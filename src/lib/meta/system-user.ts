/**
 * Token de usuario del sistema de Business Manager.
 *
 * Un usuario del sistema es una cuenta programática que pertenece al negocio y
 * no a una persona. Su token no vence y no se invalida porque alguien cambie su
 * contraseña o deje la agencia, que es justo lo que hoy hace frágil la conexión
 * de Meta: toda la integración cuelga de la cuenta personal de quien conectó.
 *
 * El interruptor es la presencia de `META_SYSTEM_USER_TOKEN`. Si está, gana
 * sobre la base de datos; si no está, nada cambia. Mismo patrón que
 * `META_CONFIG_ID` en auth-service.ts.
 *
 * Este archivo no importa Prisma ni usa el alias `@/` a propósito: el corredor
 * de pruebas no resuelve ninguno de los dos, y estas reglas deben poder
 * probarse sin levantar una base de datos.
 */

/** Cómo se obtuvo el token que está usando la app. */
export type AgencyTokenMode = "oauth" | "system_user";

/**
 * Token de la agencia, ya descifrado y listo para usar contra Graph.
 *
 * El tipo vive aquí y no en token-store.ts —que es su dueño natural— porque
 * aquel importa Prisma y dejaría este módulo sin poder probarse.
 */
export interface AgencyToken {
  mode: AgencyTokenMode;
  /**
   * En modo OAuth es la clave primaria de `AgencyMetaAccount`.
   * En modo sistema es el literal de abajo, deliberadamente no un cuid, para
   * que cualquier `where: { id }` accidental falle en vez de encontrar una
   * fila vieja y escribir sobre ella.
   */
  id: string;
  facebookUserId: string;
  name: string;
  accessToken: string;
  /** `null` cuando el token no vence. */
  tokenExpiresAt: Date | null;
  scopes: string | null;
  lastRefreshedAt: Date | null;
  refreshFailedAt: Date | null;
}

/** Identificador sintético del token que vive en el entorno. */
export const SYSTEM_USER_ACCOUNT_ID = "system-user";

/** Nombre que se muestra cuando no se configuró uno. */
export const DEFAULT_SYSTEM_USER_NAME = "Usuario del sistema (Business Manager)";

/** True si la app debe usar el token de usuario del sistema. */
export function isMetaSystemUserMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.META_SYSTEM_USER_TOKEN?.trim());
}

/**
 * Construye la cuenta sintética a partir del entorno.
 * Devuelve null si no hay token configurado.
 *
 * `META_SYSTEM_USER_ID` y `META_SYSTEM_USER_NAME` son opcionales y solo
 * cosméticos. No se consulta `GET /me` para averiguarlos: esta función corre
 * una vez por cliente en cada sincronización y sumarle una llamada HTTP a ese
 * camino saldría caro para un dato que solo se pinta en pantalla.
 */
export function buildSystemUserAccount(
  env: NodeJS.ProcessEnv = process.env
): AgencyToken | null {
  const token = env.META_SYSTEM_USER_TOKEN?.trim();
  if (!token) return null;

  return {
    mode: "system_user",
    id: SYSTEM_USER_ACCOUNT_ID,
    facebookUserId: env.META_SYSTEM_USER_ID?.trim() ?? "",
    name: env.META_SYSTEM_USER_NAME?.trim() || DEFAULT_SYSTEM_USER_NAME,
    accessToken: token,
    // No vence. Un centinela lejano sería peor: pasaría por `needsRefresh`
    // sin ruido y la interfaz mostraría una fecha inventada.
    tokenExpiresAt: null,
    // Los permisos reales se consultan con /debug_token al mostrarlos, en vez
    // de guardar una copia que envejece.
    scopes: null,
    // No hay renovación ni estado de reconexión que arrastrar.
    lastRefreshedAt: null,
    refreshFailedAt: null,
  };
}
