import { AlertTriangle, CheckCircle2, CircleDollarSign, ShieldAlert } from "lucide-react";
import type { MonthlyFinancialSummaryData } from "@/actions/finance-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent, getAlertClasses } from "@/components/features/finance/monthly-summary-utils";

interface MonthlySummaryBreakdownProps {
  summary: MonthlyFinancialSummaryData;
}

type LedgerRowProps = {
  label: string;
  value: number;
  emphasis?: boolean;
  tone?: "default" | "positive" | "negative";
  helper?: string;
};

function LedgerRow({ label, value, emphasis, tone = "default", helper }: LedgerRowProps) {
  const toneClass = tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-rose-700" : "text-foreground";

  return (
    <div className="space-y-1 border-b border-border/40 pb-3 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={`text-sm ${emphasis ? "font-semibold" : "font-medium"}`}>{label}</p>
          {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
        </div>
        <p className={`text-sm font-semibold ${toneClass}`}>{formatCurrency(value)}</p>
      </div>
    </div>
  );
}

function AgingBar({ label, value, total }: { label: string; value: number; total: number }) {
  const width = total > 0 ? Math.max((value / total) * 100, value > 0 ? 8 : 0) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{formatCurrency(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-foreground/80" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function MonthlySummaryBreakdown({ summary }: MonthlySummaryBreakdownProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
      <div className="space-y-6">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CircleDollarSign className="h-5 w-5 text-emerald-600" />
              Estado del mes
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Esta lectura separa ingreso recurrente, ingreso extraordinario, costo directo y estructura operativa.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <LedgerRow
              label="Ingreso recurrente comprometido"
              value={summary.quality.recurringCommittedRevenue}
              helper="Fee mensual activo del período. Es la base que sostiene el negocio mes a mes."
            />
            <LedgerRow
              label="Ingreso extraordinario registrado"
              value={summary.quality.extraordinaryRevenue}
              helper="Proyectos, adicionales o registros que no dependen del fee base."
            />
            <LedgerRow
              label="Ingreso del mes"
              value={summary.executive.recognizedRevenue}
              emphasis
              helper="Ingreso operativo total reconocido en el sistema para el mes actual."
            />
            <LedgerRow
              label="Costos directos"
              value={summary.executive.directCosts}
              tone="negative"
              helper="Entrega del servicio: honorarios y egresos asociados a clientes."
            />
            <LedgerRow
              label="Margen bruto"
              value={summary.executive.grossMargin}
              tone={summary.executive.grossMargin >= 0 ? "positive" : "negative"}
              helper={`Margen bruto ${formatPercent(summary.executive.grossMarginPct)}`}
            />
            <LedgerRow
              label="Gasto operativo"
              value={summary.executive.operatingExpenses}
              tone="negative"
              helper="Administración y estructura. Aquí no debería vivir producción de clientes."
            />
            <LedgerRow
              label="Resultado operativo"
              value={summary.executive.operatingResult}
              emphasis
              tone={summary.executive.operatingResult >= 0 ? "positive" : "negative"}
              helper={`Margen operativo ${formatPercent(summary.executive.operatingMarginPct)}`}
            />
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Tesorería operativa</CardTitle>
            <p className="text-sm text-muted-foreground">
              Caja del mes y compromisos ya asumidos. Esta sección no reemplaza conciliación bancaria, pero sí sirve para decidir.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="text-sm font-medium text-emerald-900">Caja cobrada</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-950">{formatCurrency(summary.treasury.collectedCash)}</p>
              <p className="mt-2 text-xs text-emerald-800">Eficiencia de cobranza: {formatPercent(summary.quality.collectionEfficiencyPct)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">Flujo neto del mes</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{formatCurrency(summary.executive.netCashFlow)}</p>
              <p className="mt-2 text-xs text-slate-700">Cobros menos salidas directas y operativas registradas.</p>
            </div>
            <div className="space-y-3 rounded-2xl border border-border/60 p-4 md:col-span-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Salidas directas</span>
                <span className="font-semibold">{formatCurrency(summary.treasury.directCashOut)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Salidas operativas</span>
                <span className="font-semibold">{formatCurrency(summary.treasury.operatingCashOut)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Reembolsos pendientes</span>
                <span className="font-semibold">{formatCurrency(summary.treasury.pendingReimbursements)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Gastos pendientes de pagar</span>
                <span className="font-semibold">{formatCurrency(summary.treasury.pendingExpenseTransactions)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Honorarios pendientes</span>
                <span className="font-semibold">{formatCurrency(summary.treasury.pendingCompensation)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border/60 pt-3 text-sm font-semibold">
                <span>Compromisos pendientes</span>
                <span>{formatCurrency(summary.treasury.pendingCommitments)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldAlert className="h-5 w-5 text-rose-600" />
              Cartera y calidad del ingreso
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              La mezcla correcta es simple: ingreso del mes, caja del mes y cartera al cierre deben leerse por separado.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">Cartera al cierre</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(summary.receivables.total)}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">Cliente principal</p>
                <p className="mt-2 text-2xl font-semibold">{formatPercent(summary.quality.topClientConcentrationPct)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Participación del cliente más grande en el ingreso del mes.</p>
              </div>
            </div>
            <AgingBar label="Corriente" value={summary.receivables.current} total={summary.receivables.total} />
            <AgingBar label="1 a 30 días" value={summary.receivables.overdue1To30} total={summary.receivables.total} />
            <AgingBar label="31 a 60 días" value={summary.receivables.overdue31To60} total={summary.receivables.total} />
            <AgingBar label="Más de 60 días" value={summary.receivables.overdue61Plus} total={summary.receivables.total} />

            <div className="space-y-3 border-t border-border/60 pt-4">
              <p className="text-sm font-semibold">Mayores saldos por cobrar</p>
              {summary.receivables.topDebtors.map((debtor) => (
                <div key={debtor.clientName} className="flex items-center justify-between gap-4 rounded-xl border border-border/60 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{debtor.clientName}</p>
                    <p className="text-xs text-muted-foreground">{debtor.items} item(s) abiertos</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={getAlertClasses(debtor.risk)}>
                      {debtor.risk === "critical" ? "Crítico" : debtor.risk === "warning" ? "Seguimiento" : "Sano"}
                    </Badge>
                    <span className="text-sm font-semibold">{formatCurrency(debtor.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Alertas de lectura gerencial
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Alertas pensadas para toma de decisión, no solo para monitoreo numérico.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.alerts.map((alert) => (
              <div key={alert.title} className={`rounded-2xl border p-4 ${getAlertClasses(alert.tone)}`}>
                <div className="flex items-start gap-3">
                  {alert.tone === "healthy" ? <CheckCircle2 className="mt-0.5 h-5 w-5" /> : <AlertTriangle className="mt-0.5 h-5 w-5" />}
                  <div>
                    <p className="font-semibold">{alert.title}</p>
                    <p className="mt-1 text-sm leading-relaxed opacity-90">{alert.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
