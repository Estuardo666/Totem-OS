/**
 * Qué permisos hacen falta y cómo leer lo que Meta dice que otorgó.
 *
 * Puro, sin Prisma ni `fetch`: la verificación de permisos es lo que enciende
 * el aviso rojo de la página de integraciones, y esa lógica debe poder probarse
 * sin red. Quien llama pone el transporte.
 */

import type { AgencyTokenMode } from "./system-user.ts";

/**
 * Permisos que la app solicita y verifica.
 *
 * Fuente única: se usa tanto para construir la URL de autorización como para
 * comprobar qué otorgó el usuario. Si estas dos listas divergen, el banner de
 * permisos miente — por eso vive aquí y no duplicada en cada función.
 *
 * `ads_read` y `business_management` requieren App Review solo para cuentas de
 * terceros; funcionan de inmediato sobre las cuentas propias del usuario que
 * tiene rol en la app.
 */
export const META_SCOPES = [
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "read_insights",
  "instagram_basic",
  "instagram_manage_insights",
  "ads_read",
  "business_management",
] as const;


/**
 * Permisos que no existen para un usuario del sistema.
 *
 * Un usuario del sistema no es una persona: no tiene perfil público que
 * mostrar. Si `public_profile` se quedara en la lista de requeridos, la página
 * de integraciones marcaría "Perfil público" como faltante para siempre, y un
 * aviso que siempre está en rojo deja de significar nada.
 */
const SYSTEM_USER_EXCLUDED_SCOPES = new Set(["public_profile"]);

/** Permisos que esta instalación exige según cómo obtuvo el token. */
export function requiredScopesForMode(mode: AgencyTokenMode): string[] {
  const scopes = [...META_SCOPES];
  if (mode !== "system_user") return scopes;
  return scopes.filter((scope) => !SYSTEM_USER_EXCLUDED_SCOPES.has(scope));
}

/**
 * Cruza lo otorgado contra lo requerido.
 *
 * `granted === null` significa token inválido, no "sin permisos": se responde
 * que falta todo, igual que hacía la versión anterior ante un error.
 */
export function mapGrantedScopes(
  granted: string[] | null,
  required: string[]
): { permissions: Record<string, boolean>; missing: string[] } {
  const grantedSet = new Set(granted ?? []);
  const permissions: Record<string, boolean> = {};
  const missing: string[] = [];

  for (const scope of required) {
    const isGranted = granted !== null && grantedSet.has(scope);
    permissions[scope] = isGranted;
    if (!isGranted) missing.push(scope);
  }

  // Un permiso otorgado que no se pidió no entra en el reporte: ensuciaría la
  // lista con cosas que a nadie le toca arreglar.
  return { permissions, missing };
}

export interface DebugTokenInfo {
  isValid: boolean;
  /** "USER" | "SYSTEM_USER" | "PAGE" */
  type: string;
  appId: string;
  userId: string | null;
  scopes: string[];
  /** `null` cuando el token no vence (Meta manda `expires_at: 0`). */
  expiresAt: Date | null;
  dataAccessExpiresAt: Date | null;
}

interface RawDebugToken {
  data?: {
    app_id?: string | number;
    type?: string;
    is_valid?: boolean;
    user_id?: string | number;
    scopes?: string[];
    granular_scopes?: Array<{ scope?: string }>;
    expires_at?: number;
    data_access_expires_at?: number;
  };
}

/** Meta usa 0 para "no vence" y segundos epoch para todo lo demás. */
function toDate(seconds: number | undefined): Date | null {
  if (typeof seconds !== "number" || seconds <= 0) return null;
  return new Date(seconds * 1000);
}

/**
 * Normaliza la respuesta de `/debug_token`.
 *
 * Une `scopes` con `granular_scopes`: cuando la app usa Inicio de sesión para
 * empresas, el primero llega incompleto y los permisos reales viajan en el
 * segundo. Mirar solo uno de los dos reporta permisos faltantes que sí están.
 */
export function parseDebugTokenResponse(body: unknown): DebugTokenInfo {
  const data = (body as RawDebugToken | null)?.data;

  if (!data) {
    return {
      isValid: false,
      type: "",
      appId: "",
      userId: null,
      scopes: [],
      expiresAt: null,
      dataAccessExpiresAt: null,
    };
  }

  const scopes = new Set<string>();
  for (const scope of data.scopes ?? []) {
    if (typeof scope === "string" && scope) scopes.add(scope);
  }
  for (const granular of data.granular_scopes ?? []) {
    if (typeof granular?.scope === "string" && granular.scope) scopes.add(granular.scope);
  }

  return {
    isValid: data.is_valid === true,
    type: data.type ?? "",
    appId: data.app_id !== undefined ? String(data.app_id) : "",
    userId: data.user_id !== undefined ? String(data.user_id) : null,
    scopes: [...scopes],
    expiresAt: toDate(data.expires_at),
    dataAccessExpiresAt: toDate(data.data_access_expires_at),
  };
}
