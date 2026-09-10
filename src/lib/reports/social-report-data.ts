/**
 * Agregador del informe social por cliente.
 *
 * Vive en lib y no en un Server Action porque lo consumen dos rutas: la ficha
 * interna del cliente y el enlace público. La diferencia entre ambas la marca
 * `includeFinancials`, no dos implementaciones distintas.
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
} from "./social-report-math.ts";

export type ReportPlatform = "FACEBOOK" | "INSTAGRAM" | "TIKTOK";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * Métricas que representan alcance/visualizaciones en cada plataforma.
 * El nombre difiere por plataforma, así que se mapea en un solo lugar.
 */
const REACH_METRICS: Record<ReportPlatform, string[]> = {
  FACEBOOK: ["page_media_view"],
  INSTAGRAM: ["reach"],
  TIKTOK: ["video_views"],
};

const ENGAGEMENT_METRICS: Record<ReportPlatform, string[]> = {
  FACEBOOK: ["page_post_engagements"],
  INSTAGRAM: ["total_interactions", "accounts_engaged"],
  TIKTOK: ["likes_count"],
};

const FOLLOWER_METRICS: Record<ReportPlatform, string[]> = {
  FACEBOOK: ["page_follows"],
  INSTAGRAM: ["followers_count"],
  TIKTOK: ["follower_count"],
};

export interface PlatformSection {
  platform: ReportPlatform;
  label: string;
  connected: boolean;
  hasData: boolean;
  reach: number;
  engagement: number;
  followers: number;
  reachDelta: DeltaPct;
  engagementDelta: DeltaPct;
  /** Serie diaria de alcance para el gráfico de tendencia. */
  series: Array<{ date: string; value: number }>;
}

export interface CampaignRow {
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  ctr: number | null;
  cpa: number | null;
  roas: number | null;
  /** Participación sobre la inversión total, en porcentaje. */
  share: number;
}

export interface AdsSection {
  connected: boolean;
  hasData: boolean;
  /** Un bloque por moneda: nunca se suman divisas distintas. */
  byCurrency: Array<{
    currency: string;
    totals: AdEfficiency;
    spendDelta: DeltaPct;
    campaigns: CampaignRow[];
    spendByDay: Array<{ date: string; value: number }>;
  }>;
  /** Ventana de atribución declarada, para el pie del informe. */
  attributionWindow: string;
}

export interface SocialReportData {
  client: { id: string; name: string; logo: string | null };
  period: {
    month: number;
    year: number;
    label: string;
    start: Date;
    end: Date;
    previousLabel: string;
  };
  headline: {
    reach: DeltaPct;
    engagement: DeltaPct;
    followers: DeltaPct;
    adSpend: DeltaPct;
    /** Moneda dominante; null si no hubo inversión. */
    currency: string | null;
    /** Frase de veredicto en lenguaje llano. */
    verdict: string;
  };
  trend: Array<{ date: string; facebook: number; instagram: number; tiktok: number }>;
  platforms: PlatformSection[];
  ads: AdsSection;
  content: {
    published: number;
    reels: number;
    flyers: number;
  };
  narrative: { summary: string | null; generatedAt: Date | null };
  /** Qué falta o está viejo, para no dejar que un hueco se lea como cero. */
  dataQuality: Array<{ label: string; detail: string }>;
  generatedAt: Date;
}

function monthRange(year: number, month: number) {
  // month es 1-12. Date usa 0-11.
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

function previousMonth(year: number, month: number) {
  return month === 1
    ? { year: year - 1, month: 12 }
    : { year, month: month - 1 };
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface MetricRow {
  platform: string;
  metricName: string;
  value: number;
  date: Date;
}

function sumMetrics(rows: MetricRow[], platform: ReportPlatform, names: string[]): number {
  return rows
    .filter((r) => r.platform === platform && names.includes(r.metricName))
    .reduce((sum, r) => sum + r.value, 0);
}

/**
 * Último valor de una métrica de tipo snapshot (seguidores).
 *
 * Sumar snapshots diarios daría un número absurdo — 28 días de "1.200
 * seguidores" no son 33.600 — así que se toma el más reciente del período.
 */
function latestMetric(rows: MetricRow[], platform: ReportPlatform, names: string[]): number {
  const matching = rows
    .filter((r) => r.platform === platform && names.includes(r.metricName))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
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
 * Construye la frase de veredicto que abre el informe.
 * Habla del cambio más relevante, en lenguaje de negocio.
 */
function buildVerdict(
  reach: DeltaPct,
  spend: DeltaPct,
  hasAnyData: boolean,
  periodLabel: string
): string {
  if (!hasAnyData) {
    return `Todavía no hay datos suficientes de ${periodLabel} para sacar conclusiones.`;
  }

  if (reach.pct === null) {
    return reach.current > 0
      ? `${periodLabel} es el primer mes con datos: ${reach.current.toLocaleString("es-EC")} visualizaciones registradas.`
      : `En ${periodLabel} no se registraron visualizaciones.`;
  }

  const pct = Math.abs(Math.round(reach.pct));

  if (reach.direction === "up") {
    const extra = spend.pct !== null && spend.pct < -5
      ? " y con menos inversión que el mes anterior"
      : "";
    return `${periodLabel} creció ${pct}% en visualizaciones frente al mes anterior${extra}.`;
  }

  if (reach.direction === "down") {
    return `${periodLabel} bajó ${pct}% en visualizaciones frente al mes anterior.`;
  }

  return `${periodLabel} se mantuvo estable en visualizaciones frente al mes anterior.`;
}

/**
 * Arma todos los datos del informe mensual de un cliente.
 *
 * Consulta ambos períodos —el actual y el anterior— en una sola pasada por
 * fuente, y agrega en memoria: son pocos miles de filas y evita seis viajes
 * a la base de datos.
 */
export async function buildSocialReportData(
  clientId: string,
  month: number,
  year: number
): Promise<SocialReportData | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      logo: true,
      facebookPageId: true,
      instagramBusinessId: true,
      tiktokOpenId: true,
      lastAiOverview: true,
      lastAiOverviewDate: true,
      adAccounts: {
        where: { isActive: true },
        select: { adAccountId: true },
      },
    },
  });

  if (!client) return null;

  const current = monthRange(year, month);
  const prev = previousMonth(year, month);
  const previous = monthRange(prev.year, prev.month);

  const [metrics, adMetrics, tasks] = await Promise.all([
    db.clientMetric.findMany({
      where: { clientId, date: { gte: previous.start, lte: current.end } },
      select: { platform: true, metricName: true, value: true, date: true },
    }),
    db.clientAdMetric.findMany({
      where: { clientId, date: { gte: previous.start, lte: current.end } },
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
    db.contentTask.findMany({
      where: {
        clientId,
        publishedAt: { gte: current.start, lte: current.end },
        status: "PUBLISHED",
      },
      select: { type: true },
    }),
  ]);

  const inCurrent = <T extends { date: Date }>(row: T) =>
    row.date >= current.start && row.date <= current.end;
  const inPrevious = <T extends { date: Date }>(row: T) =>
    row.date >= previous.start && row.date <= previous.end;

  const currentMetrics = metrics.filter(inCurrent);
  const previousMetrics = metrics.filter(inPrevious);

  // --- Plataformas orgánicas ---
  const platformConfig: Array<{ platform: ReportPlatform; label: string; connected: boolean }> = [
    { platform: "FACEBOOK", label: "Facebook", connected: Boolean(client.facebookPageId) },
    { platform: "INSTAGRAM", label: "Instagram", connected: Boolean(client.instagramBusinessId) },
    { platform: "TIKTOK", label: "TikTok", connected: Boolean(client.tiktokOpenId) },
  ];

  const platforms: PlatformSection[] = platformConfig.map(({ platform, label, connected }) => {
    const reach = sumMetrics(currentMetrics, platform, REACH_METRICS[platform]);
    const prevReach = sumMetrics(previousMetrics, platform, REACH_METRICS[platform]);
    const engagement = sumMetrics(currentMetrics, platform, ENGAGEMENT_METRICS[platform]);
    const prevEngagement = sumMetrics(previousMetrics, platform, ENGAGEMENT_METRICS[platform]);
    const followers = latestMetric(currentMetrics, platform, FOLLOWER_METRICS[platform]);

    const series = dailySeries(currentMetrics, platform, REACH_METRICS[platform]);

    return {
      platform,
      label,
      connected,
      hasData: series.length > 0 || reach > 0 || followers > 0,
      reach,
      engagement,
      followers,
      reachDelta: delta(reach, prevReach),
      engagementDelta: delta(engagement, prevEngagement),
      series,
    };
  });

  // --- Tendencia combinada ---
  const allDays = new Set<string>();
  for (const p of platforms) for (const point of p.series) allDays.add(point.date);

  const seriesLookup = new Map(
    platforms.map((p) => [p.platform, new Map(p.series.map((s) => [s.date, s.value]))])
  );

  const trend = [...allDays]
    .sort()
    .map((date) => ({
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
    const prevRows = previousAds.filter((r) => (r.currency || "USD") === currency);
    const prevTotals = sumAdTotals(prevRows);

    // Una campaña agrupa todos sus días antes de derivar sus ratios.
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
          clicks: campaignTotals.clicks,
          conversions: campaignTotals.conversions,
          conversionValue: campaignTotals.conversionValue,
          ctr: campaignTotals.ctr,
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
    };
  });

  const ads: AdsSection = {
    connected: client.adAccounts.length > 0,
    hasData: currentAds.length > 0,
    byCurrency,
    attributionWindow: "7 días desde el clic, 1 día desde la visualización",
  };

  // --- Titulares ---
  const totalReach = platforms.reduce((s, p) => s + p.reach, 0);
  const prevReach = platforms.reduce((s, p) => s + p.reachDelta.previous, 0);
  const totalEngagement = platforms.reduce((s, p) => s + p.engagement, 0);
  const prevEngagement = platforms.reduce((s, p) => s + p.engagementDelta.previous, 0);
  const totalFollowers = platforms.reduce((s, p) => s + p.followers, 0);

  // Solo se compara inversión dentro de la moneda dominante.
  const dominant = [...byCurrency].sort((a, b) => b.totals.spend - a.totals.spend)[0];
  const spendDelta = dominant?.spendDelta ?? delta(0, 0);

  const previousFollowers = platforms.reduce(
    (sum, p) => sum + latestMetric(previousMetrics, p.platform, FOLLOWER_METRICS[p.platform]),
    0
  );

  const label = `${MONTH_NAMES[month - 1]} ${year}`;
  const hasAnyData = totalReach > 0 || totalEngagement > 0 || ads.hasData;

  // --- Calidad de datos ---
  const dataQuality: Array<{ label: string; detail: string }> = [];
  for (const p of platforms) {
    if (!p.connected) {
      dataQuality.push({
        label: p.label,
        detail: "No conectado: este informe no incluye datos de esta red.",
      });
    } else if (!p.hasData) {
      dataQuality.push({
        label: p.label,
        detail: "Conectado, pero sin datos registrados en el período.",
      });
    }
  }
  if (!ads.connected) {
    dataQuality.push({
      label: "Anuncios",
      detail: "Sin cuentas publicitarias vinculadas.",
    });
  } else if (!ads.hasData) {
    dataQuality.push({
      label: "Anuncios",
      detail: "Sin inversión registrada en el período.",
    });
  }
  if (byCurrency.length > 1) {
    dataQuality.push({
      label: "Monedas",
      detail: `Hay inversión en ${byCurrency.length} monedas distintas; los totales se muestran por separado y no se suman.`,
    });
  }

  return {
    client: { id: client.id, name: client.name, logo: client.logo },
    period: {
      month,
      year,
      label,
      start: current.start,
      end: current.end,
      previousLabel: `${MONTH_NAMES[prev.month - 1]} ${prev.year}`,
    },
    headline: {
      reach: delta(totalReach, prevReach),
      engagement: delta(totalEngagement, prevEngagement),
      followers: delta(totalFollowers, previousFollowers),
      adSpend: spendDelta,
      currency: dominant?.currency ?? null,
      verdict: buildVerdict(delta(totalReach, prevReach), spendDelta, hasAnyData, label),
    },
    trend,
    platforms,
    ads,
    content: {
      published: tasks.length,
      reels: tasks.filter((t) => t.type === "REEL").length,
      flyers: tasks.filter((t) => t.type === "FLYER").length,
    },
    narrative: {
      summary: client.lastAiOverview,
      generatedAt: client.lastAiOverviewDate,
    },
    dataQuality,
    generatedAt: new Date(),
  };
}
