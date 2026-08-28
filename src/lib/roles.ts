/** Fuente única de roles y capacidades para API, React, Auth.js y Swift. */
export type CanonicalRole = "ADMIN" | "EDITOR" | "USER";

export const API_CAPABILITIES = {
  kernelEchoRead: "kernel.echo.read",
  kernelEchoWrite: "kernel.echo.write",
  dashboardRead: "dashboard.read",
  clientsRead: "clients.read",
  clientsWrite: "clients.write",
  clientsDelete: "clients.delete",
  credentialsRead: "credentials.read",
  contentRead: "content.read",
  contentWrite: "content.write",
  contentDelete: "content.delete",
  shootsRead: "shoots.read",
  shootsWrite: "shoots.write",
  timeSelf: "time.self",
  timeTeam: "time.team",
  notificationsSelf: "notifications.self",
  notificationsBroadcast: "notifications.broadcast",
  voiceSelf: "voice.self",
  metaRead: "meta.read",
  metaWrite: "meta.write",
  financePersonalRead: "finance.personal.read",
  financeOperationalWrite: "finance.operational.write",
  financeStrategicRead: "finance.strategic.read",
  financeIrreversible: "finance.irreversible",
  adminUsers: "admin.users",
  adminSettings: "admin.settings",
  billingManage: "billing.manage",
  aiGenerate: "ai.generate",
} as const;

export type ApiCapability = (typeof API_CAPABILITIES)[keyof typeof API_CAPABILITIES] | string;

const ADMIN_CAPABILITIES: readonly ApiCapability[] = Object.values(API_CAPABILITIES);

const EDITOR_CAPABILITIES: readonly ApiCapability[] = [
  API_CAPABILITIES.kernelEchoRead,
  API_CAPABILITIES.kernelEchoWrite,
  API_CAPABILITIES.dashboardRead,
  API_CAPABILITIES.clientsRead,
  API_CAPABILITIES.clientsWrite,
  API_CAPABILITIES.contentRead,
  API_CAPABILITIES.contentWrite,
  API_CAPABILITIES.shootsRead,
  API_CAPABILITIES.shootsWrite,
  API_CAPABILITIES.timeSelf,
  API_CAPABILITIES.notificationsSelf,
  API_CAPABILITIES.voiceSelf,
  API_CAPABILITIES.metaRead,
  API_CAPABILITIES.metaWrite,
  API_CAPABILITIES.financePersonalRead,
  API_CAPABILITIES.aiGenerate,
];

const USER_CAPABILITIES: readonly ApiCapability[] = [
  API_CAPABILITIES.kernelEchoRead,
  API_CAPABILITIES.dashboardRead,
  API_CAPABILITIES.clientsRead,
  API_CAPABILITIES.contentRead,
  API_CAPABILITIES.shootsRead,
  API_CAPABILITIES.timeSelf,
  API_CAPABILITIES.notificationsSelf,
  API_CAPABILITIES.voiceSelf,
];

export const ROLE_CAPABILITIES: Record<CanonicalRole, readonly ApiCapability[]> = {
  ADMIN: ADMIN_CAPABILITIES,
  EDITOR: EDITOR_CAPABILITIES,
  USER: USER_CAPABILITIES,
};

export function normalizeCanonicalRole(value: unknown): CanonicalRole | null {
  if (typeof value !== "string") return null;
  const role = value.trim().toUpperCase();
  return role === "ADMIN" || role === "EDITOR" || role === "USER" ? role : null;
}

export function resolveRoleCode(input: {
  roleCode?: unknown;
  roleLegacy?: unknown;
  role?: unknown;
} | null | undefined): CanonicalRole | null {
  if (!input) return null;
  return normalizeCanonicalRole(input.roleCode)
    ?? normalizeCanonicalRole(input.roleLegacy)
    ?? normalizeCanonicalRole(input.role);
}

export function roleCapabilities(role: CanonicalRole): ReadonlySet<ApiCapability> {
  return new Set(ROLE_CAPABILITIES[role]);
}

export function hasCapability(role: CanonicalRole, capability: ApiCapability): boolean {
  return roleCapabilities(role).has(capability);
}
