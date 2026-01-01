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
  // 1. Calcular fechas de forma segura (Meta no acepta fechas futuras o presentes para period=day)
  // Until debe ser anteayer (2 días antes) para asegurar que pedimos datos cerrados y disponibles
  const today = new Date();
  today.setDate(today.getDate() - 2); // Restamos 2 días para asegurar que pedimos datos cerrados (anteayer)
  today.setHours(23, 59, 59, 999); // Fin del día de anteayer
  const until = Math.floor(today.getTime() / 1000);

  // Since se calcula desde el until menos los días solicitados
  const sinceDate = new Date(today);
  sinceDate.setDate(sinceDate.getDate() - days);
  sinceDate.setHours(0, 0, 0, 0); // Inicio del día
  const since = Math.floor(sinceDate.getTime() / 1000);

  console.log(`🔍 [Meta Fetch] Intentando obtener métricas para Page ID: ${pageId}`);
  console.log(`📅 [Meta Fetch] Rango de fechas: ${sinceDate.toISOString().split('T')[0]} hasta ${today.toISOString().split('T')[0]} (${days} días)`);
  console.log(`📊 [Meta Fetch] Timestamps: since=${since}, until=${until}`);

  try {
    // PRIMERO: Verificar que el token tenga permisos y que la página sea accesible
    const pageInfoUrl = `https://graph.facebook.com/v21.0/${pageId}?fields=name,access_token&access_token=${accessToken}`;
    const pageInfoRes = await fetch(pageInfoUrl);
    const pageInfo = await pageInfoRes.json();

    if (pageInfo.error) {
      const errorCode = pageInfo.error.code;
      const errorMessage = pageInfo.error.message;

      console.error("❌ Error al verificar página:", pageInfo.error);

      if (errorCode === 190 || errorCode === 102) {
        throw new TokenExpiredError(
          `Token caducado o inválido: ${errorMessage}. Por favor, reconecta tu cuenta de Facebook.`
        );
      }

      if (errorCode === 200) {
        throw new InsufficientPermissionsError(
          `Permisos insuficientes: ${errorMessage}. Verifica que la página tenga los permisos necesarios.`
        );
      }

      throw new Error(`Error al verificar página: ${errorMessage} (Code: ${errorCode})`);
    }

    // Usar el page access token si está disponible (más seguro)
    const tokenToUse = pageInfo.access_token || accessToken;

    // INTENTO 1: Impresiones (period=day)
    const impressionsUrl = `https://graph.facebook.com/v21.0/${pageId}/insights?metric=page_impressions&period=day&since=${since}&until=${until}&access_token=${tokenToUse}`;
    
    // INTENTO 2: Fans (Lifetime)
    const fansUrl = `https://graph.facebook.com/v21.0/${pageId}/insights?metric=page_fans&period=lifetime&access_token=${tokenToUse}`;
    
    console.log("👉 [Meta Fetch] URLs generadas (token oculto)");
    console.log("   Impresiones:", impressionsUrl.replace(tokenToUse, "***"));
    console.log("   Fans:", fansUrl.replace(tokenToUse, "***"));

    const [impRes, fansRes] = await Promise.all([
      fetch(impressionsUrl),
      fetch(fansUrl)
    ]);

    const impData = await impRes.json();
    const fansData = await fansRes.json();

    // Verificación de errores granular
    if (impData.error) {
      const errorCode = impData.error.code;
      const errorMessage = impData.error.message;

      console.error("❌ Error en Impresiones:", impData.error);

      // Si es error #100, significa que las métricas no están disponibles
      if (errorCode === 100) {
        throw new InsufficientPermissionsError(
          `Las métricas de Insights no están disponibles para esta página. Error: ${errorMessage}. Verifica que la página tenga habilitados los Insights y que el token tenga el permiso 'read_insights'.`
        );
      }

      if (errorCode === 190 || errorCode === 102) {
        throw new TokenExpiredError(
          `Token caducado o inválido: ${errorMessage}. Por favor, reconecta tu cuenta de Facebook.`
        );
      }

      if (errorCode === 200) {
        throw new InsufficientPermissionsError(
          `Permisos insuficientes: ${errorMessage}. Verifica que la página tenga los permisos necesarios.`
        );
      }

      // Para otros errores, continuamos con fans
      console.warn("⚠️ Error al obtener impresiones, continuando con fans si están disponibles:", errorMessage);
    }
    
    if (fansData.error) {
      const errorCode = fansData.error.code;
      const errorMessage = fansData.error.message;

      console.error("❌ Error en Fans:", fansData.error);

      // Si es error #100, significa que las métricas no están disponibles
      if (errorCode === 100) {
        // Si ya tuvimos error #100 en impresiones, lanzamos el error
        if (impData.error?.code === 100) {
          throw new InsufficientPermissionsError(
            `Las métricas de Insights no están disponibles para esta página. Error: ${errorMessage}. Verifica que la página tenga habilitados los Insights y que el token tenga el permiso 'read_insights'.`
          );
        }
        // Si solo fans falla con #100, continuamos con impresiones
        console.warn("⚠️ Error #100 en fans, continuando con impresiones si están disponibles:", errorMessage);
      } else if (errorCode === 190 || errorCode === 102) {
        throw new TokenExpiredError(
          `Token caducado o inválido: ${errorMessage}. Por favor, reconecta tu cuenta de Facebook.`
        );
      } else if (errorCode === 200) {
        throw new InsufficientPermissionsError(
          `Permisos insuficientes: ${errorMessage}. Verifica que la página tenga los permisos necesarios.`
        );
      } else {
        console.warn("⚠️ Error al obtener fans, continuando con impresiones si están disponibles:", errorMessage);
      }
    }

    // Combinar resultados válidos
    const combinedData = [
      ...(impData.data || []),
      ...(fansData.data || [])
    ];

    if (combinedData.length === 0) {
      throw new InsufficientPermissionsError(
        "No se pudieron obtener métricas válidas de Meta. Verifica que la página tenga habilitados los Insights y que el token tenga el permiso 'read_insights'."
      );
    }

    console.log("✅ [Meta Fetch] Éxito. Datos recibidos:", combinedData.length, "métricas");

    return { data: combinedData };

  } catch (error) {
    // Re-lanzar errores específicos
    if (error instanceof TokenExpiredError || error instanceof InsufficientPermissionsError) {
      throw error;
    }

    console.error("🚨 [Meta Service Critical]:", error);

    // Manejar errores de red u otros
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Error desconocido al obtener métricas");
  }
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

