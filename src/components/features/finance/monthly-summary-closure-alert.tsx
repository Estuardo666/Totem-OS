import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { MonthlyFinancialSummaryData } from "@/actions/finance-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface MonthlySummaryClosureAlertProps {
  summary: MonthlyFinancialSummaryData;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function MonthlySummaryClosureAlert({ summary }: MonthlySummaryClosureAlertProps) {
  if (summary.closureControl.pendingCount === 0) {
    return null;
  }

  return (
    <Card className="border-rose-300 bg-rose-50 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-rose-700">
              <AlertTriangle className="h-4 w-4" />
              Cierre pendiente
            </div>
            <div>
              <p className="text-lg font-semibold text-rose-950">
                {summary.closureControl.pendingCount} cliente(s) recurrente(s) siguen sin cierre de {summary.periodLabel}
              </p>
              <p className="mt-1 max-w-3xl text-sm text-rose-800">
                Antes de confiar en esta lectura contable, define si esos fees se devengan o no. El monto potencial todavía abierto es {formatCurrency(summary.closureControl.pendingAmount)}.
              </p>
            </div>
          </div>

          <Button asChild className="rounded-full bg-rose-600 hover:bg-rose-700">
            <Link href={`/finance/monthly-close?month=${summary.period.month}&year=${summary.period.year}`}>
              Ir al cierre mensual
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {summary.closureControl.pendingClients.slice(0, 8).map((client) => (
            <span
              key={client.id}
              className="rounded-full border border-rose-200 bg-white px-3 py-1 text-sm font-medium text-rose-900"
            >
              {client.name}
            </span>
          ))}
          {summary.closureControl.pendingClients.length > 8 ? (
            <span className="rounded-full border border-rose-200 bg-white px-3 py-1 text-sm font-medium text-rose-900">
              +{summary.closureControl.pendingClients.length - 8} más
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}