import {
  API_CAPABILITIES,
  resolveRoleCode,
  roleCapabilities,
  type ApiCapability,
  type CanonicalRole,
} from "./roles.ts";

export { API_CAPABILITIES, normalizeCanonicalRole } from "./roles.ts";
export type { ApiCapability, CanonicalRole } from "./roles.ts";

export interface ApiActor {
  userId: string;
  email: string | null;
  role: CanonicalRole;
  capabilities: ReadonlySet<ApiCapability>;
  sessionExpiresAt: Date | null;
}

export interface ApiSessionLike {
  expires?: string;
  user?: {
    id?: unknown;
    email?: unknown;
    role?: unknown;
    roleLegacy?: unknown;
    roleCode?: unknown;
  } | null;
}

export function apiCapabilitiesForRole(role: CanonicalRole): ReadonlySet<ApiCapability> {
  return roleCapabilities(role);
}

export function hasApiCapability(actor: ApiActor, capability: ApiCapability): boolean {
  return actor.capabilities.has(capability);
}

function sessionExpiry(expires: unknown): Date | null {
  if (typeof expires !== "string") return null;
  const timestamp = Date.parse(expires);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

/** Convierte la sesión de Auth.js sin aplicar fallbacks de privilegio. */
export function apiActorFromSession(session: ApiSessionLike | null | undefined): ApiActor | null {
  const user = session?.user;
  if (!user || typeof user.id !== "string" || user.id.trim().length === 0) return null;

  const role = resolveRoleCode({
    roleCode: user.roleCode,
    roleLegacy: user.roleLegacy,
    role: user.role,
  });
  if (!role) return null;

  const expiresAt = sessionExpiry(session.expires);
  if (expiresAt && expiresAt.getTime() <= Date.now()) return null;

  return {
    userId: user.id,
    email: typeof user.email === "string" ? user.email : null,
    role,
    capabilities: apiCapabilitiesForRole(role),
    sessionExpiresAt: expiresAt,
  };
}
