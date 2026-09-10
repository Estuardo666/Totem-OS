/**
 * Tipos compartidos de la sincronización de métricas sociales.
 *
 * Viven fuera de los Server Actions porque un archivo "use server" solo puede
 * exportar funciones async; los tipos se borran en compilación pero Next.js
 * igual rechaza el módulo si se declaran ahí.
 */

export type SyncPlatform = "FACEBOOK" | "INSTAGRAM" | "META_ADS" | "TIKTOK";

export const SYNC_PLATFORMS: readonly SyncPlatform[] = [
  "FACEBOOK",
  "INSTAGRAM",
  "META_ADS",
  "TIKTOK",
] as const;

export type SyncStatus = "OK" | "SKIPPED" | "ERROR";

export interface PlatformSyncResult {
  platform: SyncPlatform;
  status: SyncStatus;
  /** Filas escritas en la base de datos. */
  count: number;
  /** Motivo legible cuando el estado no es OK. */
  reason?: string;
  durationMs: number;
}

export interface SyncOptions {
  /** Si se omite, se sincroniza toda plataforma que tenga credenciales. */
  platforms?: SyncPlatform[];
  /** Ventana hacia atrás desde hoy. Ignorado si se pasan since/until. */
  days?: number;
  since?: Date;
  until?: Date;
}

export interface SyncSummary {
  /** Total de filas escritas sumando todas las plataformas. */
  total: number;
  results: PlatformSyncResult[];
}
