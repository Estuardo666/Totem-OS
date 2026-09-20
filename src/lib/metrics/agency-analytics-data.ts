/**
 * Panel global de agencia: una fila por cliente, comparables entre sí.
 *
 * No llama a `buildClientAnalytics` en bucle a propósito: eso serían cuatro
 * consultas por cliente. Aquí se hacen tres consultas para toda la cartera y
 * se agrega en memoria, filtrando por los nombres de métrica que el panel usa
 * para no arrastrar filas que después se descartan.
 */

import { db } from "@/lib/db";
import { delta, computeAdEfficiency, sumAdTotals, type DeltaPct } from "@/lib/reports/social-report-math";
import {
  communityGrowthRate,
  costPerInteraction,
  engagementRateByReach,
  healthLabel,
  healthScore,
  publishingConsistency,
} from "./derived-metrics.ts";
import {
  ENGAGEMENT_METRICS,
  FOLLOWER_METRICS,
  REACH_METRICS,
  type ReportPlatform,
} from "./metric-names.ts";
import { normalizePeriod } from "./analytics-data.ts";

const PLATFORMS: ReportPlatform[] = ["FACEBOOK", "INSTAGRAM", "TIKTOK"];

const REACH_NAMES = [...new Set(PLATFORMS.flatMap((p) => REACH_METRICS[p]))];
const ENGAGEMENT_NAMES = [...new Set(PLATFORMS.flatMap((p) => ENGAGEMENT_METRICS[p]))];
const FOLLOWER_NAMES = [...new Set(PLATFORMS.flatMap((p) => FOLLOWER_METRICS[p]))];
const TRACKED_NAMES = [...new Set([...REACH_NAMES, ...ENGAGEMENT_NAMES, ...FOLLOWER_NAMES])];

export interface AgencyClientRow {
  clientId: string;
  name: string;
  logo: string | null;
  status: string;
  monthlyRate: number;
  connections: { facebook: boolean; instagram: boolean; tiktok: boolean; ads: boolean };

  reach: number;
  engagement: number;
  followers: number;
  published: number;
  adSpend: number;
  conversions: number;

  reachDelta: DeltaPct;
  engagementRate: number | null;
  growthRate: number | null;
  consistency: number | null;
  costPerInteraction: number | null;
  roas: number | null;
  healthScore: number | null;
  healthLabel: string;
}

export interface AgencyAnalytics {
  period: { days: number; start: Date; end: Date; previousStart: Date; previousEnd: Date };
  totals: {
    clients: number;
    reach: DeltaPct;
    engagement: DeltaPct;
    followers: number;
    published: number;
    adSpend: DeltaPct;
    /** Monedas presentes; con más de una los totales de inversión no se suman. */
    currencies: string[];
  };
  clients: AgencyClientRow[];
  generatedAt: Date;
}

function startOfUtcDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function buildAgencyAnalytics(days: number = 28): Promise<AgencyAnalytics> {
  const periodDays = normalizePeriod(days);

  const end = new Date();
  const start = startOfUtcDay(new Date(end.getTime() - (periodDays - 1) * 86400_000));
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = startOfUtcDay(new Date(previousEnd.getTime() - (periodDays - 1) * 86400_000));

  const clients = await db.client.findMany({
    where: { status: { in: ["ACTIVE", "DEBT"] } },
    select: {
      id: true,
      name: true,
      logo: true,
      status: true,
      monthlyRate: true,
      facebookPageId: true,
      instagramBusinessId: true,
      tiktokOpenId: true,
      adAccounts: { where: { isActive: true }, select: { id: true } },
    },
    orderBy: { name: "asc" },
  });

  const clientIds = clients.map((c) => c.id);
  if (clientIds.length === 0) {
    return {
      period: { days: periodDays, start, end, previousStart, previousEnd },
      totals: {
        clients: 0,
        reach: delta(0, 0),
        engagement: delta(0, 0),
        followers: 0,
        published: 0,
        adSpend: delta(0, 0),
        currencies: [],
      },
      clients: [],
      generatedAt: new Date(),
    };
  }

  const [metrics, adMetrics, tasks] = await Promise.all([
    db.clientMetric.findMany({
      where: {
        clientId: { in: clientIds },
        metricName: { in: TRACKED_NAMES },
        date: { gte: previousStart, lte: end },
      },
      select: { clientId: true, platform: true, metricName: true, value: true, date: true },
    }),
    db.clientAdMetric.findMany({
      where: { clientId: { in: clientIds }, date: { gte: previousStart, lte: end } },
      select: {
        clientId: true,
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
        clientId: { in: clientIds },
        publishedAt: { gte: start, lte: end },
        status: "PUBLISHED",
      },
      select: { clientId: true, publishedAt: true },
    }),
  ]);

  const inCurrent = (date: Date) => date >= start && date <= end;
  const inPrevious = (date: Date) => date >= previousStart && date <= previousEnd;

  const rows: AgencyClientRow[] = clients.map((client) => {
    const own = metrics.filter((m) => m.clientId === client.id);
    const current = own.filter((m) => inCurrent(m.date));
    const previous = own.filter((m) => inPrevious(m.date));

    const sumBy = (source: typeof own, names: string[]) =>
      source.filter((m) => names.includes(m.metricName)).reduce((sum, m) => sum + m.value, 0);

    // Los seguidores son snapshots: se suma el último valor de cada plataforma,
    // nunca la serie completa.
    const latestFollowers = (source: typeof own) =>
      PLATFORMS.reduce((sum, platform) => {
        const candidates = source
          .filter((m) => m.platform === platform && FOLLOWER_METRICS[platform].includes(m.metricName))
          .sort((a, b) => b.date.getTime() - a.date.getTime());
        return sum + (candidates[0]?.value ?? 0);
      }, 0);

    const reach = sumBy(current, REACH_NAMES);
    const prevReach = sumBy(previous, REACH_NAMES);
    const engagement = sumBy(current, ENGAGEMENT_NAMES);
    const followers = latestFollowers(current);
    const prevFollowers = latestFollowers(previous);

    const ownTasks = tasks.filter((t) => t.clientId === client.id);
    const daysWithPosts = new Set(
      ownTasks.filter((t) => t.publishedAt).map((t) => isoDay(t.publishedAt as Date))
    ).size;

    const ownAds = adMetrics.filter((a) => a.clientId === client.id && inCurrent(a.date));
    const adTotals = computeAdEfficiency(sumAdTotals(ownAds));

    const reachDelta = delta(reach, prevReach);
    const engagementRate = engagementRateByReach(engagement, reach);
    const growthRate = communityGrowthRate(followers, prevFollowers);
    const consistency = publishingConsistency(daysWithPosts, periodDays);

    const score = healthScore({
      engagementRate,
      growthRate,
      consistency,
      reachTrend: reachDelta.pct,
    });

    return {
      clientId: client.id,
      name: client.name,
      logo: client.logo,
      status: client.status,
      monthlyRate: client.monthlyRate,
      connections: {
        facebook: Boolean(client.facebookPageId),
        instagram: Boolean(client.instagramBusinessId),
        tiktok: Boolean(client.tiktokOpenId),
        ads: client.adAccounts.length > 0,
      },
      reach,
      engagement,
      followers,
      published: ownTasks.length,
      adSpend: adTotals.spend,
      conversions: adTotals.conversions,
      reachDelta,
      engagementRate,
      growthRate,
      consistency,
      costPerInteraction: costPerInteraction(client.monthlyRate, engagement, periodDays),
      roas: adTotals.roas,
      healthScore: score,
      healthLabel: healthLabel(score),
    };
  });

  const currentAds = adMetrics.filter((a) => inCurrent(a.date));
  const previousAds = adMetrics.filter((a) => inPrevious(a.date));
  const currencies = [...new Set(currentAds.map((a) => a.currency || "USD"))];

  const totals = {
    clients: rows.length,
    reach: delta(
      rows.reduce((s, r) => s + r.reach, 0),
      rows.reduce((s, r) => s + r.reachDelta.previous, 0)
    ),
    engagement: delta(
      rows.reduce((s, r) => s + r.engagement, 0),
      metrics
        .filter((m) => inPrevious(m.date) && ENGAGEMENT_NAMES.includes(m.metricName))
        .reduce((s, m) => s + m.value, 0)
    ),
    followers: rows.reduce((s, r) => s + r.followers, 0),
    published: rows.reduce((s, r) => s + r.published, 0),
    // Con varias monedas este total mezclaría divisas: se deja en cero y la
    // interfaz muestra el aviso en vez de un número inventado.
    adSpend:
      currencies.length > 1
        ? delta(0, 0)
        : delta(
            currentAds.reduce((s, a) => s + a.spend, 0),
            previousAds.reduce((s, a) => s + a.spend, 0)
          ),
    currencies,
  };

  return {
    period: { days: periodDays, start, end, previousStart, previousEnd },
    totals,
    clients: rows,
    generatedAt: new Date(),
  };
}
