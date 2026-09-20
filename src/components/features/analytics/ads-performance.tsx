import {
  formatCurrency,
  formatNumber,
  formatRatio,
} from "@/components/features/reports/social-report/report-tokens";
import type { AdsAnalytics } from "@/lib/metrics/analytics-data";

interface AdsPerformanceProps {
  ads: AdsAnalytics;
}

/**
 * Rendimiento publicitario, un bloque por moneda.
 *
 * Nunca se suman divisas distintas: con varias cuentas publicitarias pueden
 * convivir USD y otra moneda, y un total mezclado es un número inventado.
 * Todos los ratios vienen de `computeAdEfficiency`, que los deriva de
 * numeradores y denominadores ya sumados.
 */
export function AdsPerformance({ ads }: AdsPerformanceProps) {
  if (!ads.connected) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Sin cuentas publicitarias vinculadas a este cliente.
      </div>
    );
  }

  if (!ads.hasData) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Sin inversión publicitaria registrada en este período.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ads.byCurrency.map((block) => (
        <div key={block.currency} className="rounded-xl border bg-card">
          <div className="grid grid-cols-2 gap-4 border-b p-4 sm:grid-cols-4 lg:grid-cols-7">
            <Stat label="Inversión" value={formatCurrency(block.totals.spend, block.currency)} />
            <Stat label="Impresiones" value={formatNumber(block.totals.impressions)} />
            <Stat label="Alcance" value={formatNumber(block.totals.reach)} />
            <Stat label="CTR" value={formatRatio(block.totals.ctr, "%")} />
            <Stat
              label="CPC"
              value={block.totals.cpc === null ? "—" : formatCurrency(block.totals.cpc, block.currency)}
            />
            <Stat
              label="CPM"
              value={block.totals.cpm === null ? "—" : formatCurrency(block.totals.cpm, block.currency)}
            />
            <Stat label="ROAS" value={formatRatio(block.totals.roas, "x")} />
          </div>

          <div className="grid grid-cols-2 gap-4 border-b bg-muted/30 p-4 sm:grid-cols-4">
            <Stat label="Resultados" value={formatNumber(block.totals.conversions)} />
            <Stat
              label="CPA (Meta)"
              value={block.totals.cpa === null ? "—" : formatCurrency(block.totals.cpa, block.currency)}
              hint="Solo inversión publicitaria"
            />
            <Stat
              label="Costo real por resultado"
              value={
                block.totalCostPerResult === null
                  ? "—"
                  : formatCurrency(block.totalCostPerResult, block.currency)
              }
              hint="Inversión + fee prorrateado"
            />
            <Stat
              label="Frecuencia"
              value={formatRatio(block.saturation, "x")}
              hint="Sobre 3 indica desgaste"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="p-3 font-medium">Campaña</th>
                  <th className="p-3 font-medium text-right">Inversión</th>
                  <th className="p-3 font-medium text-right">% del total</th>
                  <th className="p-3 font-medium text-right">Impresiones</th>
                  <th className="p-3 font-medium text-right">Clics</th>
                  <th className="p-3 font-medium text-right">CTR</th>
                  <th className="p-3 font-medium text-right">Resultados</th>
                  <th className="p-3 font-medium text-right">CPA</th>
                  <th className="p-3 font-medium text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {block.campaigns.map((campaign) => (
                  <tr key={campaign.campaignId} className="border-b last:border-0">
                    <td className="max-w-[240px] truncate p-3">{campaign.campaignName}</td>
                    <td className="p-3 text-right tabular-nums">
                      {formatCurrency(campaign.spend, block.currency)}
                    </td>
                    <td className="p-3 text-right tabular-nums">{campaign.share.toFixed(1)}%</td>
                    <td className="p-3 text-right tabular-nums">{formatNumber(campaign.impressions)}</td>
                    <td className="p-3 text-right tabular-nums">{formatNumber(campaign.clicks)}</td>
                    <td className="p-3 text-right tabular-nums">{formatRatio(campaign.ctr, "%")}</td>
                    <td className="p-3 text-right tabular-nums">{formatNumber(campaign.conversions)}</td>
                    <td className="p-3 text-right tabular-nums">
                      {campaign.cpa === null ? "—" : formatCurrency(campaign.cpa, block.currency)}
                    </td>
                    <td className="p-3 text-right tabular-nums">{formatRatio(campaign.roas, "x")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="border-t p-3 text-[11px] text-muted-foreground">
            Ventana de atribución: {ads.attributionWindow}. Moneda: {block.currency}.
          </p>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums leading-none">{value}</p>
      {hint ? <p className="mt-1 text-[10px] text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}
