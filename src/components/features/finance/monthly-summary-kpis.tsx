import { ArrowDownCircle, ArrowUpCircle, Landmark, PiggyBank, Wallet, WalletCards } from "lucide-react";
import type { MonthlyFinancialSummaryData } from "@/actions/finance-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/components/features/finance/monthly-summary-utils";

interface MonthlySummaryKpisProps {
  summary: MonthlyFinancialSummaryData;
}

const KPI_CONFIG = [
  {
    key: "recognizedRevenue",
    title: "Ingreso del mes",
    helper: "Ingreso operativo reconocido del período. Separa fee recurrente del ingreso extraordinario.",
    icon: ArrowUpCircle,
    accent: "text-emerald-600",
  },
  {
    key: "collectedCash",
    title: "Caja cobrada",
    helper: "Cobros efectivamente registrados en el mes. Sirve para leer liquidez real.",
    icon: Wallet,
    accent: "text-sky-600",
  },
  {
    key: "directCosts",
    title: "Costos directos",
    helper: "Honorarios pagados y egresos ligados a la entrega del servicio.",
    icon: ArrowDownCircle,
    accent: "text-amber-600",
  },
  {
    key: "operatingExpenses",
    title: "Gasto operativo",
    helper: "Estructura y administración. No debe confundirse con costo de producción.",
    icon: Landmark,
    accent: "text-violet-600",
  },
  {
    key: "operatingResult",
    title: "Resultado operativo",
    helper: "Lo que deja el mes después de costos directos y gasto operativo.",
    icon: PiggyBank,
    accent: "text-foreground",
  },
  {
    key: "closingReceivables",
    title: "Cartera al cierre",
    helper: "Saldo pendiente por cobrar al final del mes actual. Mide presión de caja futura.",
    icon: WalletCards,
    accent: "text-rose-600",
  },
] as const;

export function MonthlySummaryKpis({ summary }: MonthlySummaryKpisProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Lectura ejecutiva</h2>
        <p className="text-sm text-muted-foreground">
          Resultado, caja y cartera en bloques separados para tomar decisiones sin mezclar señales.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {KPI_CONFIG.map((item) => {
          const Icon = item.icon;
          const value = summary.executive[item.key];
          const secondary = item.key === "recognizedRevenue"
            ? `Recurrente ${formatPercent(summary.quality.recurringSharePct)}`
            : item.key === "collectedCash"
              ? `Eficiencia ${formatPercent(summary.quality.collectionEfficiencyPct)}`
              : item.key === "directCosts"
                ? `Margen bruto ${formatPercent(summary.executive.grossMarginPct)}`
                : item.key === "operatingExpenses"
                  ? `Caja neta ${formatCurrency(summary.executive.netCashFlow)}`
                  : item.key === "operatingResult"
                    ? `Margen ${formatPercent(summary.executive.operatingMarginPct)}`
                    : `Corriente ${formatCurrency(summary.receivables.current)}`;

          return (
            <Card key={item.key} className="border-border/60 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{item.title}</CardTitle>
                  <p className="text-xs leading-relaxed text-muted-foreground">{item.helper}</p>
                </div>
                <Icon className={`h-5 w-5 ${item.accent}`} />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-semibold tracking-tight">{formatCurrency(value)}</div>
                <p className="text-xs font-medium text-muted-foreground">{secondary}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
