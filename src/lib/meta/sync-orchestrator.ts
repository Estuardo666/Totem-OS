/**
 * Orquestador de sincronización de métricas sociales.
 *
 * Vive fuera de los Server Actions porque también lo usa el cron, que corre
 * sin sesión de usuario. La autorización es responsabilidad de quien llama:
 * el Server Action la exige, el cron se autentica con CRON_SECRET.
 */

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";
import { revalidatePath } from "next/cache";
import {
  fetchPageMetrics,
  fetchPagePosts,
  transformMetricsForStorage,
  TokenExpiredError,
  InsufficientPermissionsError,
  type StoredMetricRow,
} from "./metrics-service.ts";
import {
  fetchInstagramDailyTotals,
  fetchInstagramDemographics,
  fetchInstagramFollowerCount,
  fetchInstagramMetrics,
  fetchInstagramTopMedia,
  transformDemographicsForStorage,
} from "./instagram-service.ts";
import {
  fetchAdInsights,
  transformAdInsightsForStorage,
  type AdMetricRow,
} from "./ads-service.ts";
import { getAgencyToken, readPageToken } from "./token-store.ts";
import { getValidTikTokToken } from "../tiktok/token-store.ts";
import {
  fetchTikTokProfileStats,
  fetchTikTokVideos,
  transformTikTokForStorage,
} from "../tiktok/metrics-service.ts";
import type {
  PlatformSyncResult,
  SyncOptions,
  SyncPlatform,
  SyncSummary,
} from "./sync-types.ts";

/**
 * Persiste filas orgánicas en ClientMetric.
 *
 * Un único INSERT ... ON CONFLICT por lote en vez de un upsert por fila: con
 * la base en Neon, cada ida y vuelta cuesta ~100 ms y una sincronización
 * ampliada escribe medio millar de filas. Fila por fila eso eran más de 50
 * segundos por cliente, y el cron tiene 300 s para toda la cartera.
 */
async function persistOrganicMetrics(rows: StoredMetricRow[]): Promise<number> {
  const BATCH_SIZE = 200;
  const fetchedAt = new Date();

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map(
      (metric) =>
        Prisma.sql`(${randomUUID()}, ${metric.clientId}, ${metric.platform}, ${metric.metricName}, ${metric.value}, ${metric.date}, ${fetchedAt})`
    );

    await db.$executeRaw`
      INSERT INTO "ClientMetric" ("id", "clientId", "platform", "metricName", "value", "date", "fetchedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("clientId", "platform", "metricName", "date")
      DO UPDATE SET "value" = EXCLUDED."value", "fetchedAt" = EXCLUDED."fetchedAt"
    `;
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

/** Fila de rendimiento por publicación, lista para `ClientMediaMetric`. */
interface MediaMetricRow {
  clientId: string;
  platform: string;
  mediaId: string;
  mediaType: string;
  productType: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  publishedAt: Date;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  clicks: number;
  profileVisits: number;
  follows: number;
  interactions: number;
}

/**
 * Persiste el rendimiento por publicación.
 *
 * Upsert por `(clientId, platform, mediaId)`: una publicación sigue acumulando
 * alcance e interacciones durante días, así que cada corrida actualiza la fila
 * existente en vez de crear una nueva. En un solo statement por lote, por la
 * misma razón que las métricas orgánicas.
 */
async function persistMediaMetrics(rows: MediaMetricRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const BATCH_SIZE = 100;
  const fetchedAt = new Date();

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map(
      (row) =>
        Prisma.sql`(${randomUUID()}, ${row.clientId}, ${row.platform}, ${row.mediaId}, ${row.mediaType}, ${row.productType}, ${row.permalink}, ${row.thumbnailUrl}, ${row.caption}, ${row.publishedAt}, ${row.reach}, ${row.views}, ${row.likes}, ${row.comments}, ${row.saves}, ${row.shares}, ${row.clicks}, ${row.profileVisits}, ${row.follows}, ${row.interactions}, ${fetchedAt})`
    );

    await db.$executeRaw`
      INSERT INTO "ClientMediaMetric" (
        "id", "clientId", "platform", "mediaId", "mediaType", "productType", "permalink",
        "thumbnailUrl", "caption", "publishedAt", "reach", "views", "likes", "comments",
        "saves", "shares", "clicks", "profileVisits", "follows", "interactions", "fetchedAt"
      )
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("clientId", "platform", "mediaId")
      DO UPDATE SET
        "mediaType" = EXCLUDED."mediaType",
        "productType" = EXCLUDED."productType",
        "permalink" = EXCLUDED."permalink",
        "thumbnailUrl" = EXCLUDED."thumbnailUrl",
        "caption" = EXCLUDED."caption",
        "publishedAt" = EXCLUDED."publishedAt",
        "reach" = EXCLUDED."reach",
        "views" = EXCLUDED."views",
        "likes" = EXCLUDED."likes",
        "comments" = EXCLUDED."comments",
        "saves" = EXCLUDED."saves",
        "shares" = EXCLUDED."shares",
        "clicks" = EXCLUDED."clicks",
        "profileVisits" = EXCLUDED."profileVisits",
        "follows" = EXCLUDED."follows",
        "interactions" = EXCLUDED."interactions",
        "fetchedAt" = EXCLUDED."fetchedAt"
    `;
  }

  return rows.length;
}

/**
 * Sincroniza las métricas de Facebook de un cliente.
 * Aislada para que el dispatcher pueda capturar su fallo sin tumbar el resto.
 */
async function syncFacebook(
  clientId: string,
  facebookPageId: string,
  pageAccessToken: string,
  days: number,
  mediaLimit: number
): Promise<number> {
  const metricsData = await fetchPageMetrics(facebookPageId, pageAccessToken, days);
  const rows = transformMetricsForStorage(metricsData, clientId, "FACEBOOK");
  let count = rows.length > 0 ? await persistOrganicMetrics(rows) : 0;

  // Las publicaciones son complementarias: un fallo aquí no puede perder los
  // insights de página que ya se guardaron.
  if (mediaLimit > 0) {
    try {
      const posts = await fetchPagePosts(facebookPageId, pageAccessToken, mediaLimit);
      const mediaRows: MediaMetricRow[] = posts.map((post) => ({
        clientId,
        platform: "FACEBOOK",
        mediaId: post.id,
        mediaType: "POST",
        productType: "FEED",
        permalink: post.permalink || null,
        thumbnailUrl: post.thumbnailUrl,
        caption: post.message || null,
        publishedAt: post.publishedAt,
        reach: 0, // Meta ya no expone alcance por publicación de página.
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        saves: 0,
        shares: post.shares,
        clicks: post.clicks,
        profileVisits: 0,
        follows: 0,
        interactions: post.likes + post.comments + post.shares,
      }));
      if (mediaRows.length > 0) count += await persistMediaMetrics(mediaRows);
    } catch (error) {
      console.warn("[Sync] Facebook: no se pudieron leer las publicaciones:", error);
    }
  }

  return count;
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
  days: number,
  totalsDays: number,
  mediaLimit: number
): Promise<number> {
  const metricsData = await fetchInstagramMetrics(igUserId, pageAccessToken, days);
  const rows = transformMetricsForStorage(metricsData, clientId, "INSTAGRAM");

  // Métricas de valor total, día por día. Sin esto no habría serie: Graph las
  // entrega como un único número por ventana.
  try {
    rows.push(
      ...(await fetchInstagramDailyTotals(igUserId, pageAccessToken, clientId, totalsDays))
    );
  } catch (error) {
    console.warn("[Sync] Instagram: no se pudieron leer los totales diarios:", error);
  }

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

  // Demografía de la audiencia. Meta exige un mínimo de seguidores; por debajo
  // responde "Not enough users" y el servicio devuelve una lista vacía.
  try {
    const demographics = await fetchInstagramDemographics(igUserId, pageAccessToken);
    rows.push(...transformDemographicsForStorage(demographics, clientId));
  } catch (error) {
    console.warn("[Sync] Instagram: no se pudo leer la demografía:", error);
  }

  let count = rows.length > 0 ? await persistOrganicMetrics(rows) : 0;

  if (mediaLimit > 0) {
    try {
      const media = await fetchInstagramTopMedia(igUserId, pageAccessToken, mediaLimit);
      const mediaRows: MediaMetricRow[] = media.map((item) => ({
        clientId,
        platform: "INSTAGRAM",
        mediaId: item.id,
        mediaType: item.mediaType,
        productType: item.productType,
        permalink: item.permalink || null,
        thumbnailUrl: item.thumbnailUrl,
        caption: item.caption || null,
        publishedAt: item.publishedAt,
        reach: item.reach,
        views: item.views,
        likes: item.likes,
        comments: item.comments,
        saves: item.saves,
        shares: item.shares,
        clicks: 0,
        profileVisits: item.profileVisits,
        follows: item.follows,
        interactions: item.interactions,
      }));
      if (mediaRows.length > 0) count += await persistMediaMetrics(mediaRows);
    } catch (error) {
      console.warn("[Sync] Instagram: no se pudieron leer las publicaciones:", error);
    }
  }

  return count;
}

/**
 * Sincroniza las métricas orgánicas de TikTok.
 *
 * La Display API no expone serie histórica, solo totales actuales, así que
 * esto guarda un snapshot fechado hoy. Los deltas se calculan al leer,
 * diferenciando snapshots de días consecutivos — y por eso conviene empezar a
 * recolectar aunque el informe llegue después: lo que no se guarde hoy no se
 * puede recuperar mañana.
 */
async function syncTikTok(clientId: string): Promise<number> {
  const token = await getValidTikTokToken();
  const stats = await fetchTikTokProfileStats(token);

  // Los videos son complementarios: si fallan, el snapshot del perfil igual
  // debe guardarse.
  let videos: Awaited<ReturnType<typeof fetchTikTokVideos>> = [];
  try {
    videos = await fetchTikTokVideos(token, 20);
  } catch (error) {
    console.warn("[Sync] TikTok: no se pudieron leer los videos:", error);
  }

  const rows = transformTikTokForStorage(stats, videos, clientId);
  if (rows.length === 0) return 0;
  return persistOrganicMetrics(rows);
}

/**
 * Persiste filas de métricas publicitarias, con el mismo upsert en lote que
 * las orgánicas: una campaña por día durante 90 días son cientos de filas.
 */
async function persistAdMetrics(rows: AdMetricRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const BATCH_SIZE = 100;
  const fetchedAt = new Date();

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map(
      (row) =>
        Prisma.sql`(${randomUUID()}, ${row.clientId}, ${row.platform}, ${row.adAccountId}, ${row.campaignId}, ${row.campaignName}, ${row.date}, ${row.spend}, ${row.impressions}, ${row.reach}, ${row.clicks}, ${row.frequency}, ${row.conversions}, ${row.conversionValue}, ${row.currency}, ${row.objective}, ${row.actionsJson}, ${fetchedAt})`
    );

    await db.$executeRaw`
      INSERT INTO "ClientAdMetric" (
        "id", "clientId", "platform", "adAccountId", "campaignId", "campaignName", "date",
        "spend", "impressions", "reach", "clicks", "frequency", "conversions",
        "conversionValue", "currency", "objective", "actionsJson", "fetchedAt"
      )
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("clientId", "platform", "adAccountId", "campaignId", "date")
      DO UPDATE SET
        "campaignName" = EXCLUDED."campaignName",
        "spend" = EXCLUDED."spend",
        "impressions" = EXCLUDED."impressions",
        "reach" = EXCLUDED."reach",
        "clicks" = EXCLUDED."clicks",
        "frequency" = EXCLUDED."frequency",
        "conversions" = EXCLUDED."conversions",
        "conversionValue" = EXCLUDED."conversionValue",
        "currency" = EXCLUDED."currency",
        "objective" = EXCLUDED."objective",
        "actionsJson" = EXCLUDED."actionsJson",
        "fetchedAt" = EXCLUDED."fetchedAt"
    `;
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
  // Corto por defecto: cada día extra son 28 peticiones más contra el mismo
  // token. Un backfill manual lo sube explícitamente.
  const totalsDays = options.totalsDays ?? 3;
  const mediaLimit = options.mediaLimit ?? 25;

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
              days,
              mediaLimit
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
              days,
              totalsDays,
              mediaLimit
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
            const count = await syncTikTok(clientId);
            results.push({
              platform,
              status: "OK",
              count,
              durationMs: Date.now() - startedAt,
            });
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

    // Fuera de una petición de Next —un script de backfill, por ejemplo— esta
    // llamada lanza "static generation store missing". Los datos ya están
    // guardados a estas alturas, así que no puede tumbar la corrida.
    try {
      revalidatePath(`/clients/${clientId}`);
    } catch {
      // Sin contexto de petición no hay caché que invalidar.
    }

    return { success: true, data: { total, results } };
  } catch (error) {
    console.error("Error al sincronizar métricas:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al sincronizar métricas",
    };
  }
}
