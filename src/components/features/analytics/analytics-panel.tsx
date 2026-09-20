"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { getClientAnalytics } from "@/actions/metrics-actions";
import { KpiTile } from "@/components/features/reports/social-report/kpi-tile";
import { ReachTrendChart } from "@/components/features/reports/social-report/reach-trend-chart";
import {
  formatCurrency,
  formatNumber,
  formatRatio,
} from "@/components/features/reports/social-report/report-tokens";
import type { AnalyticsPeriod, ClientAnalytics } from "@/lib/metrics/analytics-data";
import { buildClientAnalyticsCsv } from "@/lib/metrics/analytics-csv";
import { AdsPerformance } from "./ads-performance";
import { AudienceDemographics } from "./audience-demographics";
import { DownloadCsvButton } from "./download-csv-button";
import { MetricCard } from "./metric-card";
import { PeriodSelector } from "./period-selector";
import { PlatformBreakdown } from "./platform-breakdown";
import { TopContentTable } from "./top-content-table";

interface AnalyticsPanelProps {
  clientId: string;
  initial: ClientAnalytics;
  /** Acciones de la cabecera (sincronizar, informe mensual). */
  actions?: React.ReactNode;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Panel de analítica de un cliente.
 *
 * El cambio de período vuelve a pedir los datos al servidor en vez de filtrar
 * en el cliente: las comparaciones contra el período anterior y las derivadas
 * se calculan sobre la ventana completa, y recortar en memoria daría números
 * distintos a los del informe.
 */
export function AnalyticsPanel({ clientId, initial, actions }: AnalyticsPanelProps) {
  const [data, setData] = useState<ClientAnalytics>(initial);
  const [period, setPeriod] = useState<AnalyticsPeriod>(
    initial.period.days as AnalyticsPeriod
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handlePeriodChange = (next: AnalyticsPeriod) => {
    setPeriod(next);
    setError(null);
    startTransition(async () => {
      const result = await getClientAnalytics(clientId, next);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error ?? "No se pudo cargar el período seleccionado.");
      }
    });
  };

  const { headline, derived, period: window } = data;
  const currency = headline.currency ?? "USD";
  const activePlatforms = data.platforms
    .filter((p) => p.connected)
    .map((p) => p.platform.toLowerCase() as "facebook" | "instagram" | "tiktok");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Analítica de Meta</h2>
          <p className="text-sm text-muted-foreground">
            {window.label} · comparado con {window.previousLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector value={period} onChange={handlePeriodChange} disabled={isPending} />
          <DownloadCsvButton
            build={() => buildClientAnalyticsCsv(data)}
            filename={`analitica_${data.client.name.replace(/\s+/g, "_").toLowerCase()}_${window.days}d.csv`}
          />
          {actions}
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : null}

      <div className={isPending ? "pointer-events-none space-y-8 opacity-60" : "space-y-8"}>
        {isPending ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Recalculando {period} días…
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile
            label="Visualizaciones"
            value={formatNumber(headline.reach.current)}
            delta={headline.reach}
            previousFormatted={formatNumber(headline.reach.previous)}
            previousLabel="Período anterior"
            hint="Veces que se mostró el contenido en todas las redes conectadas."
          />
          <KpiTile
            label="Interacciones"
            value={formatNumber(headline.engagement.current)}
            delta={headline.engagement}
            previousFormatted={formatNumber(headline.engagement.previous)}
            previousLabel="Período anterior"
            hint="Reacciones, comentarios, compartidos y guardados sumados."
          />
          <KpiTile
            label="Comunidad"
            value={formatNumber(headline.followers.current)}
            delta={headline.followers}
            previousFormatted={formatNumber(headline.followers.previous)}
            previousLabel="Período anterior"
            hint="Seguidores al cierre del período, no la suma de los días."
          />
          <KpiTile
            label="Inversión publicitaria"
            value={formatCurrency(headline.adSpend.current, currency)}
            delta={headline.adSpend}
            previousFormatted={formatCurrency(headline.adSpend.previous, currency)}
            previousLabel="Período anterior"
            hint="Gasto en anuncios de Meta durante el período."
            neutralDirection
          />
        </div>

        <Section
          title="Métricas calculadas"
          description="No las entrega Meta: se derivan de los datos sincronizados. Un guion significa que falta el denominador, no que el valor sea cero."
        >
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Engagement rate"
              value={formatRatio(derived.engagementRate, "%")}
              footnote={`Antes: ${formatRatio(derived.engagementRatePrevious, "%")}`}
              hint="Interacciones ÷ visualizaciones. Mide el contenido."
            />
            <MetricCard
              label="Crecimiento"
              value={formatRatio(derived.growthRate, "%")}
              footnote={`${derived.netFollowers >= 0 ? "+" : ""}${formatNumber(derived.netFollowers)} netos`}
              hint="Variación de seguidores frente al período anterior."
            />
            <MetricCard
              label="Viralidad"
              value={formatRatio(derived.virality, "%")}
              hint="Compartidos ÷ visualizaciones. Alcance que gana solo."
            />
            <MetricCard
              label="Tasa de guardado"
              value={formatRatio(derived.saveRate, "%")}
              hint="Guardados ÷ visualizaciones. Señal de contenido útil."
            />
            <MetricCard
              label="Conversión de perfil"
              value={formatRatio(derived.profileConversion, "%")}
              hint="Clics a enlaces ÷ visitas al perfil."
            />
            <MetricCard
              label="Alcance por publicación"
              value={derived.reachPerPost === null ? "—" : formatNumber(derived.reachPerPost)}
              footnote={`${data.content.published} piezas publicadas`}
              hint="Visualizaciones ÷ publicaciones del período."
            />
            <MetricCard
              label="Consistencia"
              value={formatRatio(derived.consistency, "%")}
              footnote={`${data.content.daysWithPosts} de ${window.days} días`}
              hint="Días con publicación sobre los días del período."
            />
            <MetricCard
              label="Costo por interacción"
              value={
                derived.costPerInteraction === null
                  ? "—"
                  : formatCurrency(derived.costPerInteraction, currency)
              }
              hint="Fee del plan prorrateado ÷ interacciones."
            />
            <MetricCard
              label="Alcance orgánico"
              value={formatRatio(derived.organicShare, "%")}
              hint="Parte del alcance que no vino de pauta."
            />
            <MetricCard
              label="Saturación de pauta"
              value={formatRatio(derived.adSaturation, "x")}
              hint="Veces que cada persona vio el anuncio. Sobre 3, desgaste."
            />
            <MetricCard
              label="Costo real por resultado"
              value={
                derived.totalCostPerResult === null
                  ? "—"
                  : formatCurrency(derived.totalCostPerResult, currency)
              }
              hint="Inversión + fee prorrateado ÷ resultados."
            />
            <MetricCard
              label="Salud de la cuenta"
              value={derived.healthScore === null ? "—" : `${derived.healthScore}/100`}
              footnote={derived.healthLabel}
              hint="Resumen ponderado de ER, crecimiento, consistencia y tendencia."
            />
          </div>
          {derived.projectedMonthlyReach !== null ? (
            <p className="text-xs text-muted-foreground">
              Al ritmo actual, el mes cerraría en{" "}
              <strong className="font-semibold text-foreground">
                {formatNumber(derived.projectedMonthlyReach)}
              </strong>{" "}
              visualizaciones.
            </p>
          ) : null}
        </Section>

        <Section title="Tendencia" description="Visualizaciones diarias por red.">
          <div className="rounded-xl border bg-card p-4">
            <ReachTrendChart data={data.trend} activePlatforms={activePlatforms} />
          </div>
        </Section>

        <Section title="Por plataforma">
          <PlatformBreakdown platforms={data.platforms} />
        </Section>

        <Section
          title="Rendimiento por publicación"
          description="Las publicaciones siguen acumulando datos durante días: cada sincronización actualiza su fila."
        >
          <TopContentTable media={data.media} />
        </Section>

        <Section title="Publicidad">
          <AdsPerformance ads={data.ads} />
        </Section>

        <Section title="Audiencia" description="Demografía de seguidores de Instagram.">
          <AudienceDemographics audience={data.audience} />
        </Section>

        {data.dataQuality.length > 0 ? (
          <Section
            title="Qué no cubre este panel"
            description="Un hueco de datos no es un cero: aquí se declara lo que falta."
          >
            <ul className="space-y-1.5 rounded-xl border bg-muted/30 p-4">
              {data.dataQuality.map((note, index) => (
                <li key={`${note.label}-${index}`} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{note.label}:</span> {note.detail}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
