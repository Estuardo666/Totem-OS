/**
 * Métricas de TikTok (Display API v2).
 *
 * Diferencia clave con Meta: la Display API NO da serie temporal, solo totales
 * acumulados al momento de consultar. Por eso las filas de TikTok son
 * *snapshots* diarios, y los deltas se calculan al leer diferenciando días
 * consecutivos. No se puede rellenar hacia atrás: lo que no se recolecte hoy
 * se pierde para siempre.
 */

import { TikTokAuthError } from "./auth-service.ts";

const API_BASE = "https://open.tiktokapis.com/v2";
const TIMEOUT_MS = 10000;

export interface TikTokProfileStats {
  openId: string;
  displayName: string;
  avatarUrl: string | null;
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
}

export interface TikTokVideo {
  id: string;
  title: string;
  coverImageUrl: string | null;
  shareUrl: string | null;
  createdAt: Date;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

export interface TikTokMetricRow {
  clientId: string;
  platform: string;
  metricName: string;
  value: number;
  date: Date;
}

function throwTikTokError(payload: { error?: { code?: string; message?: string } }): never {
  const code = payload.error?.code;
  const message = payload.error?.message;

  if (code && /access_token_invalid|token_expired|scope_not_authorized/i.test(code)) {
    throw new TikTokAuthError();
  }
  if (code && /rate_limit/i.test(code)) {
    throw new Error("TikTok limitó temporalmente las consultas. Se reintentará luego.");
  }
  throw new Error(`TikTok: ${message || code || "error desconocido"}`);
}

async function tiktokRequest(
  path: string,
  accessToken: string,
  init: { method: "GET" | "POST"; params?: Record<string, string>; body?: unknown }
): Promise<Record<string, unknown>> {
  const url = new URL(`${API_BASE}${path}`);
  if (init.params) {
    url.search = new URLSearchParams(init.params).toString();
  }

  const response = await fetch(url, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });

  const payload = await response.json();

  // TikTok devuelve 200 con error dentro; comprobar solo response.ok no basta.
  const error = payload.error as { code?: string } | undefined;
  if (error?.code && error.code !== "ok") {
    throwTikTokError(payload);
  }

  return payload;
}

/**
 * Estadísticas actuales del perfil.
 * Son totales acumulados, no un valor del día.
 */
export async function fetchTikTokProfileStats(
  accessToken: string
): Promise<TikTokProfileStats> {
  const payload = await tiktokRequest("/user/info/", accessToken, {
    method: "GET",
    params: {
      fields: [
        "open_id",
        "display_name",
        "avatar_url",
        "follower_count",
        "following_count",
        "likes_count",
        "video_count",
      ].join(","),
    },
  });

  const user = (payload.data as { user?: Record<string, unknown> })?.user;
  if (!user) {
    throw new Error("TikTok no devolvió datos del perfil.");
  }

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

  return {
    openId: String(user.open_id ?? ""),
    displayName: String(user.display_name ?? ""),
    avatarUrl: typeof user.avatar_url === "string" ? user.avatar_url : null,
    followerCount: num(user.follower_count),
    followingCount: num(user.following_count),
    likesCount: num(user.likes_count),
    videoCount: num(user.video_count),
  };
}

/**
 * Videos recientes con sus métricas, para la sección de mejor contenido.
 * Una sola página: el informe muestra unos pocos, no el catálogo completo.
 */
export async function fetchTikTokVideos(
  accessToken: string,
  maxCount: number = 20
): Promise<TikTokVideo[]> {
  const payload = await tiktokRequest("/video/list/", accessToken, {
    method: "POST",
    params: {
      fields: [
        "id",
        "title",
        "cover_image_url",
        "share_url",
        "create_time",
        "view_count",
        "like_count",
        "comment_count",
        "share_count",
      ].join(","),
    },
    body: { max_count: Math.min(Math.max(maxCount, 1), 20) },
  });

  const videos = (payload.data as { videos?: Array<Record<string, unknown>> })?.videos ?? [];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

  return videos.map((v) => ({
    id: String(v.id),
    title: typeof v.title === "string" ? v.title : "",
    coverImageUrl: typeof v.cover_image_url === "string" ? v.cover_image_url : null,
    shareUrl: typeof v.share_url === "string" ? v.share_url : null,
    // create_time viene en segundos Unix.
    createdAt: new Date(num(v.create_time) * 1000),
    viewCount: num(v.view_count),
    likeCount: num(v.like_count),
    commentCount: num(v.comment_count),
    shareCount: num(v.share_count),
  }));
}

/**
 * Convierte las estadísticas en filas para ClientMetric.
 *
 * Todas van fechadas a la medianoche UTC de hoy: son un snapshot del día, y
 * esa fecha es lo que permite que la clave única deduplique si el cron corre
 * dos veces.
 */
export function transformTikTokForStorage(
  stats: TikTokProfileStats,
  videos: TikTokVideo[],
  clientId: string,
  now: Date = new Date()
): TikTokMetricRow[] {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);

  const rows: TikTokMetricRow[] = [
    { metricName: "follower_count", value: stats.followerCount },
    { metricName: "likes_count", value: stats.likesCount },
    { metricName: "video_count", value: stats.videoCount },
  ].map((r) => ({ clientId, platform: "TIKTOK", date, ...r }));

  // Las vistas del período no las expone la API a nivel de cuenta, así que se
  // suman desde los videos devueltos. Es una aproximación acotada a esa
  // ventana, no el histórico completo del perfil.
  if (videos.length > 0) {
    const totals = videos.reduce(
      (acc, v) => ({
        views: acc.views + v.viewCount,
        likes: acc.likes + v.likeCount,
        comments: acc.comments + v.commentCount,
        shares: acc.shares + v.shareCount,
      }),
      { views: 0, likes: 0, comments: 0, shares: 0 }
    );

    rows.push(
      { clientId, platform: "TIKTOK", metricName: "video_views", value: totals.views, date },
      { clientId, platform: "TIKTOK", metricName: "video_likes", value: totals.likes, date },
      { clientId, platform: "TIKTOK", metricName: "video_comments", value: totals.comments, date },
      { clientId, platform: "TIKTOK", metricName: "video_shares", value: totals.shares, date }
    );
  }

  return rows;
}
