/**
 * Agregador del panel de analítica de un cliente.
 *
 * Vive en lib y no en un Server Action porque lo consumen el panel de la ficha
 * y el panel global de agencia. Sigue el mismo patrón que
 * `buildSocialReportData`: una consulta por fuente cubriendo período actual y
 * anterior, y toda la agregación en memoria.
 */

import { db } from "@/lib/db";
import {
  computeAdEfficiency,
  delta,
  groupByCurrency,
  shareOfSpend,
  sumAdTotals,
  type AdEfficiency,
  type DeltaPct,
} from "@/lib/reports/social-report-math";
import {
  adSaturation,
  communityGrowthRate,
  costPerInteraction,
  engagementRateByFollowers,
  engagementRateByReach,
  healthLabel,
  healthScore,
  interactionsPerPost,
  netFollowers,
  organicShare,
  profileConversionRate,
  projectToMonthEnd,
  publishingConsistency,
  reachPerPost,
  saveRate,
  totalCostPerResult,
  viralityIndex,
} from "./derived-metrics.ts";
import {
  AUDIENCE_DIMENSIONS,
  ENGAGEMENT_METRICS,
  FOLLOWER_METRICS,
  FOLLOWS_GAINED_METRICS,
  FOLLOWS_LOST_METRICS,
  LINK_CLICK_METRICS,
  PLATFORM_LABELS,
  PROFILE_VIEW_METRICS,
  REACH_METRICS,
  SAVE_METRICS,
  SHARE_METRICS,
  VIDEO_VIEW_METRICS,
  VIEW_METRICS,
  parseAudienceMetric,
  type ReportPlatform,
} from "./metric-names.ts";

/** Ventanas que ofrece el selector del panel. */
export const ANALYTICS_PERIODS = [7, 28, 90] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export function normalizePeriod(value: unknown): AnalyticsPeriod {
  const parsed = Number(value);
  return (ANALYTICS_PERIODS as readonly number[]).includes(parsed)
    ? (parsed as AnalyticsPeriod)
    : 28;
}

export interface PlatformAnalytics {
  platform: ReportPlatform;
  label: string;
  connected: boolean;
  hasData: boolean;

  reach: number;
  views: number;
  engagement: number;
  followers: number;
  profileViews: number;
  linkClicks: number;
  followsGained: number;
  followsLost: number;
  shares: number;
  saves: number;
  videoViews: number;

  reachDelta: DeltaPct;
  engagementDelta: DeltaPct;
  followersDelta: DeltaPct;

  /** Serie diaria de alcance, para el gráfico de tendencia. */
  series: Array<{ date: string; value: number }>;

  derived: {
    engagementRateByReach: number | null;
    engagementRateByFollowers: number | null;
    growthRate: number | null;
    netFollowers: number;
    virality: number | null;
    saveRate: number | null;
    profileConversion: number | null;
  };
}

export interface MediaRow {
  mediaId: string;
  platform: string;
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
  interactions: number;
  /** ER sobre alcance; cae a views cuando la plataforma no da alcance. */
  engagementRate: number | null;
}

export interface CampaignRow {
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpa: number | null;
  roas: number | null;
  share: number;
}

export interface AdsAnalytics {
  connected: boolean;
  hasData: boolean;
  byCurrency: Array<{
    currency: string;
    totals: AdEfficiency;
    spendDelta: DeltaPct;
    campaigns: CampaignRow[];
    spendByDay: Array<{ date: string; value: number }>;
    saturation: number | null;
    totalCostPerResult: number | null;
  }>;
  attributionWindow: string;
}

export interface AudienceBreakdown {
  dimension: string;
  label: string;
  total: number;
  entries: Array<{ key: string; value: number; share: number }>;
}

export interface ClientAnalytics {
  client: { id: string; name: string; logo: string | null; monthlyRate: number };
  period: {
    days: number;
    start: Date;
    end: Date;
    previousStart: Date;
    previousEnd: Date;
    label: string;
    previousLabel: string;
  };
  headline: {
    reach: DeltaPct;
    engagement: DeltaPct;
    followers: DeltaPct;
    adSpend: DeltaPct;
    currency: string | null;
  };
  derived: {
    engagementRate: number | null;
    engagementRatePrevious: number | null;
    growthRate: number | null;
    netFollowers: number;
    virality: number | null;
    saveRate: number | null;
    profileConversion: number | null;
    reachPerPost: number | null;
    interactionsPerPost: number | null;
    consistency: number | null;
    costPerInteraction: number | null;
    organicShare: number | null;
    adSaturation: number | null;
    totalCostPerResult: number | null;
    projectedMonthlyReach: number | null;
    healthScore: number | null;
    healthLabel: string;
  };
  trend: Array<{ date: string; facebook: number; instagram: number; tiktok: number }>;
  platforms: PlatformAnalytics[];
  media: MediaRow[];
  ads: AdsAnalytics;
  audience: AudienceBreakdown[];
  content: { published: number; reels: number; flyers: number; daysWithPosts: number };
  dataQuality: Array<{ label: string; detail: string }>;
  generatedAt: Date;
}

interface MetricRow {
  platform: string;
  metricName: string;
  value: number;
  date: Date;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function sumMetrics(rows: MetricRow[], platform: ReportPlatform, names: string[]): number {
  if (names.length === 0) return 0;
  return rows
    .filter((r) => r.platform === platform && names.includes(r.metricName))
    .reduce((sum, r) => sum + r.value, 0);
}

/**
 * Último valor de una métrica snapshot (seguidores).
 * Sumarlos daría un número absurdo: 28 días de "1.200 seguidores" no son 33.600.
 */
function latestMetric(rows: MetricRow[], platform: ReportPlatform, names: string[]): number {
  if (names.length === 0) return 0;
  const matching = rows
    .filter((r) => r.platform === platform && names.includes(r.metricName))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  return matching[0]?.value ?? 0;
}

/** Primer valor del período: la base contra la que se mide el crecimiento. */
function earliestMetric(rows: MetricRow[], platform: ReportPlatform, names: string[]): number {
  if (names.length === 0) return 0;
  const matching = rows
    .filter((r) => r.platform === platform && names.includes(r.metricName))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return matching[0]?.value ?? 0;
}

function dailySeries(rows: MetricRow[], platform: ReportPlatform, names: string[]) {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    if (row.platform !== platform || !names.includes(row.metricName)) continue;
    const key = isoDay(row.date);
    byDay.set(key, (byDay.get(key) ?? 0) + row.value);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

/**
 * Construye el panel de analítica de un cliente para una ventana de días.
 *
 * `days` cubre el período actual; el anterior es la ventana equivalente que
 * termina justo donde empieza éste, para que la comparación sea de igual a
 * igual (7 contra 7, no 7 contra el mes).
 */
export async function buildClientAnalytics(
  clientId: string,
  days: number = 28
): Promise<ClientAnalytics | null> {
  const periodDays = normalizePeriod(days);

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      logo: true,
      monthlyRate: true,
      facebookPageId: true,
      instagramBusinessId: true,
      tiktokOpenId: true,
      adAccounts: { where: { isActive: true }, select: { adAccountId: true } },
    },
  });

  if (!client) return null;

  const end = new Date();
  const start = startOfUtcDay(new Date(end.getTime() - (periodDays - 1) * 86400_000));
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = startOfUtcDay(new Date(previousEnd.getTime() - (periodDays - 1) * 86400_000));

  const [metrics, adMetrics, media, tasks] = await Promise.all([
    db.clientMetric.findMany({
      where: { clientId, date: { gte: previousStart, lte: end } },
      select: { platform: true, metricName: true, value: true, date: true },
    }),
    db.clientAdMetric.findMany({
      where: { clientId, date: { gte: previousStart, lte: end } },
      select: {
        campaignId: true,
        campaignName: true,
        date: true,
        spend: true,
        impressions: true,
        reach: true,
        clicks: true,
        conversions: true,
        conversionValue: true,
        currency: true,
      },
    }),
    db.clientMediaMetric.findMany({
      where: { clientId, publishedAt: { gte: start, lte: end } },
      orderBy: { publishedAt: "desc" },
      take: 50,
    }),
    db.contentTask.findMany({
      where: { clientId, publishedAt: { gte: start, lte: end }, status: "PUBLISHED" },
      select: { type: true, publishedAt: true },
    }),
  ]);

  const inCurrent = <T extends { date: Date }>(row: T) => row.date >= start && row.date <= end;
  const inPrevious = <T extends { date: Date }>(row: T) =>
    row.date >= previousStart && row.date <= previousEnd;

  const currentMetrics = metrics.filter(inCurrent);
  const previousMetrics = metrics.filter(inPrevious);

  // --- Plataformas ---
  const platformConfig: Array<{ platform: ReportPlatform; connected: boolean }> = [
    { platform: "FACEBOOK", connected: Boolean(client.facebookPageId) },
    { platform: "INSTAGRAM", connected: Boolean(client.instagramBusinessId) },
    { platform: "TIKTOK", connected: Boolean(client.tiktokOpenId) },
  ];

  const platforms: PlatformAnalytics[] = platformConfig.map(({ platform, connected }) => {
    const reach = sumMetrics(currentMetrics, platform, REACH_METRICS[platform]);
    const prevReach = sumMetrics(previousMetrics, platform, REACH_METRICS[platform]);
    const views = sumMetrics(currentMetrics, platform, VIEW_METRICS[platform]);
    const engagement = sumMetrics(currentMetrics, platform, ENGAGEMENT_METRICS[platform]);
    const prevEngagement = sumMetrics(previousMetrics, platform, ENGAGEMENT_METRICS[platform]);
    const followers = latestMetric(currentMetrics, platform, FOLLOWER_METRICS[platform]);
    const followersStart = earliestMetric(currentMetrics, platform, FOLLOWER_METRICS[platform]);
    const prevFollowers = latestMetric(previousMetrics, platform, FOLLOWER_METRICS[platform]);
    const profileViews = sumMetrics(currentMetrics, platform, PROFILE_VIEW_METRICS[platform]);
    const linkClicks = sumMetrics(currentMetrics, platform, LINK_CLICK_METRICS[platform]);
    const followsGained = sumMetrics(currentMetrics, platform, FOLLOWS_GAINED_METRICS[platform]);
    const followsLost = sumMetrics(currentMetrics, platform, FOLLOWS_LOST_METRICS[platform]);
    const shares = sumMetrics(currentMetrics, platform, SHARE_METRICS[platform]);
    const saves = sumMetrics(currentMetrics, platform, SAVE_METRICS[platform]);
    const videoViews = sumMetrics(currentMetrics, platform, VIDEO_VIEW_METRICS[platform]);

    const series = dailySeries(currentMetrics, platform, REACH_METRICS[platform]);

    return {
      platform,
      label: PLATFORM_LABELS[platform],
      connected,
      hasData: series.length > 0 || reach > 0 || followers > 0,
      reach,
      views,
      engagement,
      followers,
      profileViews,
      linkClicks,
      followsGained,
      followsLost,
      shares,
      saves,
      videoViews,
      reachDelta: delta(reach, prevReach),
      engagementDelta: delta(engagement, prevEngagement),
      followersDelta: delta(followers, prevFollowers),
      series,
      derived: {
        engagementRateByReach: engagementRateByReach(engagement, reach),
        engagementRateByFollowers: engagementRateByFollowers(engagement, followers),
        // Se compara contra el primer snapshot DEL período, no contra el del
        // período anterior: así el porcentaje describe estos días exactos.
        growthRate: communityGrowthRate(followers, followersStart),
        netFollowers: netFollowers(followsGained, followsLost),
        virality: viralityIndex(shares, reach),
        saveRate: saveRate(saves, reach),
        profileConversion: profileConversionRate(linkClicks, profileViews),
      },
    };
  });

  // --- Tendencia combinada ---
  const allDays = new Set<string>();
  for (const p of platforms) for (const point of p.series) allDays.add(point.date);
  const seriesLookup = new Map(
    platforms.map((p) => [p.platform, new Map(p.series.map((s) => [s.date, s.value]))])
  );
  const trend = [...allDays].sort().map((date) => ({
    date,
    facebook: seriesLookup.get("FACEBOOK")?.get(date) ?? 0,
    instagram: seriesLookup.get("INSTAGRAM")?.get(date) ?? 0,
    tiktok: seriesLookup.get("TIKTOK")?.get(date) ?? 0,
  }));

  // --- Publicidad, separada por moneda ---
  const currentAds = adMetrics.filter(inCurrent);
  const previousAds = adMetrics.filter(inPrevious);

  const byCurrency = [...groupByCurrency(currentAds).entries()].map(([currency, rows]) => {
    const totals = computeAdEfficiency(sumAdTotals(rows));
    const prevTotals = sumAdTotals(previousAds.filter((r) => (r.currency || "USD") === currency));

    const campaignBuckets = new Map<string, typeof rows>();
    for (const row of rows) {
      const bucket = campaignBuckets.get(row.campaignId);
      if (bucket) bucket.push(row);
      else campaignBuckets.set(row.campaignId, [row]);
    }

    const campaigns: CampaignRow[] = [...campaignBuckets.entries()]
      .map(([campaignId, campaignRows]) => {
        const campaignTotals = computeAdEfficiency(sumAdTotals(campaignRows));
        return {
          campaignId,
          campaignName: campaignRows[0].campaignName,
          spend: campaignTotals.spend,
          impressions: campaignTotals.impressions,
          reach: campaignTotals.reach,
          clicks: campaignTotals.clicks,
          conversions: campaignTotals.conversions,
          conversionValue: campaignTotals.conversionValue,
          ctr: campaignTotals.ctr,
          cpc: campaignTotals.cpc,
          cpm: campaignTotals.cpm,
          cpa: campaignTotals.cpa,
          roas: campaignTotals.roas,
          share: shareOfSpend(campaignTotals.spend, totals.spend),
        };
      })
      .sort((a, b) => b.spend - a.spend);

    const spendByDay = new Map<string, number>();
    for (const row of rows) {
      const key = isoDay(row.date);
      spendByDay.set(key, (spendByDay.get(key) ?? 0) + row.spend);
    }

    return {
      currency,
      totals,
      spendDelta: delta(totals.spend, prevTotals.spend),
      campaigns,
      spendByDay: [...spendByDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value })),
      saturation: adSaturation(totals.impressions, totals.reach),
      totalCostPerResult: totalCostPerResult(
        totals.spend,
        client.monthlyRate,
        totals.conversions,
        periodDays
      ),
    };
  });

  const ads: AdsAnalytics = {
    connected: client.adAccounts.length > 0,
    hasData: currentAds.length > 0,
    byCurrency,
    attributionWindow: "7 días desde el clic, 1 día desde la visualización",
  };

  // --- Publicaciones ---
  const mediaRows: MediaRow[] = media.map((item) => ({
    mediaId: item.mediaId,
    platform: item.platform,
    mediaType: item.mediaType,
    productType: item.productType,
    permalink: item.permalink,
    thumbnailUrl: item.thumbnailUrl,
    caption: item.caption,
    publishedAt: item.publishedAt,
    reach: item.reach,
    views: item.views,
    likes: item.likes,
    comments: item.comments,
    saves: item.saves,
    shares: item.shares,
    interactions: item.interactions,
    // Facebook ya no expone alcance por publicación: ahí el denominador son
    // las visualizaciones, y la interfaz lo declara para no mezclar peras con
    // manzanas entre plataformas.
    engagementRate: engagementRateByReach(item.interactions, item.reach || item.views),
  }));

  // --- Audiencia ---
  const audienceTotals = new Map<string, Map<string, number>>();
  for (const row of currentMetrics) {
    const parsed = parseAudienceMetric(row.metricName);
    if (!parsed) continue;
    const bucket = audienceTotals.get(parsed.dimension) ?? new Map<string, number>();
    // Snapshot: el valor más reciente gana, no se acumula entre días.
    bucket.set(parsed.key, row.value);
    audienceTotals.set(parsed.dimension, bucket);
  }

  const audience: AudienceBreakdown[] = AUDIENCE_DIMENSIONS.flatMap(({ key, label }) => {
    const bucket = audienceTotals.get(key);
    if (!bucket || bucket.size === 0) return [];
    const total = [...bucket.values()].reduce((sum, value) => sum + value, 0);
    const entries = [...bucket.entries()]
      .map(([entryKey, value]) => ({
        key: entryKey,
        value,
        share: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    return [{ dimension: key, label, total, entries }];
  });

  // --- Contenido publicado ---
  // Las publicaciones reales de la plataforma mandan sobre las tareas
  // internas: una tarea sin marcar como publicada no borra un post que Meta sí
  // reporta. Las tareas se usan solo cuando no hay publicaciones sincronizadas.
  const usingMediaAsSource = mediaRows.length > 0;
  const publishedDays = new Set(
    usingMediaAsSource
      ? mediaRows.map((m) => isoDay(m.publishedAt))
      : tasks.filter((t) => t.publishedAt).map((t) => isoDay(t.publishedAt as Date))
  );
  const content = {
    published: usingMediaAsSource ? mediaRows.length : tasks.length,
    reels: tasks.filter((t) => t.type === "REEL").length,
    flyers: tasks.filter((t) => t.type === "FLYER").length,
    daysWithPosts: publishedDays.size,
  };

  // --- Totales y derivadas globales ---
  const totalReach = platforms.reduce((s, p) => s + p.reach, 0);
  const prevReach = platforms.reduce((s, p) => s + p.reachDelta.previous, 0);
  const totalEngagement = platforms.reduce((s, p) => s + p.engagement, 0);
  const prevEngagement = platforms.reduce((s, p) => s + p.engagementDelta.previous, 0);
  const totalFollowers = platforms.reduce((s, p) => s + p.followers, 0);
  const prevFollowers = platforms.reduce((s, p) => s + p.followersDelta.previous, 0);
  const totalShares = platforms.reduce((s, p) => s + p.shares, 0);
  const totalSaves = platforms.reduce((s, p) => s + p.saves, 0);
  const totalProfileViews = platforms.reduce((s, p) => s + p.profileViews, 0);
  const totalLinkClicks = platforms.reduce((s, p) => s + p.linkClicks, 0);
  const totalGained = platforms.reduce((s, p) => s + p.followsGained, 0);
  const totalLost = platforms.reduce((s, p) => s + p.followsLost, 0);

  const dominant = [...byCurrency].sort((a, b) => b.totals.spend - a.totals.spend)[0];
  const paidReach = dominant?.totals.reach ?? 0;
  const paidSpend = dominant?.totals.spend ?? 0;
  const paidConversions = dominant?.totals.conversions ?? 0;

  /**
   * ¿Hay base para comparar seguidores?
   *
   * Los seguidores son snapshots y el histórico empieza el día que se
   * sincroniza por primera vez. Si una red tiene seguidores hoy pero ninguna
   * fila en el período anterior, su cero falso dispararía un "+137%" que no
   * ocurrió. En ese caso no se compara: se declara "nuevo".
   */
  const followersComparable = platforms.every(
    (p) => p.followers === 0 || p.followersDelta.previous > 0
  );
  const followersDelta = followersComparable
    ? delta(totalFollowers, prevFollowers)
    : delta(totalFollowers, 0);
  const growthRate = followersComparable
    ? communityGrowthRate(totalFollowers, prevFollowers)
    : null;

  const reachDelta = delta(totalReach, prevReach);
  const engagementRate = engagementRateByReach(totalEngagement, totalReach);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const derived = {
    engagementRate,
    engagementRatePrevious: engagementRateByReach(prevEngagement, prevReach),
    growthRate,
    netFollowers: netFollowers(totalGained, totalLost),
    virality: viralityIndex(totalShares, totalReach),
    saveRate: saveRate(totalSaves, totalReach),
    profileConversion: profileConversionRate(totalLinkClicks, totalProfileViews),
    reachPerPost: reachPerPost(totalReach, content.published),
    interactionsPerPost: interactionsPerPost(totalEngagement, content.published),
    consistency: publishingConsistency(content.daysWithPosts, periodDays),
    costPerInteraction: costPerInteraction(client.monthlyRate, totalEngagement, periodDays),
    organicShare: organicShare(totalReach, paidReach),
    adSaturation: dominant?.saturation ?? null,
    totalCostPerResult: totalCostPerResult(
      paidSpend,
      client.monthlyRate,
      paidConversions,
      periodDays
    ),
    // Solo tiene sentido con la ventana mensual: proyectar 7 días a un mes
    // multiplicaría el ruido de una semana atípica por cuatro.
    projectedMonthlyReach:
      periodDays === 28 ? projectToMonthEnd(totalReach, periodDays, daysInMonth) : null,
    healthScore: healthScore({
      engagementRate,
      growthRate,
      consistency: publishingConsistency(content.daysWithPosts, periodDays),
      reachTrend: reachDelta.pct,
    }),
    healthLabel: "",
  };
  derived.healthLabel = healthLabel(derived.healthScore);

  // --- Calidad de datos: lo que falta no puede leerse como cero ---
  const dataQuality: Array<{ label: string; detail: string }> = [];
  for (const p of platforms) {
    if (!p.connected) {
      dataQuality.push({
        label: p.label,
        detail: "No conectado: este panel no incluye datos de esta red.",
      });
    } else if (!p.hasData) {
      dataQuality.push({
        label: p.label,
        detail: "Conectado, pero sin datos registrados en el período.",
      });
    }
  }
  if (!ads.connected) {
    dataQuality.push({ label: "Anuncios", detail: "Sin cuentas publicitarias vinculadas." });
  } else if (!ads.hasData) {
    dataQuality.push({ label: "Anuncios", detail: "Sin inversión registrada en el período." });
  }
  if (byCurrency.length > 1) {
    dataQuality.push({
      label: "Monedas",
      detail: `Hay inversión en ${byCurrency.length} monedas distintas; los totales se muestran por separado y no se suman.`,
    });
  }
  if (mediaRows.length === 0) {
    dataQuality.push({
      label: "Publicaciones",
      detail:
        "Sin publicaciones sincronizadas en el período: el alcance por publicación y la consistencia se calculan sobre las tareas internas.",
    });
  }
  if (!followersComparable) {
    dataQuality.push({
      label: "Comunidad",
      detail:
        "No hay foto de seguidores del período anterior, así que el crecimiento no se puede calcular todavía. Se resuelve solo conforme se acumulan sincronizaciones diarias.",
    });
  }
  if (audience.length === 0) {
    dataQuality.push({
      label: "Audiencia",
      detail: "Meta solo entrega demografía a partir de 100 seguidores en Instagram.",
    });
  }
  const fbPlatform = platforms.find((p) => p.platform === "FACEBOOK");
  if (fbPlatform?.connected) {
    dataQuality.push({
      label: "Facebook",
      detail:
        "Meta retiró el alcance por publicación y las impresiones de página en 2024: lo que se muestra son visualizaciones de contenido.",
    });
  }

  const formatter = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short" });

  return {
    client: {
      id: client.id,
      name: client.name,
      logo: client.logo,
      monthlyRate: client.monthlyRate,
    },
    period: {
      days: periodDays,
      start,
      end,
      previousStart,
      previousEnd,
      label: `${formatter.format(start)} – ${formatter.format(end)}`,
      previousLabel: `${formatter.format(previousStart)} – ${formatter.format(previousEnd)}`,
    },
    headline: {
      reach: reachDelta,
      engagement: delta(totalEngagement, prevEngagement),
      followers: followersDelta,
      adSpend: dominant?.spendDelta ?? delta(0, 0),
      currency: dominant?.currency ?? null,
    },
    derived,
    trend,
    platforms,
    media: mediaRows,
    ads,
    audience,
    content,
    dataQuality,
    generatedAt: new Date(),
  };
}
