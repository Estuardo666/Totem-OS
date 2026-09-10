/**
 * Servicio de métricas de Meta Graph API
 * Aísla la lógica de llamadas a la API de Insights (Clean Architecture)
 */

export interface PageMetricData {
  name: string; // Nombre de la métrica (ej: "page_impressions")
  period: string; // "day" | "week" | "days_28"
  values: Array<{
    value: number | string; // Puede ser número o string (para métricas lifetime)
    end_time: string; // ISO 8601 date string
  }>;
  title: string; // Título legible de la métrica
  description?: string;
}

export interface PageMetricsResponse {
  data: PageMetricData[];
  paging?: {
    previous?: string;
    next?: string;
  };
}

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

/**
 * Obtiene métricas de una página de Facebook
 * Hace dos llamadas separadas: una para métricas diarias y otra para métricas lifetime
 * @param pageId ID de la página de Facebook
 * @param accessToken Token de acceso de la página
 * @param days Número de días hacia atrás desde hoy (default: 28)
 * @returns Array de métricas con sus valores diarios y lifetime combinados
 */
export async function fetchPageMetrics(
  pageId: string,
  accessToken: string,
  days: number = 28
): Promise<PageMetricsResponse> {
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error("El período debe estar entre 1 y 90 días.");
  }
  const until = Math.floor(Date.now() / 1000);
  const since = until - days * 86400;
  const url = new URL(`https://graph.facebook.com/v21.0/${pageId}/insights`);
  url.search = new URLSearchParams({
    metric: "page_media_view,page_post_engagements,page_follows",
    period: "day",
    since: String(since),
    until: String(until),
  }).toString();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok || result.error) {
    const code = result.error?.code;
    if (code === 190 || code === 102) throw new TokenExpiredError();
    if (code === 10 || code === 200) throw new InsufficientPermissionsError();
    // Invalid metrics (#100) are not permission failures.
    throw new Error(`Meta Insights: ${result.error?.message || response.statusText}`);
  }
  if (!Array.isArray(result.data) || result.data.length === 0) {
    throw new Error("Meta no devolvió métricas para este período.");
  }
  return { data: result.data };
}

/**
 * Transforma la respuesta de Meta en un formato plano para almacenar en la DB
 * Maneja métricas "lifetime" (como page_fans) que solo tienen un valor total
 */
export function transformMetricsForStorage(
  metricsData: PageMetricsResponse,
  clientId: string,
  platform: "FACEBOOK" | "INSTAGRAM"
): Array<{
  clientId: string;
  platform: string;
  metricName: string;
  value: number;
  date: Date;
}> {
  const results: Array<{
    clientId: string;
    platform: string;
    metricName: string;
    value: number;
    date: Date;
  }> = [];

  for (const metric of metricsData.data) {
    // Para métricas "lifetime" (como page_fans), solo hay un valor total
    if (metric.values.length === 1 && metric.period === "lifetime") {
      const value = metric.values[0].value;
      const numericValue = typeof value === "string" ? parseFloat(value) || 0 : value;
      const date = new Date(metric.values[0].end_time);

      results.push({
        clientId,
        platform,
        metricName: metric.name,
        value: numericValue,
        date,
      });
    } else {
      // Para métricas diarias, procesar cada día
      for (const valueEntry of metric.values) {
        const value = valueEntry.value;
        const numericValue = typeof value === "string" ? parseFloat(value) || 0 : value;
        const date = new Date(valueEntry.end_time);

        results.push({
          clientId,
          platform,
          metricName: metric.name,
          value: numericValue,
          date,
        });
      }
    }
  }

  return results;
}

