/**
 * Exportación a CSV del panel de analítica.
 *
 * Puro: recibe el objeto ya agregado y devuelve texto. Así la misma salida
 * sirve para la descarga del navegador y para cualquier consumidor futuro, y
 * se puede probar sin DOM.
 *
 * Se exportan también las métricas derivadas — son el motivo de existir del
 * panel — con su valor vacío cuando no son calculables, nunca con un 0 que
 * parecería un resultado real.
 */

import type { ClientAnalytics } from "./analytics-data.ts";
import type { AgencyAnalytics } from "./agency-analytics-data.ts";

/** Escapa un campo con la convención estándar: comillas dobles duplicadas. */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(cell).join(",")).join("\n");
}

/** Redondea a dos decimales conservando el null. */
function num(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return (Math.round(value * 100) / 100).toString();
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * CSV de un cliente: bloques de resumen, derivadas, plataformas,
 * publicaciones, campañas y audiencia, separados por una línea en blanco.
 */
export function buildClientAnalyticsCsv(analytics: ClientAnalytics): string {
  const rows: Array<Array<string | number | null | undefined>> = [];

  rows.push(["Cliente", analytics.client.name]);
  rows.push(["Período", `${isoDay(analytics.period.start)} a ${isoDay(analytics.period.end)}`]);
  rows.push([
    "Período anterior",
    `${isoDay(analytics.period.previousStart)} a ${isoDay(analytics.period.previousEnd)}`,
  ]);
  rows.push([]);

  rows.push(["Métrica", "Valor", "Período anterior", "Variación %"]);
  const headline = analytics.headline;
  rows.push(["Visualizaciones", headline.reach.current, headline.reach.previous, num(headline.reach.pct)]);
  rows.push([
    "Interacciones",
    headline.engagement.current,
    headline.engagement.previous,
    num(headline.engagement.pct),
  ]);
  rows.push([
    "Seguidores",
    headline.followers.current,
    headline.followers.previous,
    num(headline.followers.pct),
  ]);
  rows.push([
    `Inversión publicitaria (${headline.currency ?? "—"})`,
    num(headline.adSpend.current),
    num(headline.adSpend.previous),
    num(headline.adSpend.pct),
  ]);
  rows.push([]);

  const d = analytics.derived;
  rows.push(["Métrica calculada", "Valor", "Unidad"]);
  rows.push(["Engagement rate sobre alcance", num(d.engagementRate), "%"]);
  rows.push(["Engagement rate período anterior", num(d.engagementRatePrevious), "%"]);
  rows.push(["Crecimiento de comunidad", num(d.growthRate), "%"]);
  rows.push(["Seguidores netos", d.netFollowers, "seguidores"]);
  rows.push(["Índice de viralidad", num(d.virality), "%"]);
  rows.push(["Tasa de guardado", num(d.saveRate), "%"]);
  rows.push(["Conversión de perfil", num(d.profileConversion), "%"]);
  rows.push(["Alcance por publicación", num(d.reachPerPost), "visualizaciones"]);
  rows.push(["Interacciones por publicación", num(d.interactionsPerPost), "interacciones"]);
  rows.push(["Consistencia de publicación", num(d.consistency), "%"]);
  rows.push(["Costo por interacción", num(d.costPerInteraction), "moneda"]);
  rows.push(["Alcance orgánico sobre el total", num(d.organicShare), "%"]);
  rows.push(["Saturación publicitaria", num(d.adSaturation), "veces"]);
  rows.push(["Costo real por resultado", num(d.totalCostPerResult), "moneda"]);
  rows.push(["Proyección mensual de visualizaciones", num(d.projectedMonthlyReach), "visualizaciones"]);
  rows.push(["Score de salud", d.healthScore ?? "", d.healthLabel]);
  rows.push([]);

  rows.push([
    "Plataforma",
    "Visualizaciones",
    "Interacciones",
    "Seguidores",
    "Visitas al perfil",
    "Clics a enlaces",
    "Seguidores netos",
    "ER alcance %",
    "ER seguidores %",
  ]);
  for (const platform of analytics.platforms) {
    if (!platform.connected) continue;
    rows.push([
      platform.label,
      platform.reach,
      platform.engagement,
      platform.followers,
      platform.profileViews,
      platform.linkClicks,
      platform.derived.netFollowers,
      num(platform.derived.engagementRateByReach),
      num(platform.derived.engagementRateByFollowers),
    ]);
  }
  rows.push([]);

  if (analytics.media.length > 0) {
    rows.push([
      "Publicación",
      "Plataforma",
      "Fecha",
      "Alcance",
      "Vistas",
      "Interacciones",
      "Guardados",
      "Compartidos",
      "ER %",
      "Enlace",
    ]);
    for (const item of analytics.media) {
      rows.push([
        (item.caption ?? "").replace(/\s+/g, " ").slice(0, 120),
        item.platform,
        isoDay(item.publishedAt),
        item.reach,
        item.views,
        item.interactions,
        item.saves,
        item.shares,
        num(item.engagementRate),
        item.permalink,
      ]);
    }
    rows.push([]);
  }

  for (const block of analytics.ads.byCurrency) {
    rows.push([`Campañas (${block.currency})`]);
    rows.push([
      "Campaña",
      "Inversión",
      "% del total",
      "Impresiones",
      "Clics",
      "CTR %",
      "Resultados",
      "CPA",
      "ROAS",
    ]);
    for (const campaign of block.campaigns) {
      rows.push([
        campaign.campaignName,
        num(campaign.spend),
        num(campaign.share),
        campaign.impressions,
        campaign.clicks,
        num(campaign.ctr),
        campaign.conversions,
        num(campaign.cpa),
        num(campaign.roas),
      ]);
    }
    rows.push([]);
  }

  for (const group of analytics.audience) {
    rows.push([`Audiencia · ${group.label}`, "Seguidores", "% del total"]);
    for (const entry of group.entries) {
      rows.push([entry.key, entry.value, num(entry.share)]);
    }
    rows.push([]);
  }

  for (const note of analytics.dataQuality) {
    rows.push(["Nota", note.label, note.detail]);
  }

  return toCsv(rows);
}

/** CSV del panel global: una fila por cliente, comparables entre sí. */
export function buildAgencyAnalyticsCsv(analytics: AgencyAnalytics): string {
  const rows: Array<Array<string | number | null | undefined>> = [];

  rows.push([
    "Período",
    `${isoDay(analytics.period.start)} a ${isoDay(analytics.period.end)}`,
    `${analytics.period.days} días`,
  ]);
  rows.push([]);

  rows.push([
    "Cliente",
    "Estado",
    "Visualizaciones",
    "Variación %",
    "Interacciones",
    "Seguidores",
    "Publicado",
    "ER %",
    "Crecimiento %",
    "Consistencia %",
    "Costo por interacción",
    "Inversión",
    "Resultados",
    "ROAS",
    "Score",
    "Lectura",
  ]);

  for (const client of analytics.clients) {
    rows.push([
      client.name,
      client.status,
      client.reach,
      num(client.reachDelta.pct),
      client.engagement,
      client.followers,
      client.published,
      num(client.engagementRate),
      num(client.growthRate),
      num(client.consistency),
      num(client.costPerInteraction),
      num(client.adSpend),
      client.conversions,
      num(client.roas),
      client.healthScore ?? "",
      client.healthLabel,
    ]);
  }

  if (analytics.totals.currencies.length > 1) {
    rows.push([]);
    rows.push([
      "Nota",
      `Hay inversión en ${analytics.totals.currencies.join(", ")}; las columnas de inversión no se suman entre monedas.`,
    ]);
  }

  return toCsv(rows);
}
