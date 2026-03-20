import type { MonthlyFinancialSummaryData } from "@/actions/finance-actions";
import { FinanceSectionNav } from "@/components/features/finance/finance-section-nav";
import { MonthlySummaryBreakdown } from "@/components/features/finance/monthly-summary-breakdown";
import { MonthlySummaryClientsTable } from "@/components/features/finance/monthly-summary-clients-table";
import { MonthlySummaryComparison } from "@/components/features/finance/monthly-summary-comparison";
import { MonthlySummaryHeroFocus } from "@/components/features/finance/monthly-summary-hero-focus";
import { MonthlySummaryKpis } from "@/components/features/finance/monthly-summary-kpis";
import { MonthlySummaryPeriodSelector } from "@/components/features/finance/monthly-summary-period-selector";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/components/features/finance/monthly-summary-utils";

interface MonthlySummaryDashboardProps {
  summary: MonthlyFinancialSummaryData;
  userRole?: string;
}

export function MonthlySummaryDashboard({ summary, userRole }: MonthlySummaryDashboardProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <FinanceSectionNav userRole={userRole} />
          <MonthlySummaryPeriodSelector
            monthValue={summary.period.value}
            isCurrentMonth={summary.period.isCurrentMonth}
          />
        </div>

        <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white shadow-sm">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div className="space-y-4">
              <Badge className="w-fit rounded-full bg-white/10 text-white hover:bg-white/10">
                Resumen financiero de {summary.periodLabel}
              </Badge>
              <div className="space-y-2">
                <h2 className="text-3xl font-semibold tracking-tight">Una lectura contable para decidir, no solo para mirar números.</h2>
                <p className="max-w-2xl text-sm leading-relaxed text-white/80">
                  Esta vista separa resultado, tesorería y cartera. La idea es simple: entender si el mes fue rentable,
                  si realmente entró caja y qué clientes están sosteniendo o tensionando la empresa.
                </p>
                <div className="flex flex-wrap gap-3 text-xs text-white/65">
                  <span>Corte: {summary.period.cutoffLabel}</span>
                  <span>{summary.period.isCurrentMonth ? "Mes en curso" : "Mes histórico consultado"}</span>
                </div>
                {!summary.period.isCurrentMonth && (
                  <p className="max-w-2xl text-xs leading-relaxed text-white/65">
                    El cierre usa el mes seleccionado como referencia para ingresos, costos y cartera registrada hasta ese corte.
                  </p>
                )}
              </div>

              <MonthlySummaryHeroFocus summary={summary} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Resultado</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(summary.executive.operatingResult)}</p>
                <p className="mt-1 text-xs text-white/70">Margen {formatPercent(summary.executive.operatingMarginPct)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Caja</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(summary.executive.netCashFlow)}</p>
                <p className="mt-1 text-xs text-white/70">Cobrado {formatCurrency(summary.executive.collectedCash)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Cartera</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(summary.executive.closingReceivables)}</p>
                <p className="mt-1 text-xs text-white/70">Corriente {formatCurrency(summary.receivables.current)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <MonthlySummaryComparison summary={summary} />
      <MonthlySummaryKpis summary={summary} />
      <MonthlySummaryBreakdown summary={summary} />
      <MonthlySummaryClientsTable summary={summary} />
    </div>
  );
}
