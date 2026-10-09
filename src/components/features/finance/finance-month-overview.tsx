import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { FinanceDashboardPeriodSnapshot } from "@/actions/finance-actions";
import { cn } from "@/lib/utils";

// Vista por defecto de finanzas: pocos números, cada uno trazable.
// Los totales se muestran como una suma/resta visible para que se puedan verificar.

interface FinanceMonthOverviewProps {
  current: FinanceDashboardPeriodSnapshot;
  previous?: FinanceDashboardPeriodSnapshot | null;
  trend: FinanceDashboardPeriodSnapshot[];
}

const money = (value: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

function Delta({ current, previous, inverse = false }: { current: number; previous?: number; inverse?: boolean }) {
  if (previous === undefined) return null;
  const diff = current - previous;
  if (Math.round(diff) === 0) return <span className="text-xs text-muted-foreground">igual que el mes anterior</span>;
  const good = inverse ? diff < 0 : diff > 0;
  return (
    <span className={cn("text-xs font-medium", good ? "text-emerald-600" : "text-rose-600")}>
      {diff > 0 ? "▲" : "▼"} {money(Math.abs(diff))} <span className="font-normal text-muted-foreground">vs. mes anterior</span>
    </span>
  );
}

function Kpi({ label, value, previous, inverse, sub, tone }: { label: string; value: number; previous?: number; inverse?: boolean; sub?: string; tone?: "positive" | "negative" }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums tracking-tight", tone === "negative" && "text-rose-600", tone === "positive" && "text-emerald-600")}>
        {money(value)}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2">
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        <Delta current={value} previous={previous} inverse={inverse} />
      </div>
    </div>
  );
}

type Line = { label: string; value: number; previous?: number; kind?: "add" | "sub" | "total" };

function Ledger({ title, lines, href, hrefLabel }: { title: string; lines: Line[]; href?: string; hrefLabel?: string }) {
  const hasPrevious = lines.some((line) => line.previous !== undefined);
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {href && (
          <Link href={href} className="text-xs font-medium text-primary hover:underline">
            {hrefLabel}
          </Link>
        )}
      </div>
      <table className="w-full text-sm tabular-nums">
        {hasPrevious && (
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th />
              <th className="pb-2 text-right font-normal">Este mes</th>
              <th className="pb-2 pl-4 text-right font-normal">Mes anterior</th>
            </tr>
          </thead>
        )}
        <tbody>
          {lines.map((line) => {
            const sign = line.kind === "sub" ? "−" : line.kind === "add" ? "+" : "";
            const isTotal = line.kind === "total";
            return (
              <tr key={line.label} className={cn(isTotal && "border-t font-semibold")}>
                <td className={cn("py-1.5", !isTotal && "text-muted-foreground")}>
                  {isTotal ? "= " : sign ? `${sign} ` : ""}
                  {line.label}
                </td>
                <td className={cn("py-1.5 text-right", isTotal && line.value < 0 && "text-rose-600")}>{money(line.value)}</td>
                {hasPrevious && (
                  <td className="py-1.5 pl-4 text-right text-muted-foreground">
                    {line.previous === undefined ? "—" : money(line.previous)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TrendChart({ trend }: { trend: FinanceDashboardPeriodSnapshot[] }) {
  if (trend.length < 2) return null;
  const rows = trend.map((s) => ({
    label: s.periodLabel.slice(0, 3),
    income: s.executive.recognizedRevenue,
    honorarios: s.executive.honorarios,
    expenses: s.executive.directCosts - s.executive.honorarios + s.executive.operatingExpenses,
    result: s.executive.operatingResult,
  }));
  const max = Math.max(...rows.flatMap((r) => [r.income, r.honorarios, r.expenses]), 1);
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Últimos meses</h2>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500" />Ingresos</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-sky-500" />Honorarios</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-slate-400" />Gastos</span>
        </div>
      </div>
      <div className="flex h-40 items-end gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Ingresos ${money(row.income)} · Honorarios ${money(row.honorarios)} · Gastos ${money(row.expenses)} · Utilidad ${money(row.result)}`}>
            <div className="flex h-full w-full items-end justify-center gap-1">
              <div className="w-1/4 max-w-6 rounded-t bg-emerald-500" style={{ height: `${(row.income / max) * 100}%` }} />
              <div className="w-1/4 max-w-6 rounded-t bg-sky-500" style={{ height: `${(row.honorarios / max) * 100}%` }} />
              <div className="w-1/4 max-w-6 rounded-t bg-slate-400" style={{ height: `${(row.expenses / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 border-t pt-2">
        {rows.map((row) => (
          <div key={row.label} className="flex-1 text-center">
            <p className="text-xs capitalize text-muted-foreground">{row.label}</p>
            <p className={cn("text-xs font-medium tabular-nums", row.result < 0 ? "text-rose-600" : "text-foreground")}>{money(row.result)}</p>
          </div>
        ))}
      </div>
      <p className="mt-1 text-center text-[11px] text-muted-foreground">Debajo de cada mes: utilidad</p>
    </div>
  );
}

export function FinanceMonthOverview({ current, previous, trend }: FinanceMonthOverviewProps) {
  const e = current.executive;
  const p = previous?.executive;
  const t = current.treasury;
  const pt = previous?.treasury;
  const r = current.receivables;
  // Honorarios van aparte: el resto de costos de clientes + gastos fijos son "Gastos"
  const expenses = e.directCosts - e.honorarios + e.operatingExpenses;
  // En el mes en curso el ingreso ya cuenta el fee completo, pero los costos
  // aún no se registran: la utilidad es parcial y no se compara con un mes cerrado.
  const inProgress = current.period.isCurrentMonth;
  const prevExpenses = p ? p.directCosts - p.honorarios + p.operatingExpenses : undefined;
  const overdue = r.overdue1To30 + r.overdue31To60 + r.overdue61Plus;
  const clients = current.clients.filter((c) => c.recognizedRevenue > 0 || c.collectedCash > 0 || c.outstanding > 0);

  return (
    <div className="space-y-4">
      {current.closureControl.pendingCount > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong>Números provisionales:</strong> {current.closureControl.pendingCount} cliente(s) sin cierre de {current.periodLabel} ({money(current.closureControl.pendingAmount)}).
            </span>
          </p>
          <Link
            href={`/finance/monthly-close?month=${current.period.month}&year=${current.period.year}`}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
          >
            Cerrar mes <ArrowRight className="size-4" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Ingresos" value={e.recognizedRevenue} previous={p?.recognizedRevenue} sub={`Cobrado ${money(e.collectedCash)}`} />
        <Kpi label="Honorarios" value={e.honorarios} previous={inProgress ? undefined : p?.honorarios} inverse sub={inProgress ? "Registrado hasta hoy" : undefined} />
        <Kpi label="Gastos" value={expenses} previous={inProgress ? undefined : prevExpenses} inverse sub={inProgress ? "Registrado hasta hoy" : undefined} />
        <Kpi
          label={inProgress ? "Utilidad parcial" : "Utilidad"}
          value={e.operatingResult}
          previous={inProgress ? undefined : p?.operatingResult}
          sub={inProgress ? "Mes en curso: faltan honorarios y gastos" : e.recognizedRevenue > 0 ? `Margen ${e.operatingMarginPct.toFixed(0)}%` : undefined}
          tone={e.operatingResult < 0 ? "negative" : inProgress ? undefined : "positive"}
        />
        <Kpi label="Por cobrar" value={r.total} previous={previous?.receivables.total} inverse sub={overdue > 0 ? `${money(overdue)} vencido` : "Nada vencido"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Ledger
          title={inProgress ? "Cómo se calcula la utilidad (hasta hoy)" : "Cómo se calcula la utilidad"}
          lines={[
            { label: "Ingresos del mes", value: e.recognizedRevenue, previous: p?.recognizedRevenue },
            { label: "Honorarios", value: e.honorarios, previous: p?.honorarios, kind: "sub" },
            { label: "Gastos de clientes (producción)", value: e.directCosts - e.honorarios, previous: p ? p.directCosts - p.honorarios : undefined, kind: "sub" },
            { label: "Gastos fijos de la empresa", value: e.operatingExpenses, previous: p?.operatingExpenses, kind: "sub" },
            { label: "Utilidad", value: e.operatingResult, previous: p?.operatingResult, kind: "total" },
          ]}
          href="/finance/transactions"
          hrefLabel="Ver movimientos"
        />
        <Ledger
          title="Dinero que entró y salió"
          lines={[
            { label: "Cobrado a clientes", value: t.collectedCash, previous: pt?.collectedCash },
            { label: "Honorarios pagados", value: e.honorarios, previous: p?.honorarios, kind: "sub" },
            { label: "Otros pagos", value: t.paidCashOut - e.honorarios, previous: pt && p ? pt.paidCashOut - p.honorarios : undefined, kind: "sub" },
            ...(t.transferredToSavings || pt?.transferredToSavings
              ? [{ label: "Pasado a utilidades acumuladas", value: t.transferredToSavings, previous: pt?.transferredToSavings, kind: "sub" as const }]
              : []),
            ...(t.withdrawnFromSavings || pt?.withdrawnFromSavings
              ? [{ label: "Sacado de utilidades acumuladas", value: t.withdrawnFromSavings, previous: pt?.withdrawnFromSavings, kind: "add" as const }]
              : []),
            { label: "Queda en caja del mes", value: t.operatingEndingBalance, previous: pt?.operatingEndingBalance, kind: "total" },
          ]}
        />
      </div>

      {t.pendingCommitments > 0 && (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          Pendiente de pagar: <strong className="text-foreground">{money(t.pendingCommitments)}</strong>
          {" "}(honorarios {money(t.pendingCompensation)} · gastos {money(t.pendingExpenseTransactions)} · reembolsos {money(t.pendingReimbursements)})
        </p>
      )}

      <TrendChart trend={trend} />

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Por cliente</h2>
          <Link href="/finance/receivables" className="text-xs font-medium text-primary hover:underline">Cuentas por cobrar</Link>
        </div>
        {clients.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin movimientos este mes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm tabular-nums">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-normal">Cliente</th>
                  <th className="pb-2 text-right font-normal">Ingreso</th>
                  <th className="pb-2 text-right font-normal">Cobrado</th>
                  <th className="pb-2 text-right font-normal">Gastos</th>
                  <th className="pb-2 text-right font-normal">Debe</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{c.name}</td>
                    <td className="py-2 text-right">{money(c.recognizedRevenue)}</td>
                    <td className="py-2 text-right">{money(c.collectedCash)}</td>
                    <td className="py-2 text-right text-muted-foreground">{money(c.directCosts)}</td>
                    <td className={cn("py-2 text-right", c.outstanding > 0 ? "font-medium text-amber-600" : "text-muted-foreground")}>
                      {c.outstanding > 0 ? money(c.outstanding) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Los gastos por cliente solo incluyen lo asignado a ese cliente; los honorarios se cuentan en el total del mes.
        </p>
      </div>
    </div>
  );
}
