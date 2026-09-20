/**
 * Servicio de métricas de Instagram Business (Meta Graph API v21.0)
 *
 * Mismo contrato que metrics-service.ts: funciones puras, token en el header
 * Authorization (nunca en la URL), timeout explícito, y los errores tipados se
 * reutilizan para que los `instanceof` del dispatcher funcionen.
 */

import {
  InsufficientPermissionsError,
  MEDIA_CONCURRENCY,
  mapWithConcurrency,
  TokenExpiredError,
  type PageMetricData,
  type PageMetricsResponse,
  type StoredMetricRow,
} from "./metrics-service.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const TIMEOUT_MS = 10000;

/**
 * Métricas diarias con serie temporal.
 *
 * NO incluye `impressions`: Meta lo eliminó en v22 y lo reemplazó por `views`,
 * que además solo existe como `total_value`. Verificado con
 * `scripts/probe-meta-metrics.mjs` — ante una métrica inválida el
 * `error.message` de Graph enumera las válidas, y esa es la fuente
 * autoritativa, no la documentación.
 *
 * `follower_count` es el delta diario de seguidores, no el total: el total se
 * lee aparte con `fetchInstagramFollowerCount`.
 */
export const IG_DAILY_METRICS = ["reach", "follower_count"] as const;

/**
 * Métricas que Graph solo entrega como valor total de un período.
 *
 * Exigen `metric_type=total_value` y van en una petición aparte de las
 * diarias. Para obtener serie diaria se piden con una ventana de un día
 * (ver `fetchInstagramDailyTotals`), nunca con la ventana completa: guardar el
 * total de 28 días en la fecha de hoy y luego sumar por período inflaría cada
 * lectura.
 */
export const IG_TOTAL_VALUE_METRICS = [
  "views", // visualizaciones de contenido (reemplaza impressions)
  "profile_views",
  "website_clicks",
  "profile_links_taps",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "saves",
  "shares",
  "replies",
] as const;

/** Desgloses demográficos soportados para los seguidores. */
export const IG_DEMOGRAPHIC_BREAKDOWNS = ["country", "city", "age", "gender"] as const;

export interface IgMediaInsight {
  id: string;
  caption: string;
  mediaType: string;
  productType: string;
  permalink: string;
  thumbnailUrl: string | null;
  publishedAt: Date;
  likes: number;
  comments: number;
  reach: number;
  views: number;
  saves: number;
  shares: number;
  profileVisits: number;
  follows: number;
  interactions: number;
}

export interface IgDemographicRow {
  /** "country" | "city" | "age" | "gender" */
  dimension: string;
  /** Valor del desglose: "EC", "25-34", "F"… */
  key: string;
  value: number;
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

/** Medianoche UTC de una fecha: la clave con la que se guardan las filas. */
function utcMidnight(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

/**
 * Obtiene las métricas diarias de una cuenta de Instagram Business.
 *
 * Solo la familia con serie temporal real. Una respuesta vacía no es un fallo
 * — devuelve `data: []` y deja que el dispatcher lo registre como cero filas.
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

  const daily = await graphGet(`${igUserId}/insights`, accessToken, {
    metric: IG_DAILY_METRICS.join(","),
    period: "day",
    since: String(since),
    until: String(until),
  });

  return { data: Array.isArray(daily.data) ? (daily.data as PageMetricData[]) : [] };
}

/**
 * Serie diaria de las métricas que Graph solo entrega como total del período.
 *
 * Se pide una ventana de 24 h por día, de más reciente a más antiguo. Es la
 * única forma de construir histórico con estas métricas: pedir la ventana
 * completa devuelve un único número que, guardado día tras día, se sumaría
 * consigo mismo en cada lectura.
 *
 * Por eso `days` es deliberadamente corto en la sincronización diaria (basta
 * con cubrir la corrida anterior) y solo se amplía en un backfill manual.
 */
export async function fetchInstagramDailyTotals(
  igUserId: string,
  accessToken: string,
  clientId: string,
  days: number = 3
): Promise<StoredMetricRow[]> {
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error("El período debe estar entre 1 y 90 días.");
  }

  const rows: StoredMetricRow[] = [];
  const today = utcMidnight(new Date());

  for (let back = 1; back <= days; back++) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - back);
    const since = Math.floor(day.getTime() / 1000);

    let result: Record<string, unknown>;
    try {
      result = await graphGet(`${igUserId}/insights`, accessToken, {
        metric: IG_TOTAL_VALUE_METRICS.join(","),
        metric_type: "total_value",
        period: "day",
        since: String(since),
        until: String(since + 86400),
      });
    } catch (error) {
      // Un día suelto que Graph rechaza (ventana fuera de rango, cuenta recién
      // creada) no puede invalidar los demás días ya recolectados.
      console.warn(`[Meta] Instagram sin totales para ${day.toISOString().slice(0, 10)}:`, (error as Error).message);
      continue;
    }

    type TotalValueMetric = PageMetricData & { total_value?: { value?: number } };
    for (const metric of ((result.data as TotalValueMetric[]) ?? [])) {
      const value = metric.total_value?.value;
      if (typeof value !== "number") continue;
      rows.push({
        clientId,
        platform: "INSTAGRAM",
        metricName: metric.name,
        value,
        date: day,
      });
    }
  }

  return rows;
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
 * Demografía de los seguidores, desglosada por país, ciudad, edad y género.
 *
 * Meta exige al menos 100 seguidores; por debajo responde "Not enough users".
 * Eso no es un error de la app: se devuelve lo que sí llegó y se sigue. Se usa
 * `follower_demographics` y no `engaged_audience_demographics` porque esta
 * última exige un `timeframe` cuyos valores fueron retirados en v20+
 * (verificado contra la API real).
 */
export async function fetchInstagramDemographics(
  igUserId: string,
  accessToken: string
): Promise<IgDemographicRow[]> {
  const rows: IgDemographicRow[] = [];

  for (const breakdown of IG_DEMOGRAPHIC_BREAKDOWNS) {
    let result: Record<string, unknown>;
    try {
      result = await graphGet(`${igUserId}/insights`, accessToken, {
        metric: "follower_demographics",
        period: "lifetime",
        metric_type: "total_value",
        breakdown,
      });
    } catch (error) {
      console.warn(`[Meta] Instagram sin demografía "${breakdown}":`, (error as Error).message);
      continue;
    }

    type DemographicMetric = {
      total_value?: {
        breakdowns?: Array<{
          dimension_keys?: string[];
          results?: Array<{ dimension_values?: string[]; value?: number }>;
        }>;
      };
    };

    for (const metric of ((result.data as DemographicMetric[]) ?? [])) {
      for (const group of metric.total_value?.breakdowns ?? []) {
        for (const entry of group.results ?? []) {
          const key = entry.dimension_values?.[0];
          if (!key || typeof entry.value !== "number") continue;
          rows.push({ dimension: breakdown, key, value: entry.value });
        }
      }
    }
  }

  return rows;
}

/**
 * Convierte la demografía en filas de `ClientMetric`.
 *
 * La dimensión viaja dentro de `metricName` (`audience_country:EC`) en vez de
 * en una columna nueva: la clave única de la tabla ya es
 * `clientId+platform+metricName+date`, así que la convención entra sin migrar
 * nada. Se fecha a medianoche UTC de hoy porque es un snapshot, no una serie.
 */
export function transformDemographicsForStorage(
  rows: IgDemographicRow[],
  clientId: string
): StoredMetricRow[] {
  const date = utcMidnight(new Date());
  return rows.map((row) => ({
    clientId,
    platform: "INSTAGRAM",
    metricName: `audience_${row.dimension}:${row.key}`,
    value: row.value,
    date,
  }));
}

/**
 * Métricas por publicación verificadas contra la API real para FEED y REELS.
 * `impressions` y `plays` ya no existen en v22+; `views` las reemplaza.
 */
const MEDIA_METRICS = [
  "reach",
  "views",
  "total_interactions",
  "saved",
  "shares",
  "likes",
  "comments",
  "profile_visits",
  "follows",
] as const;

/**
 * Subconjunto que toda publicación soporta.
 *
 * `profile_visits` y `follows` no existen para algunos formatos —Graph
 * responde "(#100) The Media Insights API does not support the profile_visits,
 * follows metric for this media product type"— y rechaza la petición entera.
 * Sin este reintento, una sola métrica extra dejaba la publicación sin alcance
 * ni interacciones.
 */
const CORE_MEDIA_METRICS = [
  "reach",
  "views",
  "total_interactions",
  "saved",
  "shares",
  "likes",
  "comments",
] as const;

/**
 * Publicaciones recientes con sus insights, para la sección "mejor contenido"
 * del informe. Una publicación cuyos insights fallen conserva sus contadores
 * públicos en vez de tumbar toda la llamada — las historias y algunos formatos
 * no los exponen.
 */
export async function fetchInstagramTopMedia(
  igUserId: string,
  accessToken: string,
  limit: number = 25
): Promise<IgMediaInsight[]> {
  const listed = await graphGet(`${igUserId}/media`, accessToken, {
    fields:
      "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url",
    limit: String(Math.min(Math.max(limit, 1), 50)),
  });

  const media = Array.isArray(listed.data) ? listed.data : [];

  const results = await mapWithConcurrency(
    media as Array<Record<string, unknown>>,
    MEDIA_CONCURRENCY,
    async (item): Promise<IgMediaInsight> => {
      const id = String(item.id);
      const values: Record<string, number> = {};

      const readInsights = async (metrics: readonly string[]) => {
        const insights = await graphGet(`${id}/insights`, accessToken, {
          metric: metrics.join(","),
        });
        for (const metric of ((insights.data as PageMetricData[]) ?? [])) {
          const raw = metric.values?.[0]?.value;
          const value =
            typeof raw === "string" ? parseFloat(raw) || 0 : typeof raw === "number" ? raw : 0;
          values[metric.name] = value;
        }
      };

      try {
        await readInsights(MEDIA_METRICS);
      } catch {
        try {
          await readInsights(CORE_MEDIA_METRICS);
        } catch (error) {
          // Sin insights para este formato: se conserva la publicación con los
          // contadores públicos (likes y comentarios) y ceros en el resto.
          console.warn(`[Meta] Instagram sin insights para ${id}:`, (error as Error).message);
        }
      }

      return {
        id,
        caption: typeof item.caption === "string" ? item.caption : "",
        mediaType: String(item.media_type ?? "UNKNOWN"),
        productType: String(item.media_product_type ?? "FEED"),
        permalink: String(item.permalink ?? ""),
        thumbnailUrl:
          (typeof item.thumbnail_url === "string" && item.thumbnail_url) ||
          (typeof item.media_url === "string" && item.media_url) ||
          null,
        publishedAt: new Date(String(item.timestamp)),
        likes: values.likes ?? Number(item.like_count ?? 0),
        comments: values.comments ?? Number(item.comments_count ?? 0),
        reach: values.reach ?? 0,
        views: values.views ?? 0,
        saves: values.saved ?? 0,
        shares: values.shares ?? 0,
        profileVisits: values.profile_visits ?? 0,
        follows: values.follows ?? 0,
        interactions: values.total_interactions ?? 0,
      };
    }
  );

  return results;
}
