import type { SocialReportData } from "@/lib/reports/social-report-data";
import { AdsSection } from "./ads-section";
import { KpiTile } from "./kpi-tile";
import { PrintReportButton } from "./print-report-button";
import { ReachTrendChartClient } from "./reach-trend-chart-client";
import { REPORT_SERIES, formatCurrency, formatNumber, formatRatio } from "./report-tokens";

interface SocialReportBodyProps {
  data: SocialReportData;
}

/**
 * Cuerpo del informe social, compartido por la ficha interna del cliente y el
 * enlace público. Una sola fuente para que las dos vistas nunca diverjan.
 *
 * Orden de lectura, pensado para un dueño de negocio no técnico:
 *   1. Veredicto en una frase, después cuatro KPIs con su base de comparación.
 *   2. Una sola gráfica de tendencia.
 *   3. Una tarjeta por red, con estado explícito si no está conectada.
 *   4. Anuncios: primero el dinero.
 *   5. Contenido publicado.
 *   6. Narrativa.
 *   7. Pie con período, atribución y qué falta.
 */
export function SocialReportBody({ data }: SocialReportBodyProps) {
  const activePlatforms = data.platforms
    .filter((p) => p.connected && p.hasData)
    .map((p) => p.platform.toLowerCase() as "facebook" | "instagram" | "tiktok");

  const currency = data.headline.currency ?? "USD";

  return (
    <article className="mx-auto max-w-5xl space-y-10 p-4 sm:p-6 print:max-w-none print:space-y-6 print:p-0">
      {/* 1. Portada */}
      <header className="print:break-after-avoid">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {data.client.name}
            </p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
              Informe de {data.period.label}
            </h1>
          </div>
          <PrintReportButton />
        </div>

        <p className="mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">
          {data.headline.verdict}
        </p>
      </header>

      {/* Cuatro KPIs, ni uno más: el resto es detalle */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
        <KpiTile
          label="Visualizaciones"
          value={formatNumber(data.headline.reach.current)}
          delta={data.headline.reach}
          previousFormatted={formatNumber(data.headline.reach.previous)}
          previousLabel={data.period.previousLabel}
          hint="Veces que se mostró tu contenido en todas las redes."
        />
        <KpiTile
          label="Interacciones"
          value={formatNumber(data.headline.engagement.current)}
          delta={data.headline.engagement}
          previousFormatted={formatNumber(data.headline.engagement.previous)}
          previousLabel={data.period.previousLabel}
          hint="Me gusta, comentarios, compartidos y guardados."
        />
        <KpiTile
          label="Seguidores"
          value={formatNumber(data.headline.followers.current)}
          delta={data.headline.followers}
          previousFormatted={formatNumber(data.headline.followers.previous)}
          previousLabel={data.period.previousLabel}
          hint="Total de seguidores al cierre del mes."
        />
        <KpiTile
          label="Inversión en anuncios"
          value={formatCurrency(data.headline.adSpend.current, currency)}
          delta={data.headline.adSpend}
          previousFormatted={formatCurrency(data.headline.adSpend.previous, currency)}
          previousLabel={data.period.previousLabel}
          hint="Presupuesto gastado en pauta durante el mes."
          neutralDirection
        />
      </section>

      {/* 2. La tendencia: un gráfico, no una grilla */}
      <section className="space-y-3 print:break-inside-avoid">
        <div>
          <h2 className="text-lg font-semibold">Cómo evolucionó el mes</h2>
          <p className="text-sm text-muted-foreground">
            Visualizaciones diarias por red.
          </p>
        </div>
        <ReachTrendChartClient data={data.trend} activePlatforms={activePlatforms} />
      </section>

      {/* 3. Por red, con estado explícito */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Detalle por red</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 print:grid-cols-3">
          {data.platforms.map((platform) => {
            const key = platform.platform.toLowerCase() as keyof typeof REPORT_SERIES;
            return (
              <div
                key={platform.platform}
                className="rounded-xl border bg-card p-4 print:break-inside-avoid"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: REPORT_SERIES[key].light }}
                    aria-hidden
                  />
                  <h3 className="font-medium">{platform.label}</h3>
                </div>

                {!platform.connected ? (
                  // El silencio se lee como cero: hay que decirlo explícitamente.
                  <p className="mt-3 text-sm text-muted-foreground">
                    No conectado. Este informe no incluye datos de esta red.
                  </p>
                ) : !platform.hasData ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Conectado, sin datos registrados en el período.
                  </p>
                ) : (
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-muted-foreground">Visualizaciones</dt>
                      <dd className="font-medium tabular-nums">
                        {formatNumber(platform.reach)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-muted-foreground">Interacciones</dt>
                      <dd className="font-medium tabular-nums">
                        {formatNumber(platform.engagement)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-muted-foreground">Seguidores</dt>
                      <dd className="font-medium tabular-nums">
                        {formatNumber(platform.followers)}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Anuncios */}
      <AdsSection ads={data.ads} />

      {/* 5. Contenido publicado */}
      <section className="rounded-xl border bg-card p-4 print:break-inside-avoid">
        <h2 className="text-lg font-semibold">Contenido publicado</h2>
        <div className="mt-3 flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-2xl font-semibold tabular-nums">
              {formatNumber(data.content.published)}
            </p>
            <p className="text-muted-foreground">Publicaciones</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">
              {formatNumber(data.content.reels)}
            </p>
            <p className="text-muted-foreground">Reels</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">
              {formatNumber(data.content.flyers)}
            </p>
            <p className="text-muted-foreground">Flyers</p>
          </div>
        </div>
      </section>

      {/* 5b. Métricas calculadas */}
      <section className="rounded-xl border bg-card p-4 print:break-inside-avoid">
        <h2 className="text-lg font-semibold">Métricas calculadas</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          No las entrega Meta: se derivan de los datos del mes. Un guion significa que falta el
          denominador para calcularlas, no que el valor sea cero.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
          {data.derived.map((metric) => (
            <div key={metric.label}>
              <p className="text-2xl font-semibold tabular-nums leading-none">
                {metric.value === null
                  ? "—"
                  : metric.unit === "percent"
                    ? formatRatio(metric.value, "%")
                    : metric.unit === "currency"
                      ? formatCurrency(metric.value, data.headline.currency ?? "USD")
                      : formatNumber(metric.value)}
              </p>
              <p className="mt-1 text-sm font-medium">{metric.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{metric.hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Narrativa */}
      {data.narrative.summary && (
        <section className="rounded-xl border bg-muted/30 p-4 print:break-inside-avoid">
          <h2 className="text-lg font-semibold">Análisis y próximos pasos</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
            {data.narrative.summary}
          </p>
        </section>
      )}

      {/* 7. Pie: período, atribución y qué falta */}
      <footer className="space-y-3 border-t pt-6 text-xs text-muted-foreground print:pt-4">
        {data.dataQuality.length > 0 && (
          <div>
            <p className="font-medium">Notas sobre los datos</p>
            <ul className="mt-1 space-y-0.5">
              {data.dataQuality.map((note) => (
                <li key={note.label}>
                  <span className="font-medium">{note.label}:</span> {note.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.ads.hasData && (
          <p>
            Los resultados de anuncios usan una ventana de atribución de{" "}
            {data.ads.attributionWindow}. Por eso pueden diferir de los números de
            tu propio sistema de ventas.
          </p>
        )}

        <p>
          Período: {data.period.label}. Comparado contra {data.period.previousLabel}.
          Generado el{" "}
          {new Intl.DateTimeFormat("es-EC", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(data.generatedAt)}{" "}
          por Totem OS.
        </p>
      </footer>
    </article>
  );
}
