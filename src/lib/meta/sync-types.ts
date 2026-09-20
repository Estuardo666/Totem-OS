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
  /**
   * Días de los que reconstruir las métricas de Instagram que Graph solo
   * entrega como total de un período (una petición por día).
   *
   * El valor por defecto es corto a propósito: la corrida diaria solo necesita
   * cubrir la anterior. Solo un backfill manual lo sube, y ahí sí cuesta una
   * llamada por día.
   */
  totalsDays?: number;
  /** Publicaciones a traer por plataforma. 0 las desactiva. */
  mediaLimit?: number;
}

export interface SyncSummary {
  /** Total de filas escritas sumando todas las plataformas. */
  total: number;
  results: PlatformSyncResult[];
}
