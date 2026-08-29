import { appConfigDataSchema, type AppConfigData } from "../contracts/api-contracts.ts";
import type { ApiActor } from "./api-actor.ts";
import { db } from "./db.ts";

const APP_CONFIG_KEY = "ios_app_config";
const DEFAULT_CONFIG: AppConfigData = {
  version: 1,
  defaultMode: "web",
  routes: [],
};

function isSafePath(value: unknown): value is string {
  return typeof value === "string"
    && /^\/(?:[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*)?$/u.test(value)
    && value.length <= 256;
}

function parseStoredConfig(value: string | undefined): AppConfigData {
  if (!value) return DEFAULT_CONFIG;
  try {
    const parsed: unknown = JSON.parse(value);
    const result = appConfigDataSchema.safeParse(parsed);
    return result.success ? result.data : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Resuelve la configuración remota del router. Las filas del usuario se
 * aplican al final para permitir rollback inmediato a WebView.
 */
export async function loadAppConfig(actor: Pick<ApiActor, "userId">): Promise<AppConfigData> {
  const [stored, overrides] = await Promise.all([
    db.globalConfig.findUnique({ where: { key: APP_CONFIG_KEY }, select: { value: true } }),
    db.userRouteOverride.findMany({
      where: { userId: actor.userId },
      select: { path: true, mode: true },
      orderBy: { path: "asc" },
    }),
  ]);

  const config = parseStoredConfig(stored?.value);
  const routes = new Map(config.routes.map((route) => [route.path, route.mode]));
  for (const override of overrides) {
    if (isSafePath(override.path) && (override.mode === "native" || override.mode === "web")) {
      routes.set(override.path, override.mode);
    }
  }

  return {
    version: 1,
    defaultMode: config.defaultMode,
    routes: [...routes.entries()]
      .map(([path, mode]) => ({ path, mode }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  };
}

export function routeModeForPath(config: AppConfigData, path: string): "native" | "web" {
  if (!isSafePath(path)) return config.defaultMode;
  const exact = config.routes.find((route) => route.path === path);
  if (exact) return exact.mode;
  const prefix = config.routes
    .filter((route) => path.startsWith(`${route.path}/`))
    .sort((left, right) => right.path.length - left.path.length)[0];
  return prefix?.mode ?? config.defaultMode;
}

export { APP_CONFIG_KEY };
