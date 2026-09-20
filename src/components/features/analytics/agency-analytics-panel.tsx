"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { getAgencyAnalytics } from "@/actions/metrics-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiTile } from "@/components/features/reports/social-report/kpi-tile";
import {
  formatNumber,
  formatRatio,
} from "@/components/features/reports/social-report/report-tokens";
import type { AgencyAnalytics, AgencyClientRow } from "@/lib/metrics/agency-analytics-data";
import type { AnalyticsPeriod } from "@/lib/metrics/analytics-data";
import { buildAgencyAnalyticsCsv } from "@/lib/metrics/analytics-csv";
import { DownloadCsvButton } from "./download-csv-button";
import { PeriodSelector } from "./period-selector";

type SortKey = "name" | "reach" | "engagementRate" | "growthRate" | "healthScore" | "adSpend";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "healthScore", label: "Salud" },
  { key: "reach", label: "Visualizaciones" },
  { key: "engagementRate", label: "Engagement rate" },
  { key: "growthRate", label: "Crecimiento" },
  { key: "adSpend", label: "Inversión" },
  { key: "name", label: "Nombre" },
];

interface AgencyAnalyticsPanelProps {
  initial: AgencyAnalytics;
}

function compare(a: AgencyClientRow, b: AgencyClientRow, key: SortKey): number {
  if (key === "name") return a.name.localeCompare(b.name, "es");
  // Un valor no calculable va al final, no al principio: ordenar por "mejor
  // ER" no debería encabezarse con las cuentas que no tienen ER.
  const left = a[key] ?? Number.NEGATIVE_INFINITY;
  const right = b[key] ?? Number.NEGATIVE_INFINITY;
  return Number(right) - Number(left);
}

function scoreTone(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 75) return "text-emerald-700 dark:text-emerald-400";
  if (score >= 50) return "text-foreground";
  if (score >= 25) return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}

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

  const rows = useMemo(
    () => [...data.clients].sort((a, b) => compare(a, b, sortKey)),
    [data.clients, sortKey]
  );

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analítica de agencia</h1>
          <p className="text-sm text-muted-foreground">
            {data.totals.clients} clientes activos · últimos {data.period.days} días
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector value={period} onChange={handlePeriodChange} disabled={isPending} />
          <DownloadCsvButton
            build={() => buildAgencyAnalyticsCsv(data)}
            filename={`analitica_agencia_${data.period.days}d.csv`}
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : null}

      <div className={isPending ? "pointer-events-none space-y-6 opacity-60" : "space-y-6"}>
        {isPending ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Recalculando {period} días…
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile
            label="Visualizaciones"
            value={formatNumber(data.totals.reach.current)}
            delta={data.totals.reach}
            previousFormatted={formatNumber(data.totals.reach.previous)}
            previousLabel="Período anterior"
            hint="Suma de todas las redes de todos los clientes activos."
          />
          <KpiTile
            label="Interacciones"
            value={formatNumber(data.totals.engagement.current)}
            delta={data.totals.engagement}
            previousFormatted={formatNumber(data.totals.engagement.previous)}
            previousLabel="Período anterior"
            hint="Reacciones, comentarios, compartidos y guardados."
          />
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Comunidad total
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums leading-none">
              {formatNumber(data.totals.followers)}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground/80">
              Seguidores sumados al cierre del período.
            </p>
          </div>
          {multiCurrency ? (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Inversión
              </p>
              <p className="mt-2 text-lg font-semibold leading-tight">Varias monedas</p>
              <p className="mt-2 text-[11px] text-muted-foreground/80">
                Hay inversión en {data.totals.currencies.join(", ")}: no se suma. Revisa cada
                cliente por separado.
              </p>
            </div>
          ) : (
            <KpiTile
              label={`Inversión (${currency})`}
              value={formatNumber(data.totals.adSpend.current)}
              delta={data.totals.adSpend}
              previousFormatted={formatNumber(data.totals.adSpend.previous)}
              previousLabel="Período anterior"
              hint="Gasto en anuncios de Meta de toda la cartera."
              neutralDirection
            />
          )}
        </div>

        <div className="rounded-xl border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <span className="text-xs text-muted-foreground">Ordenar por</span>
            {SORTS.map((option) => (
              <Button
                key={option.key}
                type="button"
                size="sm"
                variant={option.key === sortKey ? "secondary" : "ghost"}
                className="h-7 px-2 text-xs"
                aria-pressed={option.key === sortKey}
                onClick={() => setSortKey(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="p-3 font-medium">Cliente</th>
                  <th className="p-3 font-medium text-right">Visualizaciones</th>
                  <th className="p-3 font-medium text-right">Var.</th>
                  <th className="p-3 font-medium text-right">Interacciones</th>
                  <th className="p-3 font-medium text-right">ER</th>
                  <th className="p-3 font-medium text-right">Crecimiento</th>
                  <th className="p-3 font-medium text-right">Consistencia</th>
                  <th className="p-3 font-medium text-right">Publicado</th>
                  <th className="p-3 font-medium text-right">Inversión</th>
                  <th className="p-3 font-medium text-right">ROAS</th>
                  <th className="p-3 font-medium text-right">Salud</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((client) => (
                  <tr key={client.clientId} className="border-b last:border-0">
                    <td className="p-3">
                      <Link
                        href={`/clients/${client.clientId}`}
                        className="font-medium hover:underline"
                      >
                        {client.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {client.connections.facebook ? (
                          <Badge variant="outline" className="text-[10px]">FB</Badge>
                        ) : null}
                        {client.connections.instagram ? (
                          <Badge variant="outline" className="text-[10px]">IG</Badge>
                        ) : null}
                        {client.connections.tiktok ? (
                          <Badge variant="outline" className="text-[10px]">TT</Badge>
                        ) : null}
                        {client.connections.ads ? (
                          <Badge variant="outline" className="text-[10px]">Ads</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3 text-right tabular-nums">{formatNumber(client.reach)}</td>
                    <td className="p-3 text-right tabular-nums text-muted-foreground">
                      {client.reachDelta.pct === null
                        ? "nuevo"
                        : `${client.reachDelta.pct > 0 ? "+" : ""}${Math.round(client.reachDelta.pct)}%`}
                    </td>
                    <td className="p-3 text-right tabular-nums">{formatNumber(client.engagement)}</td>
                    <td className="p-3 text-right tabular-nums">
                      {formatRatio(client.engagementRate, "%")}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatRatio(client.growthRate, "%")}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatRatio(client.consistency, "%", 0)}
                    </td>
                    <td className="p-3 text-right tabular-nums">{client.published}</td>
                    <td className="p-3 text-right tabular-nums">{formatNumber(client.adSpend)}</td>
                    <td className="p-3 text-right tabular-nums">{formatRatio(client.roas, "x")}</td>
                    <td className={`p-3 text-right tabular-nums font-medium ${scoreTone(client.healthScore)}`}>
                      {client.healthScore === null ? "—" : client.healthScore}
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                        {client.healthLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="border-t p-3 text-[11px] text-muted-foreground">
            El score de salud pondera engagement rate, crecimiento, consistencia de publicación y
            tendencia de visualizaciones. Sirve para comparar clientes entre sí y seguir su
            evolución, no como referencia de industria.
          </p>
        </div>
      </div>
    </div>
  );
}
