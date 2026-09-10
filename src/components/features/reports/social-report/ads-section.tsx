import type { AdsSection as AdsSectionData } from "@/lib/reports/social-report-data";
import { formatCurrency, formatNumber, formatRatio } from "./report-tokens";

interface AdsSectionProps {
  ads: AdsSectionData;
}

/**
 * Sección de anuncios: primero el dinero, después el detalle.
 *
 * Las etiquetas están en lenguaje de negocio ("Costo por resultado", no "CPA")
 * con el término técnico como nota, porque quien lee esto es el dueño del
 * negocio, no un pauta.
 *
 * Cada moneda va en su propio bloque: con varias cuentas publicitarias pueden
 * convivir divisas distintas, y un total mezclado sería un número inventado.
 */
export function AdsSection({ ads }: AdsSectionProps) {
  if (!ads.connected) {
    return (
      <section className="rounded-xl border border-dashed p-6 print:break-inside-avoid">
        <h2 className="text-lg font-semibold">Anuncios</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No hay cuentas publicitarias vinculadas, así que este informe no incluye
          datos de pauta.
        </p>
      </section>
    );
  }

  if (!ads.hasData) {
    return (
      <section className="rounded-xl border p-6 print:break-inside-avoid">
        <h2 className="text-lg font-semibold">Anuncios</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No se registró inversión publicitaria en este período.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold">Anuncios</h2>

      {ads.byCurrency.map((block) => (
        <div key={block.currency} className="space-y-4">
          {ads.byCurrency.length > 1 && (
            <p className="text-sm font-medium text-muted-foreground">
              Cuentas en {block.currency}
            </p>
          )}

          {/* El dinero primero */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
            <MoneyTile
              label="Inversión"
              value={formatCurrency(block.totals.spend, block.currency)}
              hint="Lo que se gastó en pauta este mes."
            />
            <MoneyTile
              label="Resultados"
              value={formatNumber(block.totals.conversions)}
              hint="Acciones logradas: compras, mensajes o registros según la campaña."
            />
            <MoneyTile
              label="Costo por resultado"
              value={
                block.totals.cpa === null
                  ? "—"
                  : formatCurrency(block.totals.cpa, block.currency)
              }
              hint="Cuánto costó cada resultado. Técnicamente, CPA."
            />
            <MoneyTile
              label="Retorno"
              value={formatRatio(block.totals.roas, "x")}
              hint="Por cada dólar invertido, cuánto volvió en ventas. Técnicamente, ROAS."
            />
          </div>

          {/* Métricas de alcance, secundarias al dinero */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
            <MoneyTile
              label="Impresiones"
              value={formatNumber(block.totals.impressions)}
              hint="Veces que se mostró el anuncio."
            />
            <MoneyTile
              label="Personas alcanzadas"
              value={formatNumber(block.totals.reach)}
              hint="Personas distintas que lo vieron."
            />
            <MoneyTile
              label="Clics"
              value={formatNumber(block.totals.clicks)}
              hint="Clics al enlace del anuncio."
            />
            <MoneyTile
              label="Tasa de clics"
              value={formatRatio(block.totals.ctr, "%")}
              hint="Clics sobre impresiones. Técnicamente, CTR."
            />
          </div>

          {/* Campañas, ordenadas por inversión */}
          <div className="overflow-x-auto rounded-xl border print:break-inside-avoid">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">
                Campañas de {block.currency} ordenadas por inversión
              </caption>
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Campaña</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Inversión</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Resultados</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Costo/result.</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Retorno</th>
                </tr>
              </thead>
              <tbody>
                {block.campaigns.map((campaign) => (
                  <tr key={campaign.campaignId} className="border-t">
                    <td className="px-4 py-2">
                      <span className="block max-w-[280px] truncate print:max-w-none print:whitespace-normal">
                        {campaign.campaignName}
                      </span>
                      {/* Barra de participación sobre la inversión total */}
                      <span
                        className="mt-1 block h-1 rounded-full bg-primary/70"
                        style={{ width: `${Math.max(campaign.share, 1)}%` }}
                        aria-hidden
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {Math.round(campaign.share)}% de la inversión
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(campaign.spend, block.currency)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatNumber(campaign.conversions)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {campaign.cpa === null
                        ? "—"
                        : formatCurrency(campaign.cpa, block.currency)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatRatio(campaign.roas, "x")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}

function MoneyTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 print:break-inside-avoid">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">{hint}</p>
    </div>
  );
}
