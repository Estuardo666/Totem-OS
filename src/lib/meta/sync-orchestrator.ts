/**
 * Orquestador de sincronización de métricas sociales.
 *
 * Vive fuera de los Server Actions porque también lo usa el cron, que corre
 * sin sesión de usuario. La autorización es responsabilidad de quien llama:
 * el Server Action la exige, el cron se autentica con CRON_SECRET.
 */

import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";
import { revalidatePath } from "next/cache";
import {
  fetchPageMetrics,
  transformMetricsForStorage,
  TokenExpiredError,
  InsufficientPermissionsError,
} from "./metrics-service.ts";
import {
  fetchInstagramFollowerCount,
  fetchInstagramMetrics,
} from "./instagram-service.ts";
import {
  fetchAdInsights,
  transformAdInsightsForStorage,
  type AdMetricRow,
} from "./ads-service.ts";
import { getAgencyToken, readPageToken } from "./token-store.ts";
import type {
  PlatformSyncResult,
  SyncOptions,
  SyncPlatform,
  SyncSummary,
} from "./sync-types.ts";

/**
 * Persiste filas orgánicas en ClientMetric.
 * Trocea en lotes para no sostener una transacción enorme contra el pooler.
 */
async function persistOrganicMetrics(
  rows: Array<{
    clientId: string;
    platform: string;
    metricName: string;
    value: number;
    date: Date;
  }>
): Promise<number> {
  const BATCH_SIZE = 200;
  const fetchedAt = new Date();

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.$transaction(
      batch.map((metric) =>
        db.clientMetric.upsert({
          where: {
            clientId_platform_metricName_date: {
              clientId: metric.clientId,
              platform: metric.platform,
              metricName: metric.metricName,
              date: metric.date,
            },
          },
          update: {
            value: metric.value,
            fetchedAt,
          },
          create: {
            clientId: metric.clientId,
            platform: metric.platform,
            metricName: metric.metricName,
            value: metric.value,
            date: metric.date,
            fetchedAt,
          },
        })
      )
    );
  }

  return rows.length;
}

/**
 * Traduce un error de plataforma a un motivo legible en español.
 * Nunca re-lanza: el contrato del dispatcher es que un fallo de una plataforma
 * no puede impedir que las demás guarden sus datos.
 */
function describeSyncError(error: unknown): string {
  if (error instanceof TokenExpiredError) return error.message;
  if (error instanceof InsufficientPermissionsError) return error.message;
  if (error instanceof Error) {
    if (error.message.includes("Meta API Timeout") || error.name === "TimeoutError") {
      return "La API tardó demasiado en responder. Intenta de nuevo en unos minutos.";
    }
    return error.message;
  }
  return "Error desconocido al sincronizar.";
}

/**
 * Sincroniza las métricas de Facebook de un cliente.
 * Aislada para que el dispatcher pueda capturar su fallo sin tumbar el resto.
 */
async function syncFacebook(
  clientId: string,
  facebookPageId: string,
  pageAccessToken: string,
  days: number
): Promise<number> {
  const metricsData = await fetchPageMetrics(facebookPageId, pageAccessToken, days);
  const rows = transformMetricsForStorage(metricsData, clientId, "FACEBOOK");
  if (rows.length === 0) return 0;
  return persistOrganicMetrics(rows);
}

/**
 * Sincroniza las métricas orgánicas de Instagram Business de un cliente.
 *
 * Además de los insights, guarda el total de seguidores como una fila diaria
 * `followers_count` fechada hoy a medianoche UTC. Graph no da serie histórica
 * de ese número, así que se acumula un snapshot por día.
 */
async function syncInstagram(
  clientId: string,
  igUserId: string,
  pageAccessToken: string,
  days: number
): Promise<number> {
  const metricsData = await fetchInstagramMetrics(igUserId, pageAccessToken, days);
  const rows = transformMetricsForStorage(metricsData, clientId, "INSTAGRAM");

  // Snapshot de seguidores: un valor por día, no una serie que Graph no expone.
  try {
    const followers = await fetchInstagramFollowerCount(igUserId, pageAccessToken);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    rows.push({
      clientId,
      platform: "INSTAGRAM",
      metricName: "followers_count",
      value: followers,
      date: today,
    });
  } catch (error) {
    // El conteo de seguidores es complementario: si falla, los insights
    // igual se guardan.
    console.warn("[Sync] Instagram: no se pudo leer followers_count:", error);
  }

  if (rows.length === 0) return 0;
  return persistOrganicMetrics(rows);
}

/**
 * Persiste filas de métricas publicitarias, troceadas igual que las orgánicas.
 */
async function persistAdMetrics(rows: AdMetricRow[]): Promise<number> {
  const BATCH_SIZE = 200;
  const fetchedAt = new Date();

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.$transaction(
      batch.map((row) =>
        db.clientAdMetric.upsert({
          where: {
            clientId_platform_adAccountId_campaignId_date: {
              clientId: row.clientId,
              platform: row.platform,
              adAccountId: row.adAccountId,
              campaignId: row.campaignId,
              date: row.date,
            },
          },
          update: {
            campaignName: row.campaignName,
            spend: row.spend,
            impressions: row.impressions,
            reach: row.reach,
            clicks: row.clicks,
            frequency: row.frequency,
            conversions: row.conversions,
            conversionValue: row.conversionValue,
            currency: row.currency,
            objective: row.objective,
            actionsJson: row.actionsJson,
            fetchedAt,
          },
          create: { ...row, fetchedAt },
        })
      )
    );
  }

  return rows.length;
}

/**
 * Convierte una fecha a `YYYY-MM-DD`.
 *
 * Meta interpreta estas fechas en la zona horaria de la cuenta publicitaria,
 * no en UTC. Por eso se usan los componentes locales: convertir a ISO/UTC
 * correría el borde del período un día en husos negativos como el de Ecuador.
 */
function toAdsDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Sincroniza las métricas de todas las cuentas publicitarias de un cliente.
 *
 * Una cuenta inaccesible (revocada, deshabilitada) no puede impedir que las
 * demás se sincronicen, así que cada una corre aislada. Solo si TODAS fallan
 * se propaga el error, porque entonces sí hay un problema real de conexión.
 */
async function syncMetaAds(
  clientId: string,
  adAccounts: Array<{ adAccountId: string; name: string }>,
  accessToken: string,
  since: Date,
  until: Date
): Promise<{ count: number; failures: string[] }> {
  const sinceStr = toAdsDateString(since);
  const untilStr = toAdsDateString(until);

  let count = 0;
  const failures: string[] = [];

  for (const account of adAccounts) {
    try {
      const insights = await fetchAdInsights(account.adAccountId, accessToken, {
        since: sinceStr,
        until: untilStr,
        level: "campaign",
      });
      const rows = transformAdInsightsForStorage(
        insights,
        clientId,
        account.adAccountId
      );
      if (rows.length > 0) {
        count += await persistAdMetrics(rows);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`[Sync] Meta Ads "${account.name}": ${reason}`);
      failures.push(`${account.name}: ${reason}`);
    }
  }

  if (failures.length === adAccounts.length && adAccounts.length > 0) {
    throw new Error(failures.join(" | "));
  }

  return { count, failures };
}

/**
 * Sincroniza las métricas sociales de un cliente, plataforma por plataforma.
 *
 * Cada plataforma corre aislada en su propio try/catch y contribuye una entrada
 * al resultado. Un fallo de Instagram no impide que Facebook guarde sus filas.
 *
 * Es secuencial a propósito: varias llamadas concurrentes sobre el mismo token
 * multiplican el golpe al rate limit de Meta sin ganancia de reloj que lo valga,
 * y mantiene analizable el presupuesto de 300s de la función serverless.
 */
export async function runClientSync(
  clientId: string,
  options: SyncOptions = {}
): Promise<ApiResponse<SyncSummary>> {
  const days = options.days ?? 28;

  try {
    // 1. Cargar credenciales del cliente
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        facebookPageId: true,
        pageAccessToken: true,
        instagramBusinessId: true,
        tiktokOpenId: true,
        adAccounts: {
          where: { isActive: true, platform: "META_ADS" },
          select: { adAccountId: true, name: true },
        },
      },
    });

    if (!client) {
      return { success: false, error: "Cliente no encontrado" };
    }

    // Los tokens se guardan cifrados; los servicios de Graph esperan texto plano.
    const pageAccessToken = client.pageAccessToken
      ? readPageToken(client.pageAccessToken)
      : null;

    // 2. Resolver plataformas objetivo
    const requested: SyncPlatform[] = options.platforms ?? [
      "FACEBOOK",
      "INSTAGRAM",
      "META_ADS",
      "TIKTOK",
    ];

    console.log(
      `[Sync] Cliente "${client.name}" (${clientId}) | plataformas: ${requested.join(", ")}`
    );

    const results: PlatformSyncResult[] = [];

    // 3. Recorrer secuencialmente, cada plataforma aislada
    for (const platform of requested) {
      const startedAt = Date.now();

      const skip = (reason: string) => {
        results.push({
          platform,
          status: "SKIPPED",
          count: 0,
          reason,
          durationMs: Date.now() - startedAt,
        });
      };

      try {
        switch (platform) {
          case "FACEBOOK": {
            if (!client.facebookPageId || !pageAccessToken) {
              skip("Sin página de Facebook vinculada.");
              break;
            }
            const count = await syncFacebook(
              clientId,
              client.facebookPageId,
              pageAccessToken,
              days
            );
            results.push({
              platform,
              status: "OK",
              count,
              durationMs: Date.now() - startedAt,
            });
            break;
          }

          case "INSTAGRAM": {
            if (!client.instagramBusinessId || !pageAccessToken) {
              skip("Sin cuenta de Instagram Business vinculada.");
              break;
            }
            const count = await syncInstagram(
              clientId,
              client.instagramBusinessId,
              pageAccessToken,
              days
            );
            results.push({
              platform,
              status: "OK",
              count,
              durationMs: Date.now() - startedAt,
            });
            break;
          }

          case "META_ADS": {
            if (client.adAccounts.length === 0) {
              skip("Sin cuentas publicitarias vinculadas.");
              break;
            }

            // Los insights de anuncios usan el token de USUARIO de la agencia,
            // no el token de página: el permiso ads_read vive en el usuario.
            const agency = await getAgencyToken();
            if (!agency) {
              skip("No hay una cuenta de Meta conectada en la agencia.");
              break;
            }

            const until = options.until ?? new Date();
            const since =
              options.since ??
              new Date(until.getTime() - (days - 1) * 86400 * 1000);

            const { count, failures } = await syncMetaAds(
              clientId,
              client.adAccounts,
              agency.accessToken,
              since,
              until
            );

            results.push({
              platform,
              status: "OK",
              count,
              // Éxito parcial: algunas cuentas fallaron pero otras guardaron.
              reason: failures.length > 0 ? failures.join(" | ") : undefined,
              durationMs: Date.now() - startedAt,
            });
            break;
          }

          case "TIKTOK": {
            if (!client.tiktokOpenId) {
              skip("Sin cuenta de TikTok vinculada.");
              break;
            }
            // Implementado en la Fase 6.
            skip("Integración de TikTok aún no disponible.");
            break;
          }
        }
      } catch (error) {
        const reason = describeSyncError(error);
        console.error(`[Sync] ❌ ${platform}: ${reason}`);
        results.push({
          platform,
          status: "ERROR",
          count: 0,
          reason,
          durationMs: Date.now() - startedAt,
        });
      }
    }

    const total = results.reduce((sum, r) => sum + r.count, 0);
    console.log(
      `[Sync] ✅ ${client.name}: ${total} filas | ` +
        results.map((r) => `${r.platform}=${r.status}`).join(" ")
    );

    revalidatePath(`/clients/${clientId}`);

    return { success: true, data: { total, results } };
  } catch (error) {
    console.error("Error al sincronizar métricas:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al sincronizar métricas",
    };
  }
}
