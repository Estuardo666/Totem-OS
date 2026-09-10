/**
 * Servicio de métricas de Instagram Business (Meta Graph API v21.0)
 *
 * Mismo contrato que metrics-service.ts: funciones puras, token en el header
 * Authorization (nunca en la URL), timeout explícito, y los errores tipados se
 * reutilizan para que los `instanceof` del dispatcher funcionen.
 */

import {
  InsufficientPermissionsError,
  TokenExpiredError,
  type PageMetricData,
  type PageMetricsResponse,
} from "./metrics-service.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const TIMEOUT_MS = 10000;

/**
 * Métricas diarias con serie temporal.
 *
 * NO incluye `impressions`: Meta lo eliminó en v22 y lo reemplazó por `views`.
 * Esta constante es el único lugar a editar cuando la app suba de versión —
 * ante una métrica inválida el `error.message` de Graph enumera las válidas,
 * y esa es la fuente autoritativa, no la documentación.
 */
export const IG_DAILY_METRICS = ["reach", "profile_views"] as const;

/**
 * Métricas que Graph solo entrega como valor total del período.
 * Exigen `metric_type=total_value` y van en una petición aparte de las diarias.
 */
export const IG_TOTAL_VALUE_METRICS = [
  "accounts_engaged",
  "total_interactions",
] as const;

export interface IgMediaInsight {
  id: string;
  caption: string;
  mediaType: string;
  permalink: string;
  thumbnailUrl: string | null;
  publishedAt: Date;
  likes: number;
  comments: number;
  reach: number;
  interactions: number;
}

/**
 * Traduce un error de Graph a los tipos que el dispatcher sabe interpretar.
 * El código 100 (métrica inválida) se deja como error genérico a propósito:
 * es un bug de nuestra petición, no un fallo de permisos del usuario.
 */
function throwGraphError(result: { error?: { code?: number; message?: string } }, fallback: string): never {
  const code = result.error?.code;
  if (code === 190 || code === 102) throw new TokenExpiredError();
  if (code === 10 || code === 200) throw new InsufficientPermissionsError();
  throw new Error(`Instagram Insights: ${result.error?.message || fallback}`);
}

async function graphGet(
  path: string,
  accessToken: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const url = new URL(`${GRAPH}/${path}`);
  url.search = new URLSearchParams(params).toString();

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });

  const result = await response.json();
  if (!response.ok || result.error) {
    throwGraphError(result, response.statusText);
  }
  return result;
}

/**
 * Obtiene las métricas de una cuenta de Instagram Business.
 *
 * Hace dos llamadas separadas porque Graph trata las métricas diarias y las de
 * valor total como familias distintas: pedirlas juntas devuelve error 100.
 * Una respuesta vacía no es un fallo — devuelve `data: []` y deja que el
 * dispatcher lo registre como cero filas.
 */
export async function fetchInstagramMetrics(
  igUserId: string,
  accessToken: string,
  days: number = 28
): Promise<PageMetricsResponse> {
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error("El período debe estar entre 1 y 90 días.");
  }

  const until = Math.floor(Date.now() / 1000);
  const since = until - days * 86400;
  const data: PageMetricData[] = [];

  // 1. Serie temporal diaria
  const daily = await graphGet(`${igUserId}/insights`, accessToken, {
    metric: IG_DAILY_METRICS.join(","),
    period: "day",
    since: String(since),
    until: String(until),
  });
  if (Array.isArray(daily.data)) {
    data.push(...(daily.data as PageMetricData[]));
  }

  // 2. Métricas de valor total (petición aparte, con metric_type)
  const totals = await graphGet(`${igUserId}/insights`, accessToken, {
    metric: IG_TOTAL_VALUE_METRICS.join(","),
    metric_type: "total_value",
    period: "day",
    since: String(since),
    until: String(until),
  });
  if (Array.isArray(totals.data)) {
    data.push(...(totals.data as PageMetricData[]));
  }

  return { data };
}

/**
 * Número absoluto de seguidores.
 *
 * Se usa el campo `followers_count` del perfil, no el insight `follower_count`:
 * ese último es un delta diario e inestable, y un informe de cliente necesita
 * el total.
 */
export async function fetchInstagramFollowerCount(
  igUserId: string,
  accessToken: string
): Promise<number> {
  const result = await graphGet(igUserId, accessToken, {
    fields: "followers_count",
  });
  const count = result.followers_count;
  return typeof count === "number" ? count : 0;
}

/**
 * Publicaciones recientes con sus insights, para la sección "mejor contenido"
 * del informe. Una publicación cuyos insights fallen se omite en vez de
 * tumbar toda la llamada — las historias y algunos formatos no los exponen.
 */
export async function fetchInstagramTopMedia(
  igUserId: string,
  accessToken: string,
  limit: number = 10
): Promise<IgMediaInsight[]> {
  const listed = await graphGet(`${igUserId}/media`, accessToken, {
    fields: "id,caption,media_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url",
    limit: String(Math.min(Math.max(limit, 1), 50)),
  });

  const media = Array.isArray(listed.data) ? listed.data : [];
  const results: IgMediaInsight[] = [];

  for (const item of media as Array<Record<string, unknown>>) {
    const id = String(item.id);
    let reach = 0;
    let interactions = 0;

    try {
      const insights = await graphGet(`${id}/insights`, accessToken, {
        metric: "reach,total_interactions",
      });
      for (const metric of (insights.data as PageMetricData[]) ?? []) {
        const raw = metric.values?.[0]?.value;
        const value = typeof raw === "string" ? parseFloat(raw) || 0 : (raw ?? 0);
        if (metric.name === "reach") reach = value;
        if (metric.name === "total_interactions") interactions = value;
      }
    } catch {
      // Sin insights para este formato: se conserva la publicación con ceros.
    }

    results.push({
      id,
      caption: typeof item.caption === "string" ? item.caption : "",
      mediaType: String(item.media_type ?? "UNKNOWN"),
      permalink: String(item.permalink ?? ""),
      thumbnailUrl:
        (typeof item.thumbnail_url === "string" && item.thumbnail_url) ||
        (typeof item.media_url === "string" && item.media_url) ||
        null,
      publishedAt: new Date(String(item.timestamp)),
      likes: Number(item.like_count ?? 0),
      comments: Number(item.comments_count ?? 0),
      reach,
      interactions,
    });
  }

  return results;
}
