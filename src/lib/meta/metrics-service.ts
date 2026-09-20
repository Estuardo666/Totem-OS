/**
 * Servicio de métricas de Meta Graph API (páginas de Facebook)
 * Aísla la lógica de llamadas a la API de Insights (Clean Architecture)
 */

export interface PageMetricData {
  name: string; // Nombre de la métrica (ej: "page_media_view")
  period: string; // "day" | "week" | "days_28" | "lifetime"
  values: Array<{
    // Number para la mayoría; string en métricas lifetime; objeto en las que
    // vienen desglosadas por tipo (ej: page_actions_post_reactions_total).
    value: number | string | Record<string, number>;
    end_time: string; // ISO 8601 date string
  }>;
  title?: string; // Título legible de la métrica
  description?: string;
}

export interface PageMetricsResponse {
  data: PageMetricData[];
  paging?: {
    previous?: string;
    next?: string;
  };
}

const GRAPH = "https://graph.facebook.com/v21.0";
const TIMEOUT_MS = 10000;

/**
 * Métricas diarias de página verificadas contra la API real con
 * `scripts/probe-meta-metrics.mjs` (v21.0, septiembre 2026).
 *
 * Meta deprecó toda la familia `page_impressions*` y `page_fans*`: pedirlas
 * devuelve "(#100) The value must be a valid insights metric". Este array es
 * el único lugar a editar cuando cambie el catálogo — y la forma de saber qué
 * es válido es volver a correr el script, no leer la documentación.
 */
export const FB_DAILY_METRICS = [
  "page_media_view", // visualizaciones de contenido
  "page_post_engagements", // interacciones con publicaciones
  "page_views_total", // visitas al perfil de la página
  "page_video_views", // reproducciones de video
  "page_video_view_time", // tiempo total de reproducción
  "page_daily_follows_unique", // nuevos seguidores del día
  "page_daily_unfollows_unique", // seguidores perdidos del día
  "page_total_actions", // clics en botones de acción (CTA)
  "page_actions_post_reactions_total", // reacciones, desglosadas por tipo
] as const;

/**
 * Métricas de tipo snapshot: el valor de cada día es un acumulado, no un
 * incremento. Se guardan igual que las diarias, pero al leerlas hay que tomar
 * el último valor del período y nunca sumarlas.
 */
export const FB_SNAPSHOT_METRICS = ["page_follows"] as const;

/** Todas las métricas de página que la sincronización solicita. */
export const FB_ALL_METRICS = [...FB_DAILY_METRICS, ...FB_SNAPSHOT_METRICS] as const;

/**
 * Error específico para tokens caducados
 */
export class TokenExpiredError extends Error {
  constructor(message: string = "El token de acceso ha caducado. Por favor, reconecta tu cuenta de Facebook.") {
    super(message);
    this.name = "TokenExpiredError";
  }
}

/**
 * Error específico para permisos insuficientes
 */
export class InsufficientPermissionsError extends Error {
  constructor(message: string = "No tienes permisos suficientes para acceder a estas métricas.") {
    super(message);
    this.name = "InsufficientPermissionsError";
  }
}

interface GraphErrorBody {
  error?: { code?: number; message?: string };
}

/**
 * Traduce un error de Graph a los tipos que el dispatcher sabe interpretar.
 * El código 100 (métrica inválida) queda como error genérico a propósito: es
 * un problema de nuestra petición, no de los permisos del usuario.
 */
function throwGraphError(result: GraphErrorBody, fallback: string): never {
  const code = result.error?.code;
  if (code === 190 || code === 102) throw new TokenExpiredError();
  if (code === 10 || code === 200) throw new InsufficientPermissionsError();
  throw new Error(`Meta Insights: ${result.error?.message || fallback}`);
}

/** Un #100 es "esta métrica ya no existe", no un fallo de credenciales. */
function isInvalidMetricError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("(#100)");
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
    throwGraphError(result as GraphErrorBody, response.statusText);
  }
  return result as Record<string, unknown>;
}

/**
 * Pide un conjunto de métricas y, si Graph rechaza el lote por métrica
 * inválida, reintenta una por una y se queda con las que sí responden.
 *
 * El mensaje de Graph no siempre dice *cuál* métrica sobra ("The value must be
 * a valid insights metric"), así que averiguarlo exige preguntar de a una. El
 * costo se paga solo cuando algo se deprecó: una deprecación degrada el panel
 * en una métrica, no apaga toda la sincronización.
 */
export async function fetchMetricsWithFallback(
  path: string,
  accessToken: string,
  metrics: readonly string[],
  params: Record<string, string>
): Promise<PageMetricData[]> {
  if (metrics.length === 0) return [];

  try {
    const result = await graphGet(path, accessToken, { ...params, metric: metrics.join(",") });
    return Array.isArray(result.data) ? (result.data as PageMetricData[]) : [];
  } catch (error) {
    if (!isInvalidMetricError(error) || metrics.length === 1) throw error;

    const collected: PageMetricData[] = [];
    let lastError: unknown = error;
    for (const metric of metrics) {
      try {
        const result = await graphGet(path, accessToken, { ...params, metric });
        if (Array.isArray(result.data)) collected.push(...(result.data as PageMetricData[]));
      } catch (singleError) {
        lastError = singleError;
        console.warn(`[Meta] Métrica descartada "${metric}":`, (singleError as Error).message);
      }
    }

    // Si ninguna sobrevivió, el problema no era una métrica suelta.
    if (collected.length === 0) throw lastError;
    return collected;
  }
}

/**
 * Obtiene métricas de una página de Facebook.
 *
 * @param pageId ID de la página de Facebook
 * @param accessToken Token de acceso de la página
 * @param days Número de días hacia atrás desde hoy (default: 28)
 * @param metrics Métricas a solicitar; por defecto, todas las soportadas
 */
export async function fetchPageMetrics(
  pageId: string,
  accessToken: string,
  days: number = 28,
  metrics: readonly string[] = FB_ALL_METRICS
): Promise<PageMetricsResponse> {
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error("El período debe estar entre 1 y 90 días.");
  }

  const until = Math.floor(Date.now() / 1000);
  const since = until - days * 86400;

  const data = await fetchMetricsWithFallback(`${pageId}/insights`, accessToken, metrics, {
    period: "day",
    since: String(since),
    until: String(until),
  });

  if (data.length === 0) {
    throw new Error("Meta no devolvió métricas para este período.");
  }

  return { data };
}

/**
 * Recorre una lista con concurrencia acotada, preservando el orden.
 *
 * Los insights se piden de a una publicación: en serie, 10 publicaciones por
 * red se llevaban más de un minuto por cliente y el cron no alcanzaba a
 * recorrer la cartera dentro de su presupuesto. Cuatro en paralelo es un
 * compromiso deliberado — reduce el reloj sin acercarse al límite de
 * peticiones, que se mide por hora y no por ráfaga.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

/** Publicaciones que se piden en paralelo dentro de una misma red. */
export const MEDIA_CONCURRENCY = 4;

export interface PagePostInsight {
  id: string;
  message: string;
  permalink: string;
  thumbnailUrl: string | null;
  publishedAt: Date;
  views: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
  videoViews: number;
}

/**
 * Suma las entradas de una métrica desglosada por tipo.
 * Graph devuelve `{}` cuando no hubo actividad, no cero.
 */
function sumBreakdown(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).reduce<number>(
      (sum, entry) => sum + (typeof entry === "number" ? entry : 0),
      0
    );
  }
  return 0;
}

function pickBreakdown(value: unknown, key: string): number {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entry = (value as Record<string, unknown>)[key];
    return typeof entry === "number" ? entry : 0;
  }
  return 0;
}

/**
 * Publicaciones recientes de la página con sus insights.
 *
 * Los campos agregados del post (`shares`, `comments.summary`,
 * `reactions.summary`) exigen `pages_read_user_content`, que esta app no pide:
 * verificado contra la API real, devuelven "(#10)". Por eso likes, comentarios
 * y compartidos se leen de `post_activity_by_action_type`, que sí responde con
 * el token de página que ya tenemos.
 *
 * Un post cuyos insights fallen se conserva con ceros en vez de tumbar la
 * llamada completa: los formatos nuevos suelen no exponerlos.
 */
export async function fetchPagePosts(
  pageId: string,
  accessToken: string,
  limit: number = 25
): Promise<PagePostInsight[]> {
  const listed = await graphGet(`${pageId}/posts`, accessToken, {
    fields: "id,message,created_time,permalink_url,full_picture",
    limit: String(Math.min(Math.max(limit, 1), 50)),
  });

  const posts = Array.isArray(listed.data) ? listed.data : [];

  const results = await mapWithConcurrency(
    posts as Array<Record<string, unknown>>,
    MEDIA_CONCURRENCY,
    async (post): Promise<PagePostInsight> => {
      const id = String(post.id);
      let views = 0;
      let clicks = 0;
      let videoViews = 0;
      let likes = 0;
      let comments = 0;
      let shares = 0;

      try {
        const insights = await graphGet(`${id}/insights`, accessToken, {
          metric:
            "post_media_view,post_clicks,post_video_views,post_activity_by_action_type,post_reactions_by_type_total",
        });

        for (const metric of ((insights.data as PageMetricData[]) ?? [])) {
          const raw = metric.values?.[0]?.value;
          switch (metric.name) {
            case "post_media_view":
              views = sumBreakdown(raw);
              break;
            case "post_clicks":
              clicks = sumBreakdown(raw);
              break;
            case "post_video_views":
              videoViews = sumBreakdown(raw);
              break;
            case "post_activity_by_action_type":
              comments = pickBreakdown(raw, "comment");
              shares = pickBreakdown(raw, "share");
              break;
            case "post_reactions_by_type_total":
              likes = sumBreakdown(raw);
              break;
          }
        }
      } catch (error) {
        console.warn(`[Meta] Sin insights para el post ${id}:`, (error as Error).message);
      }

      return {
        id,
        message: typeof post.message === "string" ? post.message : "",
        permalink: typeof post.permalink_url === "string" ? post.permalink_url : "",
        thumbnailUrl: typeof post.full_picture === "string" ? post.full_picture : null,
        publishedAt: new Date(String(post.created_time)),
        views,
        clicks,
        likes,
        comments,
        shares,
        videoViews,
      };
    }
  );

  return results;
}

export interface StoredMetricRow {
  clientId: string;
  platform: string;
  metricName: string;
  value: number;
  date: Date;
}

/**
 * Transforma la respuesta de Meta en filas planas para `ClientMetric`.
 *
 * Los valores desglosados por tipo (`{ like: 3, love: 1 }`) se expanden en una
 * fila por tipo —`page_actions_post_reactions_total:like`— más el total. Sin
 * esto, `parseFloat` sobre un objeto guardaría NaN en silencio.
 */
export function transformMetricsForStorage(
  metricsData: PageMetricsResponse,
  clientId: string,
  platform: "FACEBOOK" | "INSTAGRAM"
): StoredMetricRow[] {
  const results: StoredMetricRow[] = [];

  const push = (metricName: string, value: number, date: Date) => {
    if (!Number.isFinite(value)) return;
    results.push({ clientId, platform, metricName, value, date });
  };

  for (const metric of metricsData.data) {
    for (const valueEntry of metric.values ?? []) {
      const date = new Date(valueEntry.end_time);
      if (Number.isNaN(date.getTime())) continue;

      const raw = valueEntry.value;

      if (raw && typeof raw === "object") {
        let total = 0;
        for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
          if (typeof entry !== "number") continue;
          total += entry;
          push(`${metric.name}:${key}`, entry, date);
        }
        push(metric.name, total, date);
        continue;
      }

      const numericValue = typeof raw === "string" ? parseFloat(raw) || 0 : raw;
      push(metric.name, numericValue ?? 0, date);
    }
  }

  return results;
}
