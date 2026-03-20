import { AlertTriangle, ShieldCheck, Siren } from "lucide-react";
import type { MonthlyFinancialSummaryData } from "@/actions/finance-actions";
import { formatCurrency, formatPercent } from "@/components/features/finance/monthly-summary-utils";

interface MonthlySummaryHeroFocusProps {
  summary: MonthlyFinancialSummaryData;
}

function getFocusStyles(tone: "healthy" | "warning" | "critical") {
  if (tone === "healthy") {
    return {
      wrapper: "border-emerald-400/20 bg-emerald-400/10",
      badge: "bg-emerald-400/15 text-emerald-100 border border-emerald-300/20",
      icon: ShieldCheck,
    };
  }

  if (tone === "warning") {
    return {
      wrapper: "border-amber-400/20 bg-amber-400/10",
      badge: "bg-amber-400/15 text-amber-50 border border-amber-300/20",
      icon: AlertTriangle,
    };
  }

  return {
    wrapper: "border-rose-400/20 bg-rose-400/10",
    badge: "bg-rose-400/15 text-rose-50 border border-rose-300/20",
    icon: Siren,
  };
}

function formatFocusValue(summary: MonthlyFinancialSummaryData) {
  return summary.heroFocus.metricFormat === "percent"
    ? formatPercent(summary.heroFocus.metricValue)
    : formatCurrency(summary.heroFocus.metricValue);
}

export function MonthlySummaryHeroFocus({ summary }: MonthlySummaryHeroFocusProps) {
  const styles = getFocusStyles(summary.heroFocus.tone);
  const Icon = styles.icon;

  return (
    <div className={`rounded-3xl border p-4 ${styles.wrapper}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${styles.badge}`}>
            <Icon className="h-3.5 w-3.5" />
            Foco del período
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-white">{summary.heroFocus.title}</p>
            <p className="max-w-2xl text-sm leading-relaxed text-white/80">{summary.heroFocus.description}</p>
          </div>
        </div>

        <div className="min-w-[220px] rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-white/60">{summary.heroFocus.metricLabel}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatFocusValue(summary)}</p>
          <p className="mt-1 text-xs text-white/70">{summary.heroFocus.context}</p>
        </div>
      </div>
    </div>
  );
}