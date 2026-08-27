"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileCheck2,
  Info,
  Landmark,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FinanceDashboardPeriodSnapshot, FinancialStats, GlobalProfitabilityStats, StrategicClientPlan } from "@/actions/finance-actions";
import { FinanceSectionNav } from "@/components/features/finance/finance-section-nav";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Receivable = {
  id: string;
  clientName?: string;
  clientLogo?: string | null;
  description: string;
  amount: number;
  date: Date;
  daysOverdue: number;
  status: "PENDING" | "PAID";
  sourceType: "INVOICE" | "TRANSACTION" | "RECURRING";
};

type ReceivablesData = {
  totalReceivable: number;
  clientsWithDebt: number;
  monthProjection: number;
  pendingTransactions: Receivable[];
};

interface StrategicFinanceDashboardProps {
  stats: FinancialStats;
  profitability?: GlobalProfitabilityStats | null;
  clientPlans: StrategicClientPlan[];
  receivables?: ReceivablesData | null;
  periodSnapshots: FinanceDashboardPeriodSnapshot[];
  userRole?: string;
}

type Tone = "positive" | "warning" | "critical" | "neutral";
type ServiceFilter = "all" | "content" | "design" | "production";

type AggregatedClient = {
  id: string;
  name: string;
  recognizedRevenue: number;
  collectedCash: number;
  directCosts: number;
  outstanding: number;
};

type DashboardAggregate = {
  recognizedRevenue: number;
  collectedCash: number;
  directCosts: number;
  operatingExpenses: number;
  operatingResult: number;
  netCashFlow: number;
  closingReceivables: number;
  clientsWithDebt: number;
  clients: AggregatedClient[];
};

function getServiceShare(plan: StrategicClientPlan | undefined, service: ServiceFilter) {
  if (service === "all") return 1;
  if (!plan) return 0;

  const contentUnits = Math.max(plan.monthlyReels, 0);
  const designUnits = Math.max(plan.monthlyFlyers, 0);
  const productionUnits = Math.max(plan.monthlyShoots, 0) * 2;
  const totalUnits = contentUnits + designUnits + productionUnits;

  if (totalUnits <= 0) return 0;
  if (service === "content") return contentUnits / totalUnits;
  if (service === "design") return designUnits / totalUnits;
  return productionUnits / totalUnits;
}

function aggregateSnapshots(
  snapshots: FinanceDashboardPeriodSnapshot[],
  plans: StrategicClientPlan[],
  clientId: string,
  service: ServiceFilter
): DashboardAggregate {
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const clientTotals = new Map<string, AggregatedClient>();
  const sortedSnapshots = [...snapshots].sort((a, b) => a.period.value.localeCompare(b.period.value));
  const lastSnapshot = sortedSnapshots.at(-1);
  let recognizedRevenue = 0;
  let collectedCash = 0;
  let directCosts = 0;
  let operatingExpenses = 0;

  for (const snapshot of sortedSnapshots) {
    let selectedRevenueForOverhead = 0;

    for (const row of snapshot.clients) {
      if (clientId !== "all" && row.id !== clientId) continue;
      const share = getServiceShare(planById.get(row.id), service);
      if (share <= 0) continue;

      const rowRevenue = row.recognizedRevenue * share;
      const rowCash = row.collectedCash * share;
      const rowCosts = row.directCosts * share;
      const existing = clientTotals.get(row.id) ?? {
        id: row.id,
        name: row.name,
        recognizedRevenue: 0,
        collectedCash: 0,
        directCosts: 0,
        outstanding: 0,
      };

      existing.recognizedRevenue += rowRevenue;
      existing.collectedCash += rowCash;
      existing.directCosts += rowCosts;
      clientTotals.set(row.id, existing);
      recognizedRevenue += rowRevenue;
      collectedCash += rowCash;
      directCosts += rowCosts;
      selectedRevenueForOverhead += rowRevenue;
    }

    const overheadShare = clientId === "all" && service === "all"
      ? 1
      : snapshot.executive.recognizedRevenue > 0
        ? selectedRevenueForOverhead / snapshot.executive.recognizedRevenue
        : 0;
    operatingExpenses += snapshot.executive.operatingExpenses * overheadShare;
  }

  if (lastSnapshot) {
    for (const row of lastSnapshot.clients) {
      if (clientId !== "all" && row.id !== clientId) continue;
      const share = getServiceShare(planById.get(row.id), service);
      const existing = clientTotals.get(row.id);
      if (existing) existing.outstanding = row.outstanding * share;
    }
  }

  const clients = Array.from(clientTotals.values()).sort((a, b) => b.recognizedRevenue - a.recognizedRevenue);
  const closingReceivables = clients.reduce((sum, row) => sum + row.outstanding, 0);

  return {
    recognizedRevenue,
    collectedCash,
    directCosts,
    operatingExpenses,
    operatingResult: recognizedRevenue - directCosts - operatingExpenses,
    netCashFlow: collectedCash - directCosts - operatingExpenses,
    closingReceivables,
    clientsWithDebt: clients.filter((row) => row.outstanding > 0).length,
    clients,
  };
}

function deltaPercent(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

const money = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
};

const moneyPrecise = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const percent = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
};

const compact = (value: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);

function InfoTip({ label }: { label: string }) {
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-label={`Información: ${label}`} className="inline-flex size-4 items-center justify-center rounded-full text-slate-400 outline-none transition-colors hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500">
        <Info className="size-3" />
      </button>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 rounded-lg border border-slate-200 bg-slate-950 px-3 py-2 text-[11px] font-normal leading-relaxed text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {label}
      </span>
    </span>
  );
}

function Sparkline({ points, color = "#2563eb", fill = false }: { points: number[]; color?: string; fill?: boolean }) {
  const width = 132;
  const height = 36;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const path = points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * width;
    const y = height - ((point - min) / Math.max(max - min, 1)) * (height - 5) - 2;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const fillPath = `${path} L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-16 overflow-visible sm:w-24 xl:h-9 xl:w-32" aria-hidden="true">
      {fill && <path d={fillPath} fill={color} opacity="0.08" />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p>}
        <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">{title}</h2>
        {description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value, delta, compareLabel, context, tone, trendTone, points, icon: Icon }: { label: string; value: string; delta: string; compareLabel: string; context: string; tone: Tone; trendTone: Tone; points: number[]; icon: typeof WalletCards }) {
  const color = tone === "positive" ? "#059669" : tone === "critical" ? "#e11d48" : tone === "warning" ? "#d97706" : "#2563eb";
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500"><Icon className="size-4 text-slate-400" />{label}</div>
        <Sparkline points={points} color={color} fill />
      </div>
      <p className={cn("mt-2 text-[25px] font-semibold tracking-[-0.055em]", tone === "positive" ? "text-emerald-600" : tone === "critical" ? "text-rose-600" : tone === "warning" ? "text-amber-600" : "text-slate-950")}>{value}</p>
      <div className="mt-1 flex items-center gap-2 text-[11px]">
        <span className={cn("inline-flex items-center gap-1 font-semibold", trendTone === "critical" ? "text-rose-600" : trendTone === "warning" ? "text-amber-600" : trendTone === "neutral" ? "text-slate-500" : "text-emerald-600")}>
          {trendTone === "critical" ? <ArrowDownRight className="size-3" /> : trendTone === "positive" ? <ArrowUpRight className="size-3" /> : null}{delta}
        </span>
        <span className="text-slate-400">{compareLabel}</span>
      </div>
      <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500">{context}</p>
    </div>
  );
}

function StatePill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const styles: Record<Tone, string> = {
    positive: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    critical: "bg-rose-50 text-rose-700",
    neutral: "bg-slate-100 text-slate-600",
  };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold", styles[tone])}><span className={cn("size-1.5 rounded-full", tone === "positive" ? "bg-emerald-500" : tone === "warning" ? "bg-amber-500" : tone === "critical" ? "bg-rose-500" : "bg-slate-400")} />{children}</span>;
}

function MiniBar({ value, color = "bg-emerald-500" }: { value: number; color?: string }) {
  return <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(3, Math.min(value, 100))}%` }} /></div>;
}

export function StrategicFinanceDashboard({ stats, profitability, clientPlans, receivables, periodSnapshots, userRole }: StrategicFinanceDashboardProps) {
  // Fecha fija durante la vida del componente: sin memo, cada render crea una
  // referencia nueva y anula el useMemo de selectedSnapshots.
  const now = useMemo(() => new Date(), []);
  const currentPeriodValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousPeriodValue = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
  const [period, setPeriod] = useState(currentPeriodValue);
  const [client, setClient] = useState("all");
  const [service, setService] = useState<ServiceFilter>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClosureOpen, setIsClosureOpen] = useState(false);

  const sortedSnapshots = useMemo(
    () => [...periodSnapshots].sort((a, b) => a.period.value.localeCompare(b.period.value)),
    [periodSnapshots]
  );
  const selectedSnapshots = useMemo(() => {
    if (period === "last_6_months") return sortedSnapshots.slice(-6);
    if (period === "ytd") return sortedSnapshots.filter((snapshot) => snapshot.period.year === now.getFullYear());
    return sortedSnapshots.filter((snapshot) => snapshot.period.value === period);
  }, [now, period, sortedSnapshots]);
  const currentSnapshot = sortedSnapshots.find((snapshot) => snapshot.period.value === currentPeriodValue);
  const lastSelectedSnapshot = selectedSnapshots.at(-1);
  const showClosure = period === currentPeriodValue && now.getDate() >= 21 && Boolean(currentSnapshot?.closureControl.pendingCount);
  const selectedPlans = useMemo(() => clientPlans.filter((plan) => {
    if (client !== "all" && plan.id !== client) return false;
    return getServiceShare(plan, service) > 0;
  }), [client, clientPlans, service]);
  const aggregate = useMemo(() => {
    if (selectedSnapshots.length) return aggregateSnapshots(selectedSnapshots, clientPlans, client, service);
    const fallbackIncome = stats.totalIncome ?? 0;
    const fallbackExpenses = stats.totalExpenses ?? 0;
    return {
      recognizedRevenue: fallbackIncome,
      collectedCash: fallbackIncome,
      directCosts: 0,
      operatingExpenses: fallbackExpenses,
      operatingResult: fallbackIncome - fallbackExpenses,
      netCashFlow: fallbackIncome - fallbackExpenses,
      closingReceivables: receivables?.totalReceivable ?? 0,
      clientsWithDebt: receivables?.clientsWithDebt ?? 0,
      clients: [],
    };
  }, [client, clientPlans, receivables, selectedSnapshots, service, stats.totalExpenses, stats.totalIncome]);
  const previousAggregate = useMemo(() => {
    if (period === "last_6_months" || period === "ytd") return null;
    const selectedDate = new Date(`${period}-01T12:00:00`);
    const previousDateForComparison = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
    const previousValue = `${previousDateForComparison.getFullYear()}-${String(previousDateForComparison.getMonth() + 1).padStart(2, "0")}`;
    const snapshot = sortedSnapshots.find((item) => item.period.value === previousValue);
    return snapshot ? aggregateSnapshots([snapshot], clientPlans, client, service) : null;
  }, [client, clientPlans, period, service, sortedSnapshots]);

  const totalIncome = aggregate.recognizedRevenue;
  const collectedCash = aggregate.collectedCash;
  const totalExpenses = aggregate.directCosts + aggregate.operatingExpenses;
  const operatingProfit = aggregate.operatingResult;
  const operatingMargin = totalIncome > 0 ? (operatingProfit / totalIncome) * 100 : 0;
  const receivableTotal = aggregate.closingReceivables;
  const receivableCount = aggregate.clientsWithDebt;
  const averageMonthlyExpenses = totalExpenses / Math.max(selectedSnapshots.length, 1);
  const availableCash = period === currentPeriodValue && client === "all" && service === "all"
    ? stats.cashBalance
    : Math.max(aggregate.netCashFlow, 0);
  const runway = averageMonthlyExpenses > 0 ? Math.max(0, Math.round((availableCash / averageMonthlyExpenses) * 30)) : 0;
  const totalContracted = selectedPlans.reduce((sum, plan) => sum + plan.monthlyRate * getServiceShare(plan, service), 0) * Math.max(selectedSnapshots.length, 1);
  const collectedRate = totalContracted > 0 ? Math.min(100, (collectedCash / totalContracted) * 100) : 0;
  const isRangePeriod = period === "last_6_months" || period === "ytd";
  const compareLabel = isRangePeriod ? "acumulado del período" : "vs. período anterior";
  const activeFilterCount = Number(period !== currentPeriodValue) + Number(client !== "all") + Number(service !== "all");
  const periodTitle = period === "last_6_months" ? "últimos 6 meses" : period === "ytd" ? "año en curso" : lastSelectedSnapshot?.periodLabel ?? "período seleccionado";

  const monthlyData = useMemo(() => {
    if (selectedSnapshots.length) return selectedSnapshots.map((snapshot) => {
      const monthAggregate = aggregateSnapshots([snapshot], clientPlans, client, service);
      return {
        month: snapshot.periodLabel.slice(0, 3),
        ingresos: monthAggregate.recognizedRevenue,
        gastos: monthAggregate.directCosts + monthAggregate.operatingExpenses,
        utilidad: monthAggregate.operatingResult,
        caja: monthAggregate.netCashFlow,
        cartera: monthAggregate.closingReceivables,
      };
    });
    return profitability?.monthlyData?.map((item) => ({ month: item.month.slice(0, 3), ingresos: item.income, gastos: item.expenses, utilidad: item.profit, caja: item.profit, cartera: 0 })) ?? [];
  }, [client, clientPlans, profitability?.monthlyData, selectedSnapshots, service]);

  const costData = useMemo(() => {
    const values = [
      { name: "Costos directos", amount: aggregate.directCosts },
      { name: "Gastos operativos", amount: aggregate.operatingExpenses },
    ].filter((item) => item.amount > 0);
    const total = values.reduce((sum, item) => sum + item.amount, 0) || 1;
    return values.sort((a, b) => b.amount - a.amount).slice(0, 6).map((item, index) => ({ ...item, value: Math.round((item.amount / total) * 100), color: ["#2563eb", "#059669", "#8b5cf6", "#f59e0b", "#0ea5e9", "#94a3b8"][index] }));
  }, [aggregate.directCosts, aggregate.operatingExpenses]);

  const clientRows = useMemo(() => aggregate.clients.slice(0, 5).map((row) => {
    const plan = clientPlans.find((item) => item.id === row.id);
    const margin = row.recognizedRevenue > 0 ? ((row.recognizedRevenue - row.directCosts) / row.recognizedRevenue) * 100 : 0;
    const riskTone: Tone = row.outstanding > row.recognizedRevenue * 0.5 ? "critical" : row.outstanding > 0 ? "warning" : "positive";
    return {
      ...row,
      monthlyRate: plan?.monthlyRate ?? row.recognizedRevenue,
      monthlyReels: plan?.monthlyReels ?? 0,
      monthlyFlyers: plan?.monthlyFlyers ?? 0,
      monthlyShoots: plan?.monthlyShoots ?? 0,
      status: plan?.status ?? "ACTIVE",
      margin,
      risk: riskTone === "critical" ? "Alto" : riskTone === "warning" ? "Medio" : "Bajo",
      riskTone,
    };
  }), [aggregate.clients, clientPlans]);

  const topReceivables = useMemo(() => {
    return aggregate.clients.filter((row) => row.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).slice(0, 4).map((row) => {
      const currentEntry = receivables?.pendingTransactions.find((item) => item.clientName === row.name);
      return {
        id: row.id,
        clientName: row.name,
        description: `Saldo pendiente · ${periodTitle}`,
        amount: row.outstanding,
        date: currentEntry?.date ?? new Date(),
        daysOverdue: period === currentPeriodValue ? currentEntry?.daysOverdue ?? 0 : 0,
        status: "PENDING" as const,
        sourceType: currentEntry?.sourceType ?? "RECURRING" as const,
      };
    });
  }, [aggregate.clients, currentPeriodValue, period, periodTitle, receivables?.pendingTransactions]);

  const aging = useMemo(() => {
    if (!lastSelectedSnapshot) return [];
    const scale = lastSelectedSnapshot.receivables.total > 0 ? receivableTotal / lastSelectedSnapshot.receivables.total : 0;
    return [
      { label: "0–15 días", amount: lastSelectedSnapshot.receivables.current * scale },
      { label: "16–30 días", amount: lastSelectedSnapshot.receivables.overdue1To30 * scale },
      { label: "31–60 días", amount: lastSelectedSnapshot.receivables.overdue31To60 * scale },
      { label: "+60 días", amount: lastSelectedSnapshot.receivables.overdue61Plus * scale },
    ];
  }, [lastSelectedSnapshot, receivableTotal]);

  const radar = [
    { label: "Liquidez", tone: runway < 15 ? "critical" as Tone : runway < 30 ? "warning" as Tone : "positive" as Tone, value: runway < 15 ? "Crítico" : runway < 30 ? "En vigilancia" : "Sano" },
    { label: "Rentabilidad", tone: operatingMargin < 15 ? "critical" as Tone : operatingMargin < 30 ? "warning" as Tone : "positive" as Tone, value: operatingMargin < 15 ? "Crítico" : operatingMargin < 30 ? "En vigilancia" : "Sano" },
    { label: "Cartera", tone: receivableTotal > totalIncome * 0.35 ? "critical" as Tone : receivableTotal > totalIncome * 0.15 ? "warning" as Tone : "positive" as Tone, value: receivableTotal > totalIncome * 0.35 ? "Crítico" : receivableTotal > totalIncome * 0.15 ? "En vigilancia" : "Sano" },
    { label: "Eficiencia operativa", tone: totalIncome > 0 && totalExpenses / totalIncome > 0.7 ? "warning" as Tone : "positive" as Tone, value: totalIncome > 0 && totalExpenses / totalIncome > 0.7 ? "En vigilancia" : "Sano" },
  ];

  const heatmap = useMemo(() => {
    const source = period === currentPeriodValue && client === "all" && service === "all" ? stats.heatmapData ?? [] : [];
    const categories = Array.from(new Set(source.map((item) => item.category))).slice(0, 5);
    const fallbackCategories = categories.length ? categories : ["Producción", "Contenido", "Diseño", "Publicidad", "Otros"];
    const max = Math.max(...source.map((item) => item.amount), 1);
    return { categories: fallbackCategories, max, getCell: (week: number, category: string) => source.find((item) => item.week === week && item.category === category) };
  }, [client, currentPeriodValue, period, service, stats.heatmapData]);

  const incomeDelta = previousAggregate ? deltaPercent(totalIncome, previousAggregate.recognizedRevenue) : null;
  const profitDelta = previousAggregate ? deltaPercent(operatingProfit, previousAggregate.operatingResult) : null;
  const cashDelta = previousAggregate ? deltaPercent(aggregate.netCashFlow, previousAggregate.netCashFlow) : null;
  const receivableDelta = previousAggregate ? deltaPercent(receivableTotal, previousAggregate.closingReceivables) : null;
  const formatDelta = (value: number | null) => value === null ? "Acumulado" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  const positiveTrend = (value: number | null): Tone => value === null ? "neutral" : value >= 0 ? "positive" : "critical";
  const inverseTrend = (value: number | null): Tone => value === null ? "neutral" : value <= 0 ? "positive" : "critical";
  const sparkPoints = (key: "ingresos" | "utilidad" | "cartera" | "caja") => {
    const values = monthlyData.map((item) => item[key]);
    if (values.length === 0) return [0, 0];
    if (values.length === 1) return [values[0] * 0.92, values[0]];
    return values;
  };

  const exportCsv = () => {
    const rows = [
      ["Cliente", "Ingreso reconocido", "Caja cobrada", "Costo directo", "Margen", "Cartera pendiente"],
      ...clientRows.map((row) => [row.name, row.recognizedRevenue, row.collectedCash, row.directCosts, row.margin, row.outstanding]),
    ];
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `totem-finanzas-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.dispatchEvent(new CustomEvent("totem:dashboard-refresh"));
    window.setTimeout(() => window.location.reload(), 420);
  };

  return (
    <div className="finance-dashboard space-y-5 pb-8">
      {showClosure && currentSnapshot && (
        <section className="rounded-2xl border border-amber-200/80 bg-[#fffaf1] px-4 py-4 shadow-[0_8px_24px_rgba(146,64,14,0.05)] sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><TriangleAlert className="size-4" /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold text-slate-950">Cierre contable pendiente</h2><span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Desde el día 21</span></div>
                <p className="mt-1 text-xs text-slate-600">{currentSnapshot.closureControl.pendingCount} clientes requieren cierre de {currentSnapshot.periodLabel}. Monto potencial pendiente: <strong className="font-semibold text-slate-900">{moneyPrecise(currentSnapshot.closureControl.pendingAmount)}</strong>.</p>
                {isClosureOpen && <div className="mt-3 flex flex-wrap gap-1.5">{currentSnapshot.closureControl.pendingClients.slice(0, 6).map((item) => <span key={item.id} className="rounded-md border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-700">{item.name}</span>)}</div>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 pl-12 lg:pl-0">
              <button type="button" onClick={() => setIsClosureOpen((value) => !value)} className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-amber-100/70">{isClosureOpen ? "Ocultar detalle" : "Ver detalle"}</button>
              <Link href="/finance/monthly-close" className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-600">Ir al cierre mensual <ArrowRight className="size-3.5" /></Link>
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <FinanceSectionNav userRole={userRole} className="min-w-0 flex-1" />
        <TransactionDialog isAdminOverride={userRole === "ADMIN"}>
          <button type="button" className="inline-flex min-h-[46px] w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary-color))] px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-[0_6px_14px_hsl(var(--primary-color)/0.18)] transition-transform hover:opacity-90 active:scale-[0.98] xl:w-auto"><Plus className="size-4" />Nueva transacción</button>
        </TransactionDialog>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.025)] sm:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[170px] flex-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Período<Select value={period} onValueChange={setPeriod}><SelectTrigger className="mt-1.5 h-9 rounded-lg border-slate-200 bg-slate-50/60 text-xs font-medium normal-case tracking-normal"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={currentPeriodValue}>{currentSnapshot?.periodLabel ?? currentPeriodValue}</SelectItem><SelectItem value={previousPeriodValue}>{sortedSnapshots.find((snapshot) => snapshot.period.value === previousPeriodValue)?.periodLabel ?? previousPeriodValue}</SelectItem><SelectItem value="last_6_months">Últimos 6 meses</SelectItem><SelectItem value="ytd">Año en curso</SelectItem></SelectContent></Select></label>
          <label className="min-w-[170px] flex-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Cliente<Select value={client} onValueChange={setClient}><SelectTrigger className="mt-1.5 h-9 rounded-lg border-slate-200 bg-slate-50/60 text-xs font-medium normal-case tracking-normal"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los clientes</SelectItem>{clientPlans.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}</SelectContent></Select></label>
          <label className="min-w-[170px] flex-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Servicio<Select value={service} onValueChange={(value) => setService(value as ServiceFilter)}><SelectTrigger className="mt-1.5 h-9 rounded-lg border-slate-200 bg-slate-50/60 text-xs font-medium normal-case tracking-normal"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los servicios</SelectItem><SelectItem value="content">Contenido para redes</SelectItem><SelectItem value="design">Diseño gráfico</SelectItem><SelectItem value="production">Producción audiovisual</SelectItem></SelectContent></Select></label>
          <div className="flex items-center gap-2 pb-1.5 text-xs text-slate-500"><span className={cn("size-2 rounded-full", activeFilterCount > 0 ? "bg-blue-500" : "bg-slate-300")} />{activeFilterCount} {activeFilterCount === 1 ? "filtro activo" : "filtros activos"} <button type="button" disabled={activeFilterCount === 0} onClick={() => { setPeriod(currentPeriodValue); setClient("all"); setService("all"); }} className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950 disabled:cursor-default disabled:text-slate-300 disabled:no-underline">Limpiar</button></div>
          <button type="button" onClick={handleRefresh} className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900" aria-label="Actualizar dashboard"><RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} /></button>
        </div>
        {service !== "all" && <p className="mt-3 text-[10px] leading-relaxed text-slate-400">La vista por servicio distribuye ingresos y costos según los entregables contratados del plan: reels, piezas de diseño y rodajes.</p>}
      </section>

      <section>
        <SectionTitle title={`Salud financiera · ${periodTitle}`} description="Todos los indicadores responden al período, cliente y servicio seleccionados." />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard label="Ingresos netos" value={money(totalIncome)} delta={formatDelta(incomeDelta)} compareLabel={previousAggregate ? compareLabel : "en el período"} context="Ingreso reconocido para el alcance seleccionado." tone={totalIncome >= 0 ? "positive" : "critical"} trendTone={positiveTrend(incomeDelta)} points={sparkPoints("ingresos")} icon={CircleDollarSign} />
          <MetricCard label="Utilidad operativa" value={money(operatingProfit)} delta={formatDelta(profitDelta)} compareLabel={previousAggregate ? compareLabel : "en el período"} context="Resultado después de costos directos y gastos operativos." tone={operatingProfit >= 0 ? "positive" : "critical"} trendTone={positiveTrend(profitDelta)} points={sparkPoints("utilidad")} icon={TrendingUp} />
          <MetricCard label="Caja neta del período" value={money(aggregate.netCashFlow)} delta={formatDelta(cashDelta)} compareLabel={previousAggregate ? compareLabel : "en el período"} context="Cobros menos salidas de caja del alcance seleccionado." tone={aggregate.netCashFlow >= 0 ? "positive" : "critical"} trendTone={positiveTrend(cashDelta)} points={sparkPoints("caja")} icon={WalletCards} />
          <MetricCard label="Cartera pendiente" value={money(receivableTotal)} delta={formatDelta(receivableDelta)} compareLabel={previousAggregate ? compareLabel : "en el período"} context={`${receivableCount} ${receivableCount === 1 ? "cliente" : "clientes"} con saldo pendiente al corte.`} tone={receivableTotal > 0 ? "critical" : "positive"} trendTone={inverseTrend(receivableDelta)} points={sparkPoints("cartera")} icon={ReceiptText} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.025)]"><div><p className="text-[11px] font-medium text-slate-500">Runway estimado <InfoTip label="Días de operación que cubre la caja disponible al ritmo promedio de gasto del período." /></p><p className={cn("mt-1 text-lg font-semibold tracking-[-0.04em]", runway < 15 ? "text-rose-600" : "text-blue-600")}>{runway} días</p></div><div className="text-right"><p className="text-[11px] text-slate-400">Burn rate mensual</p><p className="mt-1 text-xs font-semibold text-slate-700">{money(averageMonthlyExpenses)}</p></div></div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.025)]"><div><p className="text-[11px] font-medium text-slate-500">Margen operativo <InfoTip label="Utilidad operativa dividida por ingresos netos del período." /></p><p className={cn("mt-1 text-lg font-semibold tracking-[-0.04em]", operatingMargin >= 30 ? "text-emerald-600" : "text-amber-600")}>{percent(operatingMargin)}</p></div><div className="flex items-center gap-2"><MiniBar value={Math.max(0, operatingMargin)} color={operatingMargin >= 30 ? "bg-emerald-500" : "bg-amber-500"} /><span className="text-[11px] text-slate-400">objetivo 30%</span></div></div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-[1.08fr_1fr_0.92fr]">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.025)]"><SectionTitle title="Rentabilidad multinivel" description="Tres lecturas para separar margen, operación y caja real." /><div className="grid grid-cols-3 gap-2">{[{ label: "Directa", value: totalIncome - aggregate.directCosts, detail: "Ingreso menos costos directos", tone: "text-blue-600" }, { label: "Ajustada", value: operatingProfit, detail: "Incluye gastos operativos", tone: "text-violet-600" }, { label: "Real", value: aggregate.netCashFlow, detail: "Caja efectivamente generada", tone: "text-emerald-600" }].map((item) => <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"><p className={cn("text-[10px] font-semibold", item.tone)}>{item.label}</p><p className="mt-2 text-sm font-semibold tracking-[-0.03em] text-slate-900">{money(item.value)}</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">{item.detail}</p></div>)}</div><div className="mt-3 flex items-start gap-2 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />La lectura real usa cobros y salidas de caja del período filtrado.</div></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.025)]"><SectionTitle title="Proyectado vs. cobrado" description={`Cumplimiento contractual de ${periodTitle}.`} /><div className="flex items-center gap-5"><div><p className="text-3xl font-semibold tracking-[-0.06em] text-blue-600">{Math.round(collectedRate)}%</p><p className="mt-1 text-[11px] text-slate-500">de lo proyectado</p><p className="mt-4 text-xs font-medium text-slate-700">Diferencia <span className="ml-2 font-semibold text-rose-600">{money(totalContracted - collectedCash)}</span></p></div><div className="h-40 flex-1"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: "Período", proyectado: totalContracted, cobrado: collectedCash }]} barCategoryGap="28%"><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" hide /><YAxis hide /><RechartsTooltip formatter={(value: number) => money(value)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 11 }} /><Bar dataKey="proyectado" fill="#bfdbfe" radius={[5, 5, 0, 0]} /><Bar dataKey="cobrado" fill="#2563eb" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></div><div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-blue-200" />Proyectado {money(totalContracted)}</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-blue-600" />Cobrado {money(collectedCash)}</span></div></div>
        <div className="col-span-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.025)] xl:col-span-1"><SectionTitle title="Radar financiero" description="Estado de las dimensiones que más afectan la decisión." /><div className="space-y-1">{radar.map((item) => <div key={item.label} className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0"><span className="text-xs font-medium text-slate-700">{item.label}</span><StatePill tone={item.tone}>{item.value}</StatePill></div>)}</div></div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-[1.28fr_0.72fr]">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.025)]"><SectionTitle title="Tendencia de flujo de caja" description="Evolución de ingresos, gastos y utilidad en los últimos meses." /><div className="h-60"><ResponsiveContainer width="100%" height="100%"><LineChart data={monthlyData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="#eef2f6" /><XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(value) => compact(value)} /><RechartsTooltip formatter={(value: number) => money(value)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 11 }} /><Line type="monotone" dataKey="ingresos" name="Ingresos" stroke="#059669" strokeWidth={2} dot={{ r: 2, fill: "#059669" }} /><Line type="monotone" dataKey="gastos" name="Gastos" stroke="#f97316" strokeWidth={2} dot={{ r: 2, fill: "#f97316" }} /><Line type="monotone" dataKey="utilidad" name="Utilidad" stroke="#2563eb" strokeWidth={2} dot={{ r: 2, fill: "#2563eb" }} /></LineChart></ResponsiveContainer></div><div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" />Ingresos</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-orange-500" />Gastos</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-blue-600" />Utilidad</span></div></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.025)]"><SectionTitle title="Estructura de costos" description="Dónde se concentra el gasto operativo del mes." /><div className="flex items-center gap-5"><div className="relative size-36 shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={costData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={66} paddingAngle={2} stroke="none">{costData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-sm font-semibold text-slate-900">{money(totalExpenses)}</span><span className="text-[9px] text-slate-400">total costos</span></div></div><div className="min-w-0 flex-1 space-y-2">{costData.slice(0, 5).map((item) => <div key={item.name} className="flex items-center gap-2 text-[10px]"><span className="size-2 rounded-full" style={{ backgroundColor: item.color }} /><span className="min-w-0 flex-1 truncate text-slate-600">{item.name}</span><span className="font-semibold text-slate-800">{item.value}%</span></div>)}</div></div></div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.025)]"><SectionTitle title="Comparación por cliente" description="Ranking por ingreso reconocido, margen directo y cartera." action={<Link href="/clients" className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700">Ver ranking completo <ChevronRight className="size-3" /></Link>} /><div className="space-y-1">{clientRows.map((row) => <div key={row.id} className="grid grid-cols-[minmax(0,1.4fr)_0.85fr_1fr_auto] items-center gap-3 border-b border-slate-100 py-2.5 last:border-0"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{row.name}</p><p className="mt-0.5 text-[10px] text-slate-400">{row.monthlyReels} reels · {row.monthlyFlyers} diseños · {row.monthlyShoots} rodajes</p></div><span className="text-right text-xs font-medium text-slate-700">{money(row.recognizedRevenue)}</span><div className="flex items-center gap-2"><MiniBar value={row.margin} /><span className="w-7 text-right text-[10px] text-slate-500">{Math.round(row.margin)}%</span></div><StatePill tone={row.riskTone}>{row.risk}</StatePill></div>)}</div></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.025)]"><SectionTitle title="Mapa de calor operativo" description="Intensidad de costos por servicio y semana." /><div className="overflow-x-auto"><div className="min-w-[390px] space-y-2"><div className="grid grid-cols-[112px_repeat(5,1fr)] items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-400"><span />{[1, 2, 3, 4, 5].map((week) => <span key={week} className="text-center">Sem {week}</span>)}</div>{heatmap.categories.map((category) => <div key={category} className="grid grid-cols-[112px_repeat(5,1fr)] items-center gap-1.5"><span className="truncate text-[10px] font-medium text-slate-600">{category}</span>{[1, 2, 3, 4, 5].map((week) => { const cell = heatmap.getCell(week, category); const intensity = cell ? Math.max(0.12, cell.amount / heatmap.max) : 0.07; return <div key={`${category}-${week}`} title={`${category}, semana ${week}: ${money(cell?.amount ?? 0)}`} className="h-7 rounded-md" style={{ backgroundColor: cell ? `rgba(249, 115, 22, ${Math.min(0.82, intensity)})` : "#f1f5f9" }} />; })}</div>)}</div></div><div className="mt-4 flex items-center justify-end gap-3 text-[10px] text-slate-400"><span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-slate-100" />Bajo</span><span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-orange-300" />Medio</span><span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-orange-600" />Alto</span></div></div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-[1.15fr_0.85fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.025)]"><SectionTitle title="Cuentas por cobrar" description={`${receivableCount} clientes con saldo pendiente.`} action={<Link href="/finance/receivables" className="text-[11px] font-semibold text-blue-600">Ver cartera</Link>} /><div className="grid grid-cols-4 gap-1.5">{aging.map((item) => <div key={item.label} className="rounded-xl bg-slate-50 p-2.5"><p className="text-[9px] text-slate-500">{item.label}</p><p className="mt-1 text-xs font-semibold text-slate-900">{money(item.amount)}</p></div>)}</div><div className="mt-4 space-y-2">{topReceivables.length ? topReceivables.map((item) => <div key={item.id} className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0"><div className="flex size-7 items-center justify-center rounded-lg bg-rose-50 text-[10px] font-semibold text-rose-600">{(item.clientName ?? "SC").slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-700">{item.clientName ?? item.description}</p><p className="text-[10px] text-slate-400">{item.daysOverdue} días de antigüedad</p></div><span className="text-xs font-semibold text-slate-800">{money(item.amount)}</span></div>) : <p className="py-4 text-center text-xs text-slate-400">No hay cuentas pendientes en el período.</p>}</div></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.025)]"><SectionTitle title="Aprobaciones y bloqueos" description="Elementos que afectan facturación o cierre." /><div className="space-y-1">{[{ icon: FileCheck2, label: "Entregables pendientes de aprobación", meta: `${Math.max(0, receivableCount - 1)} proyectos`, tone: "warning" as Tone }, { icon: ReceiptText, label: "Facturas por emitir", meta: totalContracted > totalIncome ? money(totalContracted - totalIncome) : "Al día", tone: totalContracted > totalIncome ? "warning" as Tone : "positive" as Tone }, { icon: Landmark, label: "Confirmaciones de cliente", meta: receivableCount ? `${receivableCount} en espera` : "Sin pendientes", tone: receivableCount ? "warning" as Tone : "positive" as Tone }, { icon: AlertCircle, label: "Bloqueos contables", meta: showClosure ? "Revisar cierre" : "Sin bloqueos", tone: showClosure ? "critical" as Tone : "positive" as Tone }].map((item) => <div key={item.label} className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0"><div className="flex size-7 items-center justify-center rounded-lg bg-slate-50 text-slate-500"><item.icon className="size-3.5" /></div><p className="min-w-0 flex-1 text-[11px] font-medium leading-snug text-slate-700">{item.label}</p><StatePill tone={item.tone}>{item.meta}</StatePill></div>)}</div></div>
        <div className="col-span-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.025)] xl:col-span-1"><SectionTitle title="Alertas y oportunidades" description="Insights para tomar acción esta semana." /><div className="space-y-2">{[{ icon: TriangleAlert, title: runway < 15 ? "Riesgo de desbalance de caja" : "Caja bajo seguimiento", detail: `${runway} días de runway estimado.`, tone: runway < 15 ? "critical" as Tone : "warning" as Tone }, { icon: Sparkles, title: "Oportunidad de optimización", detail: `${costData[0]?.name ?? "Costos"} concentra ${costData[0]?.value ?? 0}% del gasto.`, tone: "warning" as Tone }, { icon: CheckCircle2, title: "Cliente con alto margen", detail: clientRows[0] ? `${clientRows[0].name} lidera con ${Math.round(clientRows[0].margin)}%.` : "Sin datos suficientes.", tone: "positive" as Tone }, { icon: ReceiptText, title: "Cuentas por cobrar vencidas", detail: topReceivables.filter((item) => item.daysOverdue > 30).length ? "Priorizar seguimiento de saldos +30 días." : "No hay saldos críticos.", tone: topReceivables.some((item) => item.daysOverdue > 30) ? "critical" as Tone : "positive" as Tone }].map((item) => <div key={item.title} className="flex gap-2.5 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0"><div className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg", item.tone === "positive" ? "bg-emerald-50 text-emerald-600" : item.tone === "critical" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600")}><item.icon className="size-3.5" /></div><div><p className="text-[11px] font-semibold text-slate-800">{item.title}</p><p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{item.detail}</p></div></div>)}</div></div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.025)]"><SectionTitle eyebrow="Registro operativo" title="Detalle transaccional y rentabilidad" description="Vista compacta por cliente con indicadores del alcance filtrado." action={<button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"><Download className="size-3.5" />Exportar CSV</button>} /><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead><tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"><th className="pb-3 pr-4">Cliente</th><th className="pb-3 pr-4 text-right">Tarifa mensual</th><th className="pb-3 pr-4 text-center">Reels</th><th className="pb-3 pr-4 text-center">Rodajes</th><th className="pb-3 pr-4">Estado</th><th className="pb-3 pr-4 text-right">Ingreso</th><th className="pb-3 pr-4 text-right">Costo directo</th><th className="pb-3 pr-4 text-right">Margen</th><th className="pb-3">Cobranza</th></tr></thead><tbody>{clientRows.map((row) => <tr key={row.id} className="border-b border-slate-100/80 text-xs transition-colors hover:bg-slate-50/70"><td className="py-3 pr-4 font-semibold text-slate-800">{row.name}</td><td className="py-3 pr-4 text-right text-slate-600">{moneyPrecise(row.monthlyRate)}</td><td className="py-3 pr-4 text-center text-slate-500">{row.monthlyReels}</td><td className="py-3 pr-4 text-center text-slate-500">{row.monthlyShoots}</td><td className="py-3 pr-4"><StatePill tone={row.status === "ACTIVE" ? "positive" : "neutral"}>{row.status === "ACTIVE" ? "Activo" : row.status}</StatePill></td><td className="py-3 pr-4 text-right font-medium text-slate-700">{moneyPrecise(row.recognizedRevenue)}</td><td className="py-3 pr-4 text-right text-slate-500">{moneyPrecise(row.directCosts)}</td><td className="py-3 pr-4 text-right font-semibold text-emerald-600">{Math.round(row.margin)}%</td><td className="py-3"><span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", row.outstanding > 0 ? "text-amber-600" : "text-emerald-600")}><span className={cn("size-1.5 rounded-full", row.outstanding > 0 ? "bg-amber-500" : "bg-emerald-500")} />{row.outstanding > 0 ? `Pendiente ${money(row.outstanding)}` : "Al día"}</span></td></tr>)}</tbody></table></div><div className="mt-3 flex items-center justify-between text-[10px] text-slate-400"><span>{aggregate.clients.length} clientes incluidos en {periodTitle}</span><Link href="/finance/transactions" className="inline-flex items-center gap-1 font-semibold text-blue-600">Ver todas las transacciones <ArrowRight className="size-3" /></Link></div></section>
    </div>
  );
}
