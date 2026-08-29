import type { ApiActor } from "./api-actor.ts";
import { db } from "./db.ts";
import type { ShellBootstrapData } from "../contracts/api-contracts.ts";
import { CATPPUCCIN_PALETTES, DEFAULT_CATPPUCCIN_ACCENT, isCatppuccinAccent } from "./theme.ts";

const MAX_BADGE_COUNT = 999;
const MAX_NOTIFICATIONS = 5;
const ROLE_LABELS = {
  ADMIN: "Administrador",
  EDITOR: "Editor",
  USER: "Usuario",
} as const;

function clampCount(value: number): number {
  return Math.min(Math.max(value, 0), MAX_BADGE_COUNT);
}

function truncate(value: string, maximum: number): string {
  return value.length > maximum ? `${value.slice(0, maximum - 1)}…` : value;
}

function initials(name: string): string {
  const value = name
    .split(/\s+/u)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return value || "U";
}

function assetURL(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return value.startsWith("https://") ? value : null;
}

function accentColor(value: string): string {
  return /^#[0-9A-Fa-f]{6}$/u.test(value) ? value.toUpperCase() : "#3B82F6";
}

function resolvedPreferences(user: {
  darkMode: boolean;
  primaryColor: string | null;
  themeId: string | null;
  catppuccinAccent: string | null;
}): ShellBootstrapData["preferences"] {
  const theme = user.darkMode ? "dark" : "light";
  const themeId = user.themeId === "catppuccin" ? "catppuccin" : "default";
  const accent = isCatppuccinAccent(user.catppuccinAccent)
    ? user.catppuccinAccent : DEFAULT_CATPPUCCIN_ACCENT;
  if (themeId === "catppuccin") {
    const palette = CATPPUCCIN_PALETTES[theme];
    return {
      theme, themeId, catppuccinAccent: accent,
      accentColor: accentColor(palette[accent] ?? palette.mauve),
      backgroundColor: accentColor(palette.base),
      cardColor: accentColor(palette.mantle),
      foregroundColor: accentColor(palette.text),
      secondaryTextColor: accentColor(palette.subtext0),
      surfaceColor: accentColor(palette.surface0),
      borderColor: accentColor(palette.surface1),
    };
  }
  return {
    theme, themeId, catppuccinAccent: accent,
    accentColor: accentColor(user.primaryColor || "#3B82F6"),
    backgroundColor: theme === "dark" ? "#141220" : "#F7F7FA",
    cardColor: theme === "dark" ? "#1E1B2B" : "#FFFFFF",
    foregroundColor: theme === "dark" ? "#F5F3FA" : "#27221F",
    secondaryTextColor: theme === "dark" ? "#B5B0C3" : "#686371",
    surfaceColor: theme === "dark" ? "#2A2638" : "#EEEFF4",
    borderColor: theme === "dark" ? "#3A3549" : "#DADBE2",
  };
}

function brandSettings(value: string | undefined): ShellBootstrapData["brand"] {
  if (!value) return { logoLight: null, logoDark: null };
  try {
    const parsed = JSON.parse(value) as { logoLight?: unknown; logoDark?: unknown };
    return {
      logoLight: assetURL(parsed.logoLight),
      logoDark: assetURL(parsed.logoDark),
    };
  } catch {
    return { logoLight: null, logoDark: null };
  }
}

async function pendingTaskCount(
  actor: ApiActor,
  specialty: string | null
): Promise<number> {
  if (actor.role === "ADMIN") {
    return db.contentTask.count({
      where: {
        status: "CLIENT_APPROVED",
        client: { status: { not: "INACTIVE" } },
      },
    });
  }

  if (specialty?.toUpperCase().includes("COMMUNITY")) {
    return db.contentTask.count({
      where: {
        assignedCommunityId: actor.userId,
        status: { in: ["IDEA", "SCRIPT", "CLIENT_APPROVED"] },
        client: { status: { not: "INACTIVE" } },
      },
    });
  }

  return db.contentTask.count({
    where: {
      assignedEditorId: actor.userId,
      status: { in: ["RECORDED", "EDITING", "REVIEW_CLIENT"] },
      client: { status: { not: "INACTIVE" } },
    },
  });
}

/** Carga todo el estado que Swift necesita para dibujar el shell sin React. */
export async function loadShellBootstrap(actor: ApiActor): Promise<ShellBootstrapData> {
  const [user, unreadNotifications, recentNotifications, brand] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        specialty: true,
        primaryColor: true,
        darkMode: true,
        themeId: true,
        catppuccinAccent: true,
      },
    }),
    db.notification.count({
      where: { userId: actor.userId, read: false },
    }),
    db.notification.findMany({
      where: { userId: actor.userId, read: false },
      orderBy: { createdAt: "desc" },
      take: MAX_NOTIFICATIONS,
    }),
    db.globalConfig.findUnique({ where: { key: "brand_settings" } }),
  ]);

  const [pendingTasks, creators] = await Promise.all([
    pendingTaskCount(actor, user.specialty),
    db.user.findMany({
      where: {
        id: {
          in: recentNotifications
            .map((notification) => notification.createdBy)
            .filter((id): id is string => id !== null),
        },
      },
      select: { id: true, name: true, image: true },
    }),
  ]);
  const creatorById = new Map(creators.map((creator) => [creator.id, creator]));
  const name = truncate(user.name.trim() || "Usuario", 64);

  return {
    user: {
      id: user.id,
      name,
      email: user.email ?? actor.email,
      role: actor.role,
      roleLabel: ROLE_LABELS[actor.role],
      avatarUrl: assetURL(user.image),
      initials: initials(name),
    },
    capabilities: Array.from(actor.capabilities).sort().slice(0, 64),
    preferences: resolvedPreferences(user),
    brand: brandSettings(brand?.value),
    counters: {
      pendingTasks: clampCount(pendingTasks),
      unreadNotifications: clampCount(unreadNotifications),
    },
    notifications: recentNotifications
      .filter((notification) => /^[A-Za-z0-9_-]{1,64}$/u.test(notification.id))
      .map((notification) => {
        const creator = notification.createdBy
          ? creatorById.get(notification.createdBy)
          : undefined;
        return {
          id: notification.id,
          message: truncate(notification.message, 280),
          createdAt: notification.createdAt.toISOString(),
          authorName: notification.clientName
            ? truncate(notification.clientName, 64)
            : creator?.name
              ? truncate(creator.name, 64)
              : null,
          avatarUrl: assetURL(notification.clientLogo ?? creator?.image),
          read: notification.read,
        };
      }),
  };
}
