/**
 * Nombres de métrica por plataforma.
 *
 * Existe un único mapa para que el informe mensual y el panel de analítica no
 * puedan desincronizarse: si Meta renombra algo, se corrige aquí y ambos lo
 * ven. Los nombres están verificados contra la API real con
 * `scripts/probe-meta-metrics.mjs`.
 */

export type ReportPlatform = "FACEBOOK" | "INSTAGRAM" | "TIKTOK";

export const PLATFORM_LABELS: Record<ReportPlatform, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};

/** Visualizaciones/alcance. Se suman a lo largo del período. */
export const REACH_METRICS: Record<ReportPlatform, string[]> = {
  FACEBOOK: ["page_media_view"],
  INSTAGRAM: ["reach"],
  TIKTOK: ["video_views"],
};

/** Visualizaciones de contenido, cuando la plataforma las separa del alcance. */
export const VIEW_METRICS: Record<ReportPlatform, string[]> = {
  FACEBOOK: ["page_media_view"],
  INSTAGRAM: ["views"],
  TIKTOK: ["video_views"],
};

/** Interacciones totales. */
export const ENGAGEMENT_METRICS: Record<ReportPlatform, string[]> = {
  FACEBOOK: ["page_post_engagements"],
  INSTAGRAM: ["total_interactions"],
  TIKTOK: ["likes_count"],
};

/**
 * Seguidores. Son snapshots: se lee el último valor del período, nunca la
 * suma — 28 días de "1.200 seguidores" no son 33.600.
 */
export const FOLLOWER_METRICS: Record<ReportPlatform, string[]> = {
  FACEBOOK: ["page_follows"],
  INSTAGRAM: ["followers_count"],
  TIKTOK: ["follower_count"],
};

/** Visitas al perfil. */
export const PROFILE_VIEW_METRICS: Record<ReportPlatform, string[]> = {
  FACEBOOK: ["page_views_total"],
  INSTAGRAM: ["profile_views"],
  TIKTOK: [],
};

/** Clics que salen de la plataforma (web, enlaces del perfil, CTA). */
export const LINK_CLICK_METRICS: Record<ReportPlatform, string[]> = {
  FACEBOOK: ["page_total_actions"],
  INSTAGRAM: ["website_clicks", "profile_links_taps"],
  TIKTOK: [],
};

/** Nuevos seguidores del día. */
export const FOLLOWS_GAINED_METRICS: Record<ReportPlatform, string[]> = {
  FACEBOOK: ["page_daily_follows_unique"],
  INSTAGRAM: [],
  TIKTOK: [],
};

/** Seguidores perdidos del día. */
export const FOLLOWS_LOST_METRICS: Record<ReportPlatform, string[]> = {
  FACEBOOK: ["page_daily_unfollows_unique"],
  INSTAGRAM: [],
  TIKTOK: [],
};

/** Compartidos. */
export const SHARE_METRICS: Record<ReportPlatform, string[]> = {
  FACEBOOK: [],
  INSTAGRAM: ["shares"],
  TIKTOK: ["shares_count"],
};

/** Guardados. */
export const SAVE_METRICS: Record<ReportPlatform, string[]> = {
  FACEBOOK: [],
  INSTAGRAM: ["saves"],
  TIKTOK: [],
};

/** Reproducciones de video. */
export const VIDEO_VIEW_METRICS: Record<ReportPlatform, string[]> = {
  FACEBOOK: ["page_video_views"],
  INSTAGRAM: [],
  TIKTOK: ["video_views"],
};

/** Prefijo con el que se guarda la demografía de audiencia. */
export const AUDIENCE_PREFIX = "audience_";

/** Dimensiones demográficas y su etiqueta para la interfaz. */
export const AUDIENCE_DIMENSIONS: Array<{ key: string; label: string }> = [
  { key: "country", label: "País" },
  { key: "city", label: "Ciudad" },
  { key: "age", label: "Edad" },
  { key: "gender", label: "Género" },
];

/**
 * Métricas cuyo valor diario es un acumulado, no un incremento.
 * Al leerlas se toma el último valor del período.
 */
export const SNAPSHOT_METRIC_NAMES = new Set([
  "page_follows",
  "followers_count",
  "follower_count_total",
]);

/** ¿Este nombre corresponde a una fila demográfica? */
export function isAudienceMetric(metricName: string): boolean {
  return metricName.startsWith(AUDIENCE_PREFIX);
}

/**
 * Parte `audience_country:EC` en sus componentes.
 * Devuelve null si el nombre no sigue la convención.
 */
export function parseAudienceMetric(
  metricName: string
): { dimension: string; key: string } | null {
  if (!isAudienceMetric(metricName)) return null;
  const separator = metricName.indexOf(":");
  if (separator === -1) return null;
  return {
    dimension: metricName.slice(AUDIENCE_PREFIX.length, separator),
    key: metricName.slice(separator + 1),
  };
}
