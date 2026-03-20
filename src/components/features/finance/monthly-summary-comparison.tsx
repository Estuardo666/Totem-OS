import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { MonthlyFinancialSummaryData } from "@/actions/finance-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/components/features/finance/monthly-summary-utils";

interface MonthlySummaryComparisonProps {
  summary: MonthlyFinancialSummaryData;
}

function getToneClasses(tone: "positive" | "negative" | "neutral") {
  if (tone === "positive") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  if (tone === "negative") {
    return "border-rose-200 bg-rose-50 text-rose-900";
  }

  return "border-slate-200 bg-slate-50 text-slate-900";
}

function formatDelta(value: number) {
  const absoluteValue = formatCurrency(Math.abs(value));
  if (value > 0) return `+${absoluteValue}`;
  if (value < 0) return `-${absoluteValue}`;
  return absoluteValue;
}

function formatDeltaPercent(value: number | null) {
  if (value === null) return "Nuevo frente al mes previo";
  if (value === 0) return "Sin variación";
  const absoluteValue = Math.abs(value).toFixed(1);
  return `${value > 0 ? "+" : "-"}${absoluteValue}%`;
}

export function MonthlySummaryComparison({ summary }: MonthlySummaryComparisonProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Variación mensual</h2>
        <p className="text-sm text-muted-foreground">
          {summary.comparison.summary}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summary.comparison.metrics.map((metric) => {
          const Icon = metric.tone === "positive" ? ArrowUpRight : metric.tone === "negative" ? ArrowDownRight : Minus;

          return (
            <Card key={metric.key} className="border-border/60 shadow-sm">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{metric.helper}</p>
                  </div>
                  <div className={`rounded-full border p-2 ${getToneClasses(metric.tone)}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-2xl font-semibold tracking-tight">{formatCurrency(metric.currentValue)}</p>
                  <p className="text-xs text-muted-foreground">Anterior: {formatCurrency(metric.previousValue)} en {summary.comparison.previousPeriodLabel}</p>
                </div>
                <div className={`rounded-2xl border px-3 py-2 ${getToneClasses(metric.tone)}`}>
                  <p className="text-sm font-semibold">{formatDelta(metric.deltaValue)}</p>
                  <p className="text-xs opacity-80">{formatDeltaPercent(metric.deltaPct)}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}