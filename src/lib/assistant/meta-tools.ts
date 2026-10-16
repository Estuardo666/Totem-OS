/**
 * Herramientas de métricas de Meta (Instagram, Facebook y Meta Ads) para el
 * asistente. Leen lo que ya sincronizó el Insights Engine:
 *
 * - ClientMetric: métricas orgánicas diarias por cuenta (alcance, vistas,
 *   interacciones, seguidores…) y demografía (audience_city:…, audience_age:…).
 * - ClientMediaMetric: rendimiento por publicación.
 * - ClientAdMetric: anuncios por campaña y día.
 *
 * Todo se agrega en el servidor y se compara contra el período anterior de
 * igual duración. Los ratios (ER, CTR, CPC, CPM, ROAS) se recalculan desde
 * numeradores y denominadores sumados; nunca se promedian entre filas.
 */

import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import type { AssistantUser } from "./tools";

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const pct = (now: number, before: number) => (before ? round(((now - before) / before) * 100, 1) : null);
const ratio = (num: number, den: number, scale = 100) => (den ? round((num / den) * scale) : null);
const day = (d: Date) => d.toISOString().slice(0, 10);

const periodSchema = z
  .string()
  .optional()
  .describe('Período: "7d", "28d", "90d", "mes" (mes en curso) o "YYYY-MM". Por defecto "28d".');

/** Rango [start, end) en días UTC (así se guardan las métricas) y el período anterior de igual duración. */
function resolvePeriod(period = "28d") {
  const today = new Date(Date.now() - 5 * 3600 * 1000); // hoy en Ecuador
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  let start: number;
  let end: number;
  let label: string;
  const month = /^(\d{4})-(\d{2})$/.exec(period);
  if (month) {
    start = Date.UTC(+month[1], +month[2] - 1, 1);
    end = Math.min(Date.UTC(+month[1], +month[2], 1), todayUtc + 86400000);
    label = period;
  } else if (period === "mes") {
    start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1);
    end = todayUtc + 86400000;
    label = "mes en curso";
  } else {
    const days = Number(/^(\d+)d$/.exec(period)?.[1] ?? 28);
    end = todayUtc + 86400000;
    start = end - days * 86400000;
    label = `últimos ${days} días`;
  }
  const length = end - start;
  return {
    label,
    start: new Date(start),
    end: new Date(end),
    prevStart: new Date(start - length),
    prevEnd: new Date(start),
    days: Math.round(length / 86400000),
  };
}

type Period = ReturnType<typeof resolvePeriod>;

async function findClient(clientId: string) {
  return db.client.findUnique({ where: { id: clientId }, select: { id: true, name: true, logo: true } });
}

const logosOf = (rows: { name: string; logo: string | null }[]) =>
  Object.fromEntries(rows.filter((r) => r.logo).map((r) => [r.name, r.logo as string]));

/** Suma por métrica en un rango, más el último valor de las que son totales acumulados. */
async function organicTotals(clientId: string, from: Date, to: Date) {
  const [sums, snapshots] = await Promise.all([
    db.clientMetric.groupBy({
      by: ["platform", "metricName"],
      where: { clientId, date: { gte: from, lt: to }, NOT: { metricName: { contains: ":" } } },
      _sum: { value: true },
      _count: true,
    }),
    db.clientMetric.findMany({
      where: { clientId, date: { gte: from, lt: to }, metricName: { in: ["followers_count", "page_follows"] } },
      orderBy: { date: "asc" },
      select: { platform: true, metricName: true, value: true, date: true },
    }),
  ]);
  const sum = (platform: string, name: string) =>
    sums.find((s) => s.platform === platform && s.metricName === name)?._sum.value ?? 0;
  const firstLast = (platform: string, name: string) => {
    const rows = snapshots.filter((s) => s.platform === platform && s.metricName === name);
    return rows.length ? { first: rows[0].value, last: rows[rows.length - 1].value } : null;
  };
  // Días con dato por métrica: si el período anterior está incompleto (la
  // sincronización empezó después), su variación no es comparable.
  const daysOf = (platform: string, name: string) =>
    sums.find((s) => s.platform === platform && s.metricName === name)?._count ?? 0;
  return { sum, firstLast, daysOf, hasData: sums.length > 0 };
}

function igBlock(t: Totals) {
  const reach = t.sum("INSTAGRAM", "reach");
  const interactions = t.sum("INSTAGRAM", "total_interactions");
  const followers = t.firstLast("INSTAGRAM", "followers_count");
  return {
    alcance: reach,
    vistas: t.sum("INSTAGRAM", "views"),
    interacciones: interactions,
    cuentasQueInteractuaron: t.sum("INSTAGRAM", "accounts_engaged"),
    likes: t.sum("INSTAGRAM", "likes"),
    comentarios: t.sum("INSTAGRAM", "comments"),
    guardados: t.sum("INSTAGRAM", "saves"),
    compartidos: t.sum("INSTAGRAM", "shares"),
    respuestas: t.sum("INSTAGRAM", "replies"),
    visitasAlPerfil: t.sum("INSTAGRAM", "profile_views"),
    clicsWeb: t.sum("INSTAGRAM", "website_clicks"),
    toquesEnlaces: t.sum("INSTAGRAM", "profile_links_taps"),
    nuevosSeguidores: t.sum("INSTAGRAM", "follower_count"),
    seguidoresTotales: followers?.last ?? null,
    crecimientoNetoSeguidores: followers ? followers.last - followers.first : null,
    engagementSobreAlcancePct: ratio(interactions, reach),
  };
}

function fbBlock(t: Totals) {
  const follows = t.sum("FACEBOOK", "page_daily_follows_unique");
  const unfollows = t.sum("FACEBOOK", "page_daily_unfollows_unique");
  const fans = t.firstLast("FACEBOOK", "page_follows");
  return {
    vistasDeContenido: t.sum("FACEBOOK", "page_media_view"),
    interaccionesConPublicaciones: t.sum("FACEBOOK", "page_post_engagements"),
    reacciones: t.sum("FACEBOOK", "page_actions_post_reactions_total"),
    visitasALaPagina: t.sum("FACEBOOK", "page_views_total"),
    accionesEnLaPagina: t.sum("FACEBOOK", "page_total_actions"),
    reproduccionesDeVideo: t.sum("FACEBOOK", "page_video_views"),
    minutosDeVideoVistos: round(t.sum("FACEBOOK", "page_video_view_time") / 60000, 0),
    nuevosSeguidores: follows,
    dejaronDeSeguir: unfollows,
    crecimientoNeto: follows - unfollows,
    seguidoresTotales: fans?.last ?? null,
  };
}

/**
 * Compara dos bloques campo a campo: { valor, anterior, variacionPct }. Si el
 * período anterior tiene menos del 70% de los días con dato que el actual, la
 * variación se omite (sería engañosa) y se marca como no comparable.
 */
function compare<T extends Record<string, number | null>>(now: T, before: T, comparable: (key: string) => boolean) {
  return Object.fromEntries(
    Object.entries(now).map(([k, v]) => {
      const b = before[k];
      if (typeof v !== "number" || typeof b !== "number") return [k, { valor: v }];
      return comparable(k)
        ? [k, { valor: round(v), anterior: round(b), variacionPct: pct(v, b) }]
        : [k, { valor: round(v), anterior: null, variacionPct: null, nota: "sin datos completos del período anterior" }];
    })
  );
}

/** Métrica cruda de la que sale cada campo, para medir la cobertura de días. */
const IG_SOURCE: Record<string, string> = {
  alcance: "reach", vistas: "views", interacciones: "total_interactions", cuentasQueInteractuaron: "accounts_engaged",
  likes: "likes", comentarios: "comments", guardados: "saves", compartidos: "shares", respuestas: "replies",
  visitasAlPerfil: "profile_views", clicsWeb: "website_clicks", toquesEnlaces: "profile_links_taps",
  nuevosSeguidores: "follower_count", seguidoresTotales: "followers_count", crecimientoNetoSeguidores: "followers_count",
  engagementSobreAlcancePct: "total_interactions",
};
const FB_SOURCE: Record<string, string> = {
  vistasDeContenido: "page_media_view", interaccionesConPublicaciones: "page_post_engagements",
  reacciones: "page_actions_post_reactions_total", visitasALaPagina: "page_views_total", accionesEnLaPagina: "page_total_actions",
  reproduccionesDeVideo: "page_video_views", minutosDeVideoVistos: "page_video_view_time",
  nuevosSeguidores: "page_daily_follows_unique", dejaronDeSeguir: "page_daily_unfollows_unique",
  crecimientoNeto: "page_daily_follows_unique", seguidoresTotales: "page_follows",
};
type Totals = Awaited<ReturnType<typeof organicTotals>>;
const coverage = (platform: string, sources: Record<string, string>, now: Totals, before: Totals) => (key: string) => {
  const metric = sources[key];
  const n = now.daysOf(platform, metric);
  return n > 0 && before.daysOf(platform, metric) >= n * 0.7;
};

const ER = (m: { interactions: number; likes: number; comments: number; saves: number; shares: number; reach: number }) => {
  const inter = m.interactions || m.likes + m.comments + m.saves + m.shares;
  return { inter, er: ratio(inter, m.reach) };
};

const productLabel = (platform: string, productType: string | null, mediaType: string) =>
  platform === "FACEBOOK" ? "Facebook" : productType === "REELS" ? "Reel" : mediaType === "CAROUSEL_ALBUM" ? "Carrusel" : productType === "STORY" ? "Historia" : "Post";

export function buildMetaTools(_user: AssistantUser) {
  return {
    metaResumenCliente: tool({
      description:
        "Informe experto de redes de UN cliente (Instagram y Facebook orgánico): alcance, vistas, interacciones, engagement, visitas al perfil, clics, crecimiento de seguidores, comparado con el período anterior de igual duración, más el mejor día. Úsala para '¿cómo le va en redes a X?', 'métricas de Meta de X', 'análisis de Instagram'. Requiere clientId (usa buscarClientes).",
      inputSchema: z.object({ clientId: z.string(), periodo: periodSchema }),
      execute: async ({ clientId, periodo }) => {
        const client = await findClient(clientId);
        if (!client) return { error: "Cliente no encontrado; usa buscarClientes." };
        const p = resolvePeriod(periodo);
        const [now, before, daily] = await Promise.all([
          organicTotals(clientId, p.start, p.end),
          organicTotals(clientId, p.prevStart, p.prevEnd),
          db.clientMetric.findMany({
            where: { clientId, date: { gte: p.start, lt: p.end }, metricName: { in: ["reach", "page_media_view"] } },
            select: { metricName: true, value: true, date: true },
          }),
        ]);
        if (!now.hasData) {
          return { cliente: client.name, periodo: p.label, sinDatos: "Este cliente no tiene métricas de Meta sincronizadas en el período (¿cuenta conectada?)." };
        }
        const bestBy = (name: string) => {
          const best = daily.filter((d) => d.metricName === name).sort((a, b) => b.value - a.value)[0];
          return best ? { fecha: day(best.date), valor: best.value } : null;
        };
        return {
          cliente: client.name,
          logos: logosOf([client]),
          periodo: { nombre: p.label, desde: day(p.start), hasta: day(new Date(p.end.getTime() - 1)), dias: p.days },
          comparadoCon: { desde: day(p.prevStart), hasta: day(new Date(p.prevEnd.getTime() - 1)) },
          instagram: compare(igBlock(now), igBlock(before), coverage("INSTAGRAM", IG_SOURCE, now, before)),
          facebook: compare(fbBlock(now), fbBlock(before), coverage("FACEBOOK", FB_SOURCE, now, before)),
          mejorDia: { instagramAlcance: bestBy("reach"), facebookVistas: bestBy("page_media_view") },
          nota: "Alcance diario sumado: puede contar a la misma persona en varios días.",
        };
      },
    }),

    metaTopPublicaciones: tool({
      description:
        "Análisis de publicaciones de Instagram/Facebook: top y peores piezas por alcance, vistas, interacciones, guardados, compartidos o engagement, y rendimiento promedio por formato (Reel vs Post vs Carrusel vs Facebook) para saber qué contenido funciona mejor. Opcional por cliente.",
      inputSchema: z.object({
        clientId: z.string().optional(),
        periodo: periodSchema,
        plataforma: z.enum(["INSTAGRAM", "FACEBOOK"]).optional(),
        ordenarPor: z.enum(["alcance", "vistas", "interacciones", "guardados", "compartidos", "engagement"]).optional(),
      }),
      execute: async ({ clientId, periodo, plataforma, ordenarPor = "alcance" }) => {
        const p = resolvePeriod(periodo);
        const posts = await db.clientMediaMetric.findMany({
          where: {
            ...(clientId && { clientId }),
            ...(plataforma && { platform: plataforma }),
            publishedAt: { gte: p.start, lt: p.end },
          },
          select: {
            platform: true, mediaType: true, productType: true, permalink: true, caption: true, publishedAt: true,
            reach: true, views: true, likes: true, comments: true, saves: true, shares: true, interactions: true,
            profileVisits: true, follows: true,
            client: { select: { name: true, logo: true } },
          },
        });
        if (!posts.length) return { periodo: p.label, sinDatos: "No hay publicaciones sincronizadas en ese período." };

        const rows = posts.map((m) => {
          const { inter, er } = ER(m);
          return {
            cliente: m.client.name,
            formato: productLabel(m.platform, m.productType, m.mediaType),
            fecha: day(m.publishedAt),
            texto: (m.caption ?? "").replace(/\s+/g, " ").slice(0, 80),
            enlace: m.permalink,
            alcance: m.reach,
            vistas: m.views,
            interacciones: inter,
            guardados: m.saves,
            compartidos: m.shares,
            visitasPerfil: m.profileVisits,
            nuevosSeguidores: m.follows,
            engagementPct: er,
          };
        });
        const key: Record<string, (r: (typeof rows)[number]) => number> = {
          alcance: (r) => r.alcance, vistas: (r) => r.vistas, interacciones: (r) => r.interacciones,
          guardados: (r) => r.guardados, compartidos: (r) => r.compartidos, engagement: (r) => r.engagementPct ?? 0,
        };
        const sorted = [...rows].sort((a, b) => key[ordenarPor](b) - key[ordenarPor](a));

        const formats = new Map<string, { n: number; reach: number; views: number; inter: number; interWithReach: number }>();
        for (const r of rows) {
          const f = formats.get(r.formato) ?? { n: 0, reach: 0, views: 0, inter: 0, interWithReach: 0 };
          formats.set(r.formato, {
            n: f.n + 1,
            reach: f.reach + r.alcance,
            views: f.views + r.vistas,
            inter: f.inter + r.interacciones,
            interWithReach: f.interWithReach + (r.alcance > 0 ? r.interacciones : 0),
          });
        }
        // Facebook no informa alcance por publicación: los promedios de alcance y
        // engagement usan solo las piezas que sí lo traen.
        const withReach = rows.filter((r) => r.alcance > 0);
        const totalReach = withReach.reduce((s, r) => s + r.alcance, 0);
        const totalInter = withReach.reduce((s, r) => s + r.interacciones, 0);
        return {
          periodo: p.label,
          publicaciones: rows.length,
          ordenadoPor: ordenarPor,
          logos: logosOf(posts.map((m) => m.client)),
          promedios: {
            alcancePorPublicacion: withReach.length ? round(totalReach / withReach.length, 0) : null,
            interaccionesPorPublicacion: round(rows.reduce((s, r) => s + r.interacciones, 0) / rows.length, 1),
            engagementPct: ratio(totalInter, totalReach),
          },
          porFormato: [...formats.entries()]
            .map(([formato, f]) => ({
              formato,
              publicaciones: f.n,
              alcancePromedio: f.reach ? round(f.reach / f.n, 0) : null,
              vistasPromedio: round(f.views / f.n, 0),
              interaccionesPromedio: round(f.inter / f.n, 1),
              engagementPct: ratio(f.interWithReach, f.reach),
            }))
            .sort((a, b) => b.vistasPromedio - a.vistasPromedio),
          top: sorted.slice(0, 5),
          peores: sorted.slice(-3).reverse(),
        };
      },
    }),

    metaAudiencia: tool({
      description:
        "Audiencia de Instagram de un cliente: ciudades y países principales, rangos de edad y género (último dato disponible), en porcentajes. Úsala para '¿quién sigue a X?', 'público de X', 'de dónde son sus seguidores'.",
      inputSchema: z.object({ clientId: z.string() }),
      execute: async ({ clientId }) => {
        const client = await findClient(clientId);
        if (!client) return { error: "Cliente no encontrado; usa buscarClientes." };
        const latest = await db.clientMetric.findFirst({
          where: { clientId, metricName: { startsWith: "audience_" } },
          orderBy: { date: "desc" },
          select: { date: true },
        });
        if (!latest) return { cliente: client.name, sinDatos: "Sin datos de audiencia sincronizados." };
        const rows = await db.clientMetric.findMany({
          where: { clientId, date: latest.date, metricName: { startsWith: "audience_" } },
          select: { metricName: true, value: true },
        });
        const group = (prefix: string, top = 6) => {
          const items = rows
            .filter((r) => r.metricName.startsWith(`${prefix}:`))
            .map((r) => ({ nombre: r.metricName.slice(prefix.length + 1), valor: r.value }));
          const total = items.reduce((s, i) => s + i.valor, 0);
          return items
            .sort((a, b) => b.valor - a.valor)
            .slice(0, top)
            .map((i) => ({ nombre: i.nombre, porcentaje: ratio(i.valor, total) }));
        };
        const gender = group("audience_gender", 3).map((g) => ({
          ...g,
          nombre: g.nombre === "F" ? "mujeres" : g.nombre === "M" ? "hombres" : "sin especificar",
        }));
        return {
          cliente: client.name,
          logos: logosOf([client]),
          fechaDelDato: day(latest.date),
          ciudades: group("audience_city"),
          paises: group("audience_country", 5),
          edades: group("audience_age", 7),
          genero: gender,
        };
      },
    }),

    metaRankingClientes: tool({
      description:
        "Compara a TODOS los clientes con Meta conectado en un período: alcance de Instagram, vistas, interacciones, engagement y crecimiento de seguidores, con su variación vs. el período anterior. Úsala para '¿qué cliente creció más en redes?', '¿quién tiene mejor engagement?', 'ranking de redes'.",
      inputSchema: z.object({
        periodo: periodSchema,
        ordenarPor: z.enum(["alcance", "vistas", "interacciones", "engagement", "crecimiento"]).optional(),
      }),
      execute: async ({ periodo, ordenarPor = "alcance" }) => {
        const p = resolvePeriod(periodo);
        const names = ["reach", "views", "total_interactions", "follower_count", "page_media_view"];
        const [now, before] = await Promise.all(
          [[p.start, p.end], [p.prevStart, p.prevEnd]].map(([from, to]) =>
            db.clientMetric.groupBy({
              by: ["clientId", "metricName"],
              where: { date: { gte: from, lt: to }, metricName: { in: names } },
              _sum: { value: true },
              _count: true,
            })
          )
        );
        const ids = [...new Set(now.map((r) => r.clientId))];
        if (!ids.length) return { periodo: p.label, sinDatos: "Ningún cliente tiene métricas de Meta en ese período." };
        const clients = await db.client.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, logo: true } });
        const get = (rows: typeof now, id: string, name: string) =>
          rows.find((r) => r.clientId === id && r.metricName === name)?._sum.value ?? 0;
        const list = clients.map((c) => {
          const reach = get(now, c.id, "reach");
          const inter = get(now, c.id, "total_interactions");
          return {
            cliente: c.name,
            alcanceIG: reach,
            // Solo si el período anterior tiene datos de casi todos los días.
            alcanceIGVariacionPct:
              (before.find((r) => r.clientId === c.id && r.metricName === "reach")?._count ?? 0) >=
              (now.find((r) => r.clientId === c.id && r.metricName === "reach")?._count ?? 0) * 0.7
                ? pct(reach, get(before, c.id, "reach"))
                : null,
            vistasIG: get(now, c.id, "views"),
            interaccionesIG: inter,
            engagementPct: ratio(inter, reach),
            nuevosSeguidoresIG: get(now, c.id, "follower_count"),
            vistasFacebook: get(now, c.id, "page_media_view"),
          };
        });
        const key: Record<string, (r: (typeof list)[number]) => number> = {
          alcance: (r) => r.alcanceIG, vistas: (r) => r.vistasIG, interacciones: (r) => r.interaccionesIG,
          engagement: (r) => r.engagementPct ?? 0, crecimiento: (r) => r.nuevosSeguidoresIG,
        };
        return {
          periodo: p.label,
          ordenadoPor: ordenarPor,
          clientes: list.length,
          logos: logosOf(clients),
          ranking: list.sort((a, b) => key[ordenarPor](b) - key[ordenarPor](a)).map((r, i) => ({ puesto: i + 1, ...r })),
        };
      },
    }),

    metaAnuncios: tool({
      description:
        "Rendimiento de Meta Ads: inversión, impresiones, alcance, clics, CTR, CPC, CPM, frecuencia, conversiones, costo por resultado y ROAS, por campaña y total, comparado con el período anterior. Opcional por cliente.",
      inputSchema: z.object({ clientId: z.string().optional(), periodo: periodSchema }),
      execute: async ({ clientId, periodo }) => {
        const p = resolvePeriod(periodo);
        const where = (from: Date, to: Date) => ({
          ...(clientId && { clientId }),
          campaignId: { not: "__ACCOUNT__" },
          date: { gte: from, lt: to },
        });
        const sums = { spend: true, impressions: true, reach: true, clicks: true, conversions: true, conversionValue: true } as const;
        const [byCampaign, before] = await Promise.all([
          db.clientAdMetric.groupBy({ by: ["clientId", "campaignId", "campaignName"], where: where(p.start, p.end), _sum: sums }),
          db.clientAdMetric.aggregate({ where: where(p.prevStart, p.prevEnd), _sum: sums }),
        ]);
        if (!byCampaign.length) {
          return {
            periodo: p.label,
            sinDatos: "No hay datos de anuncios sincronizados para ese período. Hay que vincular la cuenta publicitaria del cliente en Totem OS.",
          };
        }
        const kpis = (s: { spend: number; impressions: number; reach: number; clicks: number; conversions: number; conversionValue: number }) => ({
          inversion: round(s.spend),
          impresiones: s.impressions,
          alcance: s.reach,
          clics: s.clicks,
          ctrPct: ratio(s.clicks, s.impressions),
          cpc: s.clicks ? round(s.spend / s.clicks) : null,
          cpm: s.impressions ? round((s.spend / s.impressions) * 1000) : null,
          frecuencia: s.reach ? round(s.impressions / s.reach) : null,
          conversiones: s.conversions,
          costoPorResultado: s.conversions ? round(s.spend / s.conversions) : null,
          roas: s.spend ? round(s.conversionValue / s.spend) : null,
        });
        const zero = { spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, conversionValue: 0 };
        const fill = (s: Partial<Record<keyof typeof zero, number | null>>) =>
          Object.fromEntries(Object.keys(zero).map((k) => [k, s[k as keyof typeof zero] ?? 0])) as typeof zero;
        const total = byCampaign.reduce((acc, c) => {
          const s = fill(c._sum);
          (Object.keys(acc) as (keyof typeof zero)[]).forEach((k) => (acc[k] += s[k]));
          return acc;
        }, { ...zero });
        const clients = await db.client.findMany({
          where: { id: { in: [...new Set(byCampaign.map((c) => c.clientId))] } },
          select: { id: true, name: true, logo: true },
        });
        const nameOf = new Map(clients.map((c) => [c.id, c.name]));
        const totalNow = kpis(total);
        const totalBefore = kpis(fill(before._sum));
        return {
          periodo: p.label,
          logos: logosOf(clients),
          total: totalNow,
          variacionPct: {
            inversion: pct(totalNow.inversion, totalBefore.inversion),
            clics: pct(totalNow.clics, totalBefore.clics),
            conversiones: pct(totalNow.conversiones, totalBefore.conversiones),
          },
          campanas: byCampaign
            .map((c) => ({ cliente: nameOf.get(c.clientId) ?? "", campana: c.campaignName, ...kpis(fill(c._sum)) }))
            .sort((a, b) => b.inversion - a.inversion)
            .slice(0, 10),
        };
      },
    }),
  };
}
