export const API_CAPABILITIES = {
  kernelEchoRead: "kernel.echo.read",
  kernelEchoWrite: "kernel.echo.write",
} as const;

export type ApiCapability = (typeof API_CAPABILITIES)[keyof typeof API_CAPABILITIES] | string;
export type CanonicalRole = "ADMIN" | "EDITOR" | "USER";

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
  } | null;
}

const ROLE_CAPABILITIES: Record<CanonicalRole, readonly ApiCapability[]> = {
  // Los permisos se enumeran explícitamente. No se asigna acceso por defecto a
  // roles desconocidos; CP05 ampliará esta tabla por dominio.
  ADMIN: [API_CAPABILITIES.kernelEchoRead, API_CAPABILITIES.kernelEchoWrite],
  EDITOR: [API_CAPABILITIES.kernelEchoRead, API_CAPABILITIES.kernelEchoWrite],
  USER: [API_CAPABILITIES.kernelEchoRead],
};

export function normalizeCanonicalRole(value: unknown): CanonicalRole | null {
  if (typeof value !== "string") return null;
  const role = value.trim().toUpperCase();
  return role === "ADMIN" || role === "EDITOR" || role === "USER" ? role : null;
}

export function apiCapabilitiesForRole(role: CanonicalRole): ReadonlySet<ApiCapability> {
  return new Set(ROLE_CAPABILITIES[role]);
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

  const role = normalizeCanonicalRole(user.roleLegacy ?? user.role);
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
