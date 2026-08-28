/**
 * Contrato del puente `totemShell` entre la app nativa `TotemOS-iOS` y la web.
 *
 * Este módulo es puro: no toca `window` ni React, de modo que el proveedor
 * cliente y las pruebas unitarias comparten exactamente las mismas reglas de
 * validación que replica `TotemOSKit/ShellContracts.swift`.
 */

import { resolveRoleCode } from "./roles.ts";

export const TOTEM_SHELL_BRIDGE_NAME = "totemShell";
export const TOTEM_SHELL_CONTRACT_VERSION = 1;
export const TOTEM_SHELL_MARKER_ATTRIBUTE = "data-totem-native-shell";
export const TOTEM_SHELL_MARKER_FLAG = "__TOTEM_NATIVE_SHELL__";
export const TOTEM_SHELL_USER_AGENT_MARKER = "TotemOS-iOS";

export const MAX_SHELL_NOTIFICATIONS = 5;
export const MAX_SHELL_LABEL_LENGTH = 64;
export const MAX_SHELL_MESSAGE_LENGTH = 280;
export const MAX_SHELL_BADGE_COUNT = 999;

export type ShellRole = "ADMIN" | "EDITOR" | "USER";
export type ShellThemeVariant = "light" | "dark";
export type ShellTransactionTab = "expense" | "income" | "honorarios";

export interface ShellNavItem {
  id: string;
  route: string;
  label: string;
  /** Nombre de SF Symbol que el shell nativo debe dibujar. */
  icon: string;
  children?: ShellNavItem[];
}

export interface ShellTabItem {
  id: string;
  route: string;
  label: string;
  icon: string;
}

export interface ShellNotification {
  id: string;
  message: string;
  /** ISO-8601 en UTC. */
  createdAt: string;
  authorName: string | null;
  avatarUrl: string | null;
  read: boolean;
}

export interface ShellUser {
  name: string;
  role: ShellRole;
  roleLabel: string;
  avatarUrl: string | null;
  initials: string;
}

export interface ShellSnapshot {
  version: number;
  route: string;
  theme: ShellThemeVariant;
  /** Color primario efectivo del tema del usuario, en #RRGGBB. */
  accentColor: string;
  user: ShellUser | null;
  logoLight: string | null;
  logoDark: string | null;
  navigation: ShellNavItem[];
  tabs: ShellTabItem[];
  taskCount: number;
  unreadNotificationCount: number;
  notifications: ShellNotification[];
  /** `true` mientras la web muestra un modal a pantalla completa. */
  overlayHidden: boolean;
}

export type ShellCommand =
  | { type: "navigate"; route: string }
  | { type: "toggleTheme" }
  | { type: "setTheme"; variant: ShellThemeVariant }
  | { type: "markNotificationRead"; notificationId: string }
  | { type: "openNotifications" }
  | { type: "openSettings" }
  | { type: "openIntegrations" }
  | { type: "openTransaction"; tab: ShellTransactionTab }
  | { type: "signOut" };

export const SHELL_SETTINGS_ROUTE = "/admin/settings";
export const SHELL_INTEGRATIONS_ROUTE = "/admin/settings/integrations";
export const SHELL_NOTIFICATIONS_ROUTE = "/admin/notifications";

/** Rutas siempre alcanzables por comando, aunque no estén en el menú filtrado. */
const ALWAYS_ALLOWED_ROUTES = [
  "/",
  SHELL_SETTINGS_ROUTE,
  SHELL_INTEGRATIONS_ROUTE,
  SHELL_NOTIFICATIONS_ROUTE,
] as const;

const ROUTE_PATTERN = /^\/(?:[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*)?$/;
const NOTIFICATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isShellRole(value: unknown): value is ShellRole {
  return value === "ADMIN" || value === "EDITOR" || value === "USER";
}

export function isShellThemeVariant(value: unknown): value is ShellThemeVariant {
  return value === "light" || value === "dark";
}

/** Solo rutas internas: nada de `//host`, `http:` ni `..`. */
export function isValidShellRoute(value: unknown): value is string {
  return (
    typeof value === "string"
    && value.length <= 256
    && !value.startsWith("//")
    && !value.includes("..")
    && ROUTE_PATTERN.test(value)
  );
}

export const SHELL_ROLE_LABELS: Record<ShellRole, string> = {
  ADMIN: "Administrador",
  EDITOR: "Editor",
  USER: "Usuario",
};

interface ShellNavDefinition extends Omit<ShellNavItem, "children"> {
  adminOnly?: boolean;
  children?: ShellNavDefinition[];
}

/**
 * Espejo del menú de `components/shared/sidebar.tsx` con iconos SF Symbol.
 * Chronos permanece oculto igual que en la web.
 */
const SHELL_NAV_DEFINITIONS: ShellNavDefinition[] = [
  { id: "home", route: "/", label: "Inicio", icon: "house" },
  { id: "clients", route: "/clients", label: "Clientes", icon: "person.2" },
  {
    id: "content",
    route: "/content/dashboard",
    label: "Content Factory",
    icon: "film",
    children: [
      { id: "content-dashboard", route: "/content/dashboard", label: "Dashboard", icon: "square.grid.2x2" },
      { id: "content-tasks", route: "/content", label: "Tareas", icon: "checklist" },
      { id: "content-shoots", route: "/content/shoots", label: "Rodajes", icon: "video" },
    ],
  },
  {
    id: "finance",
    route: "/finance",
    label: "Finanzas",
    icon: "wallet.bifold",
    children: [
      { id: "finance-dashboard", route: "/finance", label: "Dashboard", icon: "chart.pie", adminOnly: true },
      { id: "finance-monthly", route: "/finance/monthly-summary", label: "Resumen del Mes", icon: "calendar", adminOnly: true },
      { id: "finance-personal", route: "/finance/personal", label: "Dashboard personal", icon: "person.crop.circle" },
      { id: "finance-transactions", route: "/finance/transactions", label: "Transacciones", icon: "list.bullet.rectangle" },
      { id: "finance-alerts", route: "/finance/alerts", label: "Alertas", icon: "bell.badge", adminOnly: true },
      { id: "finance-settlement", route: "/finance/settlement", label: "Liquidación Interna", icon: "arrow.left.arrow.right", adminOnly: true },
      { id: "finance-utilities", route: "/finance/utilidades", label: "Utilidades acumuladas", icon: "chart.line.uptrend.xyaxis", adminOnly: true },
      { id: "finance-invoicing", route: "/admin/facturacion", label: "Facturación Electrónica", icon: "doc.text", adminOnly: true },
    ],
  },
  { id: "admin-users", route: "/admin/users", label: "Gestión de Usuarios", icon: "person.3", adminOnly: true },
  { id: "admin-files", route: "/admin/files", label: "Gestión de Archivos", icon: "folder", adminOnly: true },
];

/** Barra inferior: Inicio, Tareas, acción central, Finanzas, Clientes. */
export const SHELL_TAB_ITEMS: ShellTabItem[] = [
  { id: "tab-home", route: "/", label: "Inicio", icon: "house" },
  { id: "tab-tasks", route: "/content", label: "Tareas", icon: "checklist" },
  { id: "tab-finance", route: "/finance/personal", label: "Finanzas", icon: "wallet.bifold" },
  { id: "tab-clients", route: "/clients", label: "Clientes", icon: "person.2" },
];

export function filterShellNavigation(role: ShellRole | null): ShellNavItem[] {
  const isAdmin = role === "ADMIN";

  const keep = (item: ShellNavDefinition) => !item.adminOnly || isAdmin;
  const strip = ({ id, route, label, icon, children }: ShellNavDefinition): ShellNavItem => {
    const visibleChildren = (children ?? []).filter(keep).map(strip);
    return visibleChildren.length > 0
      ? { id, route, label, icon, children: visibleChildren }
      : { id, route, label, icon };
  };

  return SHELL_NAV_DEFINITIONS.filter(keep).map(strip);
}

/**
 * La pestaña de finanzas apunta al dashboard estratégico solo para ADMIN;
 * el resto sigue viendo su dashboard personal.
 */
export function buildShellTabs(role: ShellRole | null): ShellTabItem[] {
  return SHELL_TAB_ITEMS.map((tab) =>
    tab.id === "tab-finance" && role === "ADMIN"
      ? { ...tab, route: "/finance" }
      : tab
  );
}

function collectRoutes(items: ShellNavItem[], into: Set<string>): void {
  for (const item of items) {
    into.add(item.route);
    if (item.children) collectRoutes(item.children, into);
  }
}

export function allowedShellRoutes(snapshot: ShellSnapshot): Set<string> {
  const routes = new Set<string>(ALWAYS_ALLOWED_ROUTES);
  collectRoutes(snapshot.navigation, routes);
  for (const tab of snapshot.tabs) routes.add(tab.route);
  return routes;
}

function clampCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.floor(value), MAX_SHELL_BADGE_COUNT);
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function sanitizeAssetUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
  if (value.startsWith("//")) return null;
  if (value.startsWith("/")) return value;
  return value.startsWith("https://") ? value : null;
}

export function shellInitials(name: string): string {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return initials || "U";
}

export interface ShellSnapshotInput {
  route: string;
  theme: ShellThemeVariant;
  accentColor?: string | null;
  user: {
    name?: string | null;
    roleCode?: string | null;
    roleLegacy?: string | null;
    role?: string | null;
    image?: string | null;
  } | null;
  logoLight?: string | null;
  logoDark?: string | null;
  taskCount?: number;
  unreadNotificationCount?: number;
  notifications?: Array<{
    id: string;
    message: string;
    createdAt: Date | string;
    read?: boolean;
    authorName?: string | null;
    avatarUrl?: string | null;
  }>;
  overlayHidden?: boolean;
}

/** Construye el snapshot ya saneado y filtrado por permisos. */
export function buildShellSnapshot(input: ShellSnapshotInput): ShellSnapshot {
  const roleCode = resolveRoleCode(input.user);
  const role = isShellRole(roleCode) ? roleCode : null;
  const name = input.user?.name?.trim() || "Usuario";

  const notifications = (input.notifications ?? [])
    .filter((item) => typeof item?.id === "string" && NOTIFICATION_ID_PATTERN.test(item.id))
    .slice(0, MAX_SHELL_NOTIFICATIONS)
    .map<ShellNotification>((item) => ({
      id: item.id,
      message: truncate(String(item.message ?? ""), MAX_SHELL_MESSAGE_LENGTH),
      createdAt: new Date(item.createdAt).toISOString(),
      authorName: item.authorName
        ? truncate(item.authorName, MAX_SHELL_LABEL_LENGTH)
        : null,
      avatarUrl: sanitizeAssetUrl(item.avatarUrl),
      read: Boolean(item.read),
    }));

  return {
    version: TOTEM_SHELL_CONTRACT_VERSION,
    route: isValidShellRoute(input.route) ? input.route : "/",
    theme: isShellThemeVariant(input.theme) ? input.theme : "light",
    accentColor: sanitizeAccentColor(input.accentColor),
    user: input.user
      ? {
        name: truncate(name, MAX_SHELL_LABEL_LENGTH),
        role: role ?? "USER",
        roleLabel: SHELL_ROLE_LABELS[role ?? "USER"],
        avatarUrl: sanitizeAssetUrl(input.user.image),
        initials: shellInitials(name),
      }
      : null,
    logoLight: sanitizeAssetUrl(input.logoLight),
    logoDark: sanitizeAssetUrl(input.logoDark),
    navigation: filterShellNavigation(role),
    tabs: buildShellTabs(role),
    taskCount: clampCount(Number(input.taskCount ?? 0)),
    unreadNotificationCount: clampCount(Number(input.unreadNotificationCount ?? 0)),
    notifications,
    overlayHidden: Boolean(input.overlayHidden),
  };
}

/**
 * Valida un comando recibido desde Swift. Devuelve `null` ante cualquier
 * payload desconocido, mal formado o con una ruta fuera del menú permitido.
 */
export function parseShellCommand(
  rawValue: unknown,
  snapshot: ShellSnapshot,
): ShellCommand | null {
  const value: unknown = typeof rawValue === "string" ? safeParse(rawValue) : rawValue;
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  switch (candidate.type) {
    case "navigate": {
      if (!isValidShellRoute(candidate.route)) return null;
      if (!allowedShellRoutes(snapshot).has(candidate.route)) return null;
      return { type: "navigate", route: candidate.route };
    }
    case "toggleTheme":
      return { type: "toggleTheme" };
    case "setTheme":
      return isShellThemeVariant(candidate.variant)
        ? { type: "setTheme", variant: candidate.variant }
        : null;
    case "markNotificationRead": {
      const id = candidate.notificationId;
      if (typeof id !== "string" || !NOTIFICATION_ID_PATTERN.test(id)) return null;
      if (!snapshot.notifications.some((item) => item.id === id)) return null;
      return { type: "markNotificationRead", notificationId: id };
    }
    case "openNotifications":
      return { type: "openNotifications" };
    case "openSettings":
      return { type: "openSettings" };
    case "openIntegrations":
      return { type: "openIntegrations" };
    case "openTransaction": {
      const tab = candidate.tab;
      if (tab === "expense" || tab === "income" || tab === "honorarios") {
        if (snapshot.user?.role !== "ADMIN" && tab !== "expense") return null;
        return { type: "openTransaction", tab };
      }
      if ("tab" in candidate) return null;
      // Compatibilidad con builds anteriores que no enviaban pestaña.
      return {
        type: "openTransaction",
        tab: snapshot.user?.role === "ADMIN" ? "income" : "expense",
      };
    }
    case "signOut":
      return { type: "signOut" };
    default:
      return null;
  }
}

function safeParse(rawValue: string): unknown {
  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function sanitizeAccentColor(value: unknown): string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value)
    ? value.toUpperCase()
    : "#3B82F6";
}
