"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Eye,
  HeartPulse,
  Loader2,
  MousePointerClick,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { getAgencyAnalytics } from "@/actions/metrics-actions";
import { formatNumber, formatRatio } from "@/components/features/reports/social-report/report-tokens";
import type { AgencyAnalytics, AgencyClientRow } from "@/lib/metrics/agency-analytics-data";
import type { AnalyticsPeriod } from "@/lib/metrics/analytics-data";
import { buildAgencyAnalyticsCsv } from "@/lib/metrics/analytics-csv";
import { DownloadCsvButton } from "./download-csv-button";
import { PeriodSelector } from "./period-selector";

type SortKey = "name" | "reach" | "engagementRate" | "growthRate" | "healthScore" | "adSpend" | "engagement" | "consistency" | "published" | "reachDelta" | "roas";

const EASE = [0.23, 1, 0.32, 1] as const;

interface AgencyAnalyticsPanelProps {
  initial: AgencyAnalytics;
}

function sortValue(row: AgencyClientRow, key: SortKey): number | null {
  if (key === "reachDelta") return row.reachDelta.pct;
  if (key === "name") return null;
  return row[key] as number | null;
}

function compare(a: AgencyClientRow, b: AgencyClientRow, key: SortKey): number {
  if (key === "name") return a.name.localeCompare(b.name, "es");
  // Un valor no calculable va al final: ordenar por "mejor ER" no debería
  // encabezarse con las cuentas que no tienen ER.
  const left = sortValue(a, key) ?? Number.NEGATIVE_INFINITY;
  const right = sortValue(b, key) ?? Number.NEGATIVE_INFINITY;
  return Number(right) - Number(left);
}

type HealthBand = "good" | "ok" | "warn" | "bad" | "none";

function band(score: number | null): HealthBand {
  if (score === null) return "none";
  if (score >= 75) return "good";
  if (score >= 50) return "ok";
  if (score >= 25) return "warn";
  return "bad";
}

const BAND_STYLE: Record<HealthBand, { text: string; bg: string; bar: string; label: string }> = {
  good: { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", bar: "bg-emerald-500", label: "Saludable" },
  ok: { text: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", bar: "bg-sky-500", label: "Estable" },
  warn: { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", bar: "bg-amber-500", label: "Atención" },
  bad: { text: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", bar: "bg-red-500", label: "Crítico" },
  none: { text: "text-muted-foreground", bg: "bg-muted", bar: "bg-muted-foreground/40", label: "Sin datos" },
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function ClientAvatar({ name, logo }: { name: string; logo: string | null }) {
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" className="size-8 shrink-0 rounded-lg object-cover ring-1 ring-border/60" />
  ) : (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-semibold text-muted-foreground">{initials(name)}</span>
  );
}

function Delta({ pct, neutral }: { pct: number | null; neutral?: boolean }) {
  if (pct === null) return <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">nuevo</span>;
  const up = pct >= 0;
  const tone = neutral ? "bg-muted text-muted-foreground" : up ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const value = Math.abs(pct) >= 1000 ? `${Math.round(pct / 100) / 10}k` : Math.round(pct);
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}>
      <Icon className="size-3" aria-hidden />
      {up ? "+" : "−"}
      {String(value).replace("-", "")}%
    </span>
  );
}

function Networks({ c }: { c: AgencyClientRow["connections"] }) {
  const items = [
    c.facebook && { k: "FB", cls: "bg-[#1877F2]/15 text-[#5b9bff]" },
    c.instagram && { k: "IG", cls: "bg-[#E1306C]/15 text-[#ff6fa0]" },
    c.tiktok && { k: "TT", cls: "bg-foreground/10 text-foreground/80" },
    c.ads && { k: "Ads", cls: "bg-amber-500/15 text-amber-500" },
  ].filter(Boolean) as Array<{ k: string; cls: string }>;
  return (
    <span className="flex gap-1">
      {items.map((i) => (
        <span key={i.k} className={`rounded px-1 py-px text-[9px] font-semibold leading-tight tracking-wide ${i.cls}`}>{i.k}</span>
      ))}
    </span>
  );
}

function HealthMeter({ score, label }: { score: number | null; label: string }) {
  const s = BAND_STYLE[band(score)];
  return (
    <div className="flex items-center justify-end gap-2.5">
      <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-muted lg:block" aria-hidden>
        <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.max(score ?? 0, 4)}%` }} />
      </div>
      <span className={`text-sm font-semibold tabular-nums ${s.text}`}>{score ?? "—"}</span>
      <span className={`hidden rounded-full px-2 py-0.5 text-[10px] font-medium xl:inline ${s.bg} ${s.text}`}>{label || s.label}</span>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, pct, previous, hint, neutral, index }: { icon: typeof Eye; label: string; value: string; pct?: number | null; previous?: string; hint: string; neutral?: boolean; index: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: index * 0.05 }}
      className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-foreground/70"><Icon className="size-3.5" /></span>
          {label}
        </span>
        {pct !== undefined && <Delta pct={pct} neutral={neutral} />}
      </div>
      <p className="mt-4 text-[30px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{previous ? <>Antes: <span className="tabular-nums">{previous}</span></> : hint}</p>
    </motion.div>
  );
}

const COLUMNS: Array<{ key: SortKey; label: string; className?: string; title?: string }> = [
  { key: "reach", label: "Visualizaciones" },
  { key: "reachDelta", label: "Var." },
  { key: "engagement", label: "Interacciones" },
  { key: "engagementRate", label: "ER", title: "Engagement rate" },
  { key: "growthRate", label: "Crec.", title: "Crecimiento de seguidores" },
  { key: "consistency", label: "Consist.", title: "Consistencia de publicación" },
  { key: "published", label: "Publ.", title: "Piezas publicadas" },
];

/**
 * Panel global de agencia: todos los clientes en una misma tabla comparable.
 *
 * La inversión NO se totaliza cuando hay varias monedas: un total que mezcla
 * divisas es un número inventado, así que se muestra el aviso en su lugar.
 */
export function AgencyAnalyticsPanel({ initial }: AgencyAnalyticsPanelProps) {
  const [data, setData] = useState<AgencyAnalytics>(initial);
  const [period, setPeriod] = useState<AnalyticsPeriod>(initial.period.days as AnalyticsPeriod);
  const [sortKey, setSortKey] = useState<SortKey>("healthScore");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const reduce = useReducedMotion();

  const rows = useMemo(() => [...data.clients].sort((a, b) => compare(a, b, sortKey)), [data.clients, sortKey]);

  const handlePeriodChange = (next: AnalyticsPeriod) => {
    setPeriod(next);
    setError(null);
    startTransition(async () => {
      const result = await getAgencyAnalytics(next);
      if (result.success && result.data) setData(result.data);
      else setError(result.error ?? "No se pudo cargar el período seleccionado.");
    });
  };

  const multiCurrency = data.totals.currencies.length > 1;
  const currency = data.totals.currencies[0] ?? "USD";
  const hasAds = data.clients.some((c) => c.adSpend > 0 || c.connections.ads);
  const maxReach = Math.max(...data.clients.map((c) => c.reach), 1);

  const insights = useMemo(() => {
    const scored = data.clients.filter((c) => c.healthScore !== null);
    const best = [...scored].sort((a, b) => b.healthScore! - a.healthScore!)[0];
    const grower = [...data.clients].filter((c) => c.reachDelta.pct !== null && c.reach >= 500).sort((a, b) => b.reachDelta.pct! - a.reachDelta.pct!)[0];
    const atRisk = scored.filter((c) => c.healthScore! < 50).sort((a, b) => a.healthScore! - b.healthScore!);
    const top = [...data.clients].sort((a, b) => b.reach - a.reach).slice(0, 3);
    const topShare = data.totals.reach.current ? Math.round((top.reduce((s, c) => s + c.reach, 0) / data.totals.reach.current) * 100) : 0;
    const bands = (["good", "ok", "warn", "bad", "none"] as HealthBand[]).map((b) => ({ b, n: data.clients.filter((c) => band(c.healthScore) === b).length }));
    return { best, grower, atRisk, top, topShare, bands };
  }, [data]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Cartera</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.035em]">Analítica de agencia</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.totals.clients} clientes activos · {data.totals.published} piezas publicadas · últimos {data.period.days} días
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Recalculando" />}
          <PeriodSelector value={period} onChange={handlePeriodChange} disabled={isPending} />
          <DownloadCsvButton build={() => buildAgencyAnalyticsCsv(data)} filename={`analitica_agencia_${data.period.days}d.csv`} />
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <div className={`space-y-6 transition-opacity duration-200 ${isPending ? "pointer-events-none opacity-60" : ""}`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi index={0} icon={Eye} label="Visualizaciones" value={formatNumber(data.totals.reach.current)} pct={data.totals.reach.pct} previous={formatNumber(data.totals.reach.previous)} hint="" />
          <Kpi index={1} icon={MousePointerClick} label="Interacciones" value={formatNumber(data.totals.engagement.current)} pct={data.totals.engagement.pct} previous={formatNumber(data.totals.engagement.previous)} hint="" />
          <Kpi index={2} icon={Users} label="Comunidad total" value={formatNumber(data.totals.followers)} hint="Seguidores sumados al cierre del período" />
          {multiCurrency ? (
            <Kpi index={3} icon={Wallet} label="Inversión" value="Varias monedas" hint={`${data.totals.currencies.join(", ")}: revisa cada cliente`} />
          ) : (
            <Kpi index={3} icon={Wallet} label={`Inversión en Ads (${currency})`} value={formatNumber(data.totals.adSpend.current)} pct={data.totals.adSpend.current || data.totals.adSpend.previous ? data.totals.adSpend.pct : undefined} neutral previous={data.totals.adSpend.previous ? formatNumber(data.totals.adSpend.previous) : undefined} hint="Sin inversión registrada en el período" />
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <section className="rounded-2xl border border-border/70 bg-card p-5 lg:col-span-1">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><HeartPulse className="size-4 text-muted-foreground" />Salud de la cartera</h2>
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-muted">
              {insights.bands.filter((x) => x.n).map((x) => (
                <motion.div key={x.b} className={BAND_STYLE[x.b].bar} initial={reduce ? false : { width: 0 }} animate={{ width: `${(x.n / Math.max(data.clients.length, 1)) * 100}%` }} transition={{ duration: 0.6, ease: EASE }} />
              ))}
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
              {insights.bands.filter((x) => x.b !== "none" || x.n).map((x) => (
                <li key={x.b} className="flex items-center gap-2 text-xs">
                  <span className={`size-2 rounded-full ${BAND_STYLE[x.b].bar}`} />
                  <span className="flex-1 text-muted-foreground">{BAND_STYLE[x.b].label}</span>
                  <span className="font-semibold tabular-nums">{x.n}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-3 sm:grid-cols-3 lg:col-span-2">
            <Insight icon={Trophy} tone="text-emerald-500 bg-emerald-500/10" label="Mejor salud" title={insights.best?.name ?? "—"} detail={insights.best ? `Score ${insights.best.healthScore} · ER ${formatRatio(insights.best.engagementRate, "%")}` : "Sin datos suficientes"} href={insights.best && `/clients/${insights.best.clientId}`} />
            <Insight icon={TrendingUp} tone="text-sky-500 bg-sky-500/10" label="Mayor crecimiento" title={insights.grower?.name ?? "—"} detail={insights.grower ? `${insights.grower.reachDelta.pct! >= 0 ? "+" : ""}${Math.round(insights.grower.reachDelta.pct!)}% visualizaciones` : "Sin variaciones comparables"} href={insights.grower && `/clients/${insights.grower.clientId}`} />
            <Insight icon={TriangleAlert} tone="text-amber-500 bg-amber-500/10" label="Necesitan atención" title={`${insights.atRisk.length} ${insights.atRisk.length === 1 ? "cliente" : "clientes"}`} detail={insights.atRisk.length ? insights.atRisk.slice(0, 2).map((c) => c.name).join(", ") : "Toda la cartera sobre 50"} onClick={insights.atRisk.length ? () => setSortKey("healthScore") : undefined} />
            <div className="rounded-2xl border border-border/70 bg-card p-5 sm:col-span-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-muted-foreground" />Concentración de visualizaciones</h2>
                <span className="text-xs text-muted-foreground">Top 3 = <span className="font-semibold text-foreground tabular-nums">{insights.topShare}%</span></span>
              </div>
              <div className="mt-4 space-y-2.5">
                {insights.top.map((c, i) => (
                  <div key={c.clientId} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 text-xs">
                    <span className="truncate text-muted-foreground">{c.name}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <motion.div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500" initial={reduce ? false : { width: 0 }} animate={{ width: `${(c.reach / maxReach) * 100}%` }} transition={{ duration: 0.6, ease: EASE, delay: 0.1 + i * 0.06 }} />
                    </div>
                    <span className="font-semibold tabular-nums">{formatNumber(c.reach)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">Clientes</h2>
              <p className="text-xs text-muted-foreground">Toca un encabezado para ordenar</p>
            </div>
            <label className="relative flex items-center gap-2 text-xs text-muted-foreground md:hidden">
              Ordenar
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="h-8 appearance-none rounded-lg border bg-background pl-2.5 pr-7 text-xs text-foreground">
                <option value="healthScore">Salud</option>
                {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.title ?? c.label}</option>)}
                <option value="name">Nombre</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 size-3.5" />
            </label>
          </div>

          {/* Tabla (md+) */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  <SortTh active={sortKey === "name"} onClick={() => setSortKey("name")} className="sticky left-0 z-10 bg-card pl-5">Cliente</SortTh>
                  {COLUMNS.map((c) => (
                    <SortTh key={c.key} active={sortKey === c.key} onClick={() => setSortKey(c.key)} title={c.title} align="right">{c.label}</SortTh>
                  ))}
                  {hasAds && <SortTh active={sortKey === "adSpend"} onClick={() => setSortKey("adSpend")} align="right">Inversión</SortTh>}
                  {hasAds && <SortTh active={sortKey === "roas"} onClick={() => setSortKey("roas")} align="right">ROAS</SortTh>}
                  <SortTh active={sortKey === "healthScore"} onClick={() => setSortKey("healthScore")} align="right" className="pr-5">Salud</SortTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((client) => (
                  <tr key={client.clientId} className="group transition-colors hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-card py-3 pl-5 pr-3 transition-colors group-hover:bg-muted/30">
                      <Link href={`/clients/${client.clientId}`} className="flex min-w-[200px] items-center gap-3">
                        <ClientAvatar name={client.name} logo={client.logo} />
                        <span className="min-w-0">
                          <span className="block max-w-[240px] truncate font-medium group-hover:underline">{client.name}</span>
                          <span className="mt-1 block"><Networks c={client.connections} /></span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="tabular-nums">{formatNumber(client.reach)}</span>
                        <span className="h-1 w-16 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-sky-500/70" style={{ width: `${(client.reach / maxReach) * 100}%` }} /></span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right"><Delta pct={client.reachDelta.pct} /></td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(client.engagement)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatRatio(client.engagementRate, "%")}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{formatRatio(client.growthRate, "%")}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{formatRatio(client.consistency, "%", 0)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{client.published}</td>
                    {hasAds && <td className="px-3 py-3 text-right tabular-nums">{client.adSpend ? formatNumber(client.adSpend) : <span className="text-muted-foreground">—</span>}</td>}
                    {hasAds && <td className="px-3 py-3 text-right tabular-nums">{formatRatio(client.roas, "x")}</td>}
                    <td className="py-3 pl-3 pr-5"><HealthMeter score={client.healthScore} label={client.healthLabel} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lista (móvil) */}
          <ul className="divide-y divide-border/60 md:hidden">
            {rows.map((client) => (
              <li key={client.clientId}>
                <Link href={`/clients/${client.clientId}`} className="flex items-center gap-3 px-5 py-3.5 active:bg-muted/40">
                  <ClientAvatar name={client.name} logo={client.logo} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{client.name}</span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="tabular-nums">{formatNumber(client.reach)} vis.</span>
                      <Delta pct={client.reachDelta.pct} />
                      <span className="tabular-nums">ER {formatRatio(client.engagementRate, "%")}</span>
                    </span>
                  </span>
                  <HealthMeter score={client.healthScore} label={client.healthLabel} />
                </Link>
              </li>
            ))}
          </ul>

          <p className="border-t border-border/70 px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">
            El score de salud pondera engagement rate, crecimiento, consistencia de publicación y tendencia de visualizaciones. Sirve para comparar clientes entre sí y seguir su evolución, no como referencia de industria.
          </p>
        </section>
      </div>
    </div>
  );
}

function SortTh({ children, active, onClick, align, className = "", title }: { children: React.ReactNode; active: boolean; onClick: () => void; align?: "right"; className?: string; title?: string }) {
  return (
    <th className={`px-3 py-3 font-medium ${align === "right" ? "text-right" : ""} ${className}`} aria-sort={active ? "descending" : "none"}>
      <button type="button" onClick={onClick} title={title} className={`inline-flex items-center gap-1 rounded transition-colors hover:text-foreground ${active ? "text-foreground" : ""}`}>
        {children}
        <ChevronDown className={`size-3 transition-opacity ${active ? "opacity-100" : "opacity-0"}`} aria-hidden />
      </button>
    </th>
  );
}

function Insight({ icon: Icon, tone, label, title, detail, href, onClick }: { icon: typeof Trophy; tone: string; label: string; title: string; detail: string; href?: string | null; onClick?: () => void }) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`flex size-7 items-center justify-center rounded-lg ${tone}`}><Icon className="size-3.5" /></span>{label}</span>
      <p className="mt-3 truncate text-[15px] font-semibold tracking-[-0.01em]">{title}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
    </>
  );
  const cls = "block rounded-2xl border border-border/70 bg-card p-5 text-left";
  const interactive = "transition-[border-color,transform] duration-150 ease-out hover:border-foreground/20 active:scale-[0.98]";
  if (href) return <Link href={href} className={`${cls} ${interactive}`}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`${cls} ${interactive}`}>{body}</button>;
  return <div className={cls}>{body}</div>;
}
