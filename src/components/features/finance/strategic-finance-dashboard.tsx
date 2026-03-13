"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Filter,
  LineChart,
  PieChart,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
  Plus,
  Info,
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import type { FinancialStats } from "@/lib/finance-reporting-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";
import { SimpleAIInsights } from "@/components/features/finance/ai-insights-simple";
import { cn } from "@/lib/utils";

type StrategicFinanceProfitability = {
  profitMargin?: number | null;
  [key: string]: unknown;
};

type DashboardClientPlan = {
  id: string;
  name: string;
  status: string;
  monthlyRate?: number;
  monthlyReels?: number;
  monthlyShoots?: number;
  [key: string]: unknown;
};

interface StrategicFinanceDashboardProps {
  stats: FinancialStats & {
    marginDeltaPct?: number;
    pendingReimbursements?: number;
    pendingReimbursementsDeltaPct?: number;
    totalHonorariosPaid?: number;
    totalHonorariosPaidDeltaPct?: number;
    recentTransactions: FinancialStats["recentTransactions"];
    heatmapData?: NonNullable<FinancialStats["heatmapData"]>;
    financeSettingsMetrics?: NonNullable<FinancialStats["financeSettingsMetrics"]>;
  };
  profitability?: StrategicFinanceProfitability | null;
  clientPlans: DashboardClientPlan[];
  userRole?: string;
}

type KpiTone = "positive" | "negative" | "neutral";

type KpiCard = {
  title: string;
  value: number | null;
  delta: number;
  tone: KpiTone;
  compareLabel: string;
  isPercent?: boolean;
  explanation?: string;
  tooltip?: string;
  actionHref?: string;
  actionLabel?: string;
};

type CostDistributionItem = {
  name: string;
  value: number;
  amount: number;
  color: string;
};

type DashboardFinanceSettingsMetrics = NonNullable<StrategicFinanceDashboardProps["stats"]["financeSettingsMetrics"]>;
type DashboardAdminBudget = DashboardFinanceSettingsMetrics["adminBudgets"][number];
type DashboardAnalyticsSummary = DashboardFinanceSettingsMetrics["personalAnalytics"]["summaries"][number];
type DashboardAnalyticsTransfer = DashboardFinanceSettingsMetrics["personalAnalytics"]["suggestedTransfers"][number];

type HeatmapGridCell = {
  week: number;
  category: string;
  amount: number;
  count: number;
  intensity: number;
};

function ExplainedTooltip({ title, explanation, tooltip }: { title: string; explanation?: string; tooltip?: string }) {
  const content = tooltip || explanation || "";
  
  if (!content) return null;
  
  return (
    <div className="group relative inline-block">
      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
      <div className="absolute bottom-full left-1/2 mb-2 hidden w-80 -translate-x-1/2 rounded-lg border bg-popover p-4 text-xs text-popover-foreground shadow-lg group-hover:block z-50">
        <div className="font-semibold mb-2 text-sm">{title}</div>
        <div className="whitespace-pre-line">{content}</div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-popover"></div>
      </div>
    </div>
  );
}

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

function KpiValue({ value, isPercent }: { value: number | null; isPercent?: boolean }) {
  return (
    <span className="text-2xl font-semibold tracking-tight">
      {isPercent ? formatPercent(value) : formatCurrency(value)}
    </span>
  );
}

function TrendBadge({ delta, tone }: { delta: number; tone: KpiTone }) {
  const isPositive = tone === "positive";
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        isPositive
          ? "bg-emerald-50 text-emerald-700"
          : tone === "negative"
            ? "bg-rose-50 text-rose-700"
            : "bg-slate-100 text-slate-700"
      )}
    >
      <Icon className="h-3 w-3" />
      {delta > 0 ? "+" : ""}
      {delta.toFixed(1)}%
    </span>
  );
}

function TrafficIndicator({ label, status }: { label: string; status: "good" | "warning" | "critical" }) {
  const tone =
    status === "good"
      ? "bg-emerald-500"
      : status === "warning"
        ? "bg-amber-500"
        : "bg-rose-500";

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-4 py-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">Estado financiero</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={cn("h-3 w-3 rounded-full", tone)} />
        <span className="text-xs text-muted-foreground">
          {status === "good" ? "Sano" : status === "warning" ? "En vigilancia" : "Crítico"}
        </span>
      </div>
    </div>
  );
}

export function StrategicFinanceDashboard({ stats, profitability, clientPlans, userRole }: StrategicFinanceDashboardProps) {
  const [period, setPeriod] = useState("current_month");
  const [client, setClient] = useState("all");
  const [service, setService] = useState("all");

  const periodLabel = useMemo(() => {
    const now = new Date();
    const monthName = now.toLocaleDateString("es-ES", { month: "long" });
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthName = prevDate.toLocaleDateString("es-ES", { month: "long" });

    if (period === "current_month") {
      return `Mes actual · ${monthName}`;
    }

    if (period === "previous_month") {
      return `Mes pasado · ${prevMonthName}`;
    }

    return "Mes actual";
  }, [period]);

  const selectedPlans = useMemo<DashboardClientPlan[]>(() => {
    if (client === "all") return clientPlans;
    return clientPlans.filter((plan) => plan.id === client);
  }, [client, clientPlans]);

  const totals = useMemo(() => {
    return selectedPlans.reduce(
      (acc, plan) => {
        acc.totalRate += plan.monthlyRate ?? 0;
        acc.totalReels += plan.monthlyReels ?? 0;
        acc.totalShoots += plan.monthlyShoots ?? 0;
        acc.activeClients += plan.status === "ACTIVE" ? 1 : 0;
        return acc;
      },
      { totalRate: 0, totalReels: 0, totalShoots: 0, activeClients: 0 }
    );
  }, [selectedPlans]);

  const projectedVsCollected = useMemo(() => {
    const deltaPct = stats.incomeDeltaPct ?? 0;
    const safeDelta = 1 + deltaPct / 100;
    const previousIncome = safeDelta <= 0 ? stats.totalIncome : stats.totalIncome / safeDelta;
    const collected = period === "previous_month" ? previousIncome : stats.totalIncome;

    return [
      {
        name: periodLabel,
        proyectado: Math.round(totals.totalRate || 0),
        cobrado: Math.round(collected || 0),
      },
    ];
  }, [period, periodLabel, stats.incomeDeltaPct, stats.totalIncome, totals.totalRate]);

  const topClients = useMemo<DashboardClientPlan[]>(() => {
    return [...selectedPlans]
      .sort((a, b) => (b.monthlyRate ?? 0) - (a.monthlyRate ?? 0))
      .slice(0, 5);
  }, [selectedPlans]);

  const cashFlowData = useMemo(() => {
    // Generate mock monthly trend data based on current stats
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
    return months.map((month, index) => ({
      month,
      ingresos: Math.round(stats.totalIncome * (0.8 + (index * 0.04))),
      gastos: Math.round(stats.totalExpenses * (0.9 + (index * 0.02))),
      utilidad: Math.round(stats.netProfit * (0.7 + (index * 0.05))),
    }));
  }, [stats]);

  // Datos del mapa de calor
  const heatmapGrid = useMemo<{ grid: HeatmapGridCell[]; categories: string[]; maxAmount: number }>(() => {
    if (!stats.heatmapData || stats.heatmapData.length === 0) {
      return { grid: [], categories: [], maxAmount: 0 };
    }

    // Obtener todas las categorías únicas
    const categories: string[] = Array.from(new Set(stats.heatmapData.map((d) => d.category))).sort();
    
    // Calcular el monto máximo para normalizar los colores
    const maxAmount = Math.max(...stats.heatmapData.map((d) => d.amount), 1);

    // Crear grid de 4 semanas x N categorías
    const grid: HeatmapGridCell[] = [];
    for (let week = 1; week <= 4; week++) {
      for (const category of categories) {
        const cell = stats.heatmapData.find((d) => d.week === week && d.category === category);
        grid.push({
          week,
          category,
          amount: cell?.amount || 0,
          count: cell?.count || 0,
          intensity: cell ? (cell.amount / maxAmount) : 0,
        });
      }
    }

    return { grid, categories, maxAmount };
  }, [stats.heatmapData]);

  const financeSettingsMetrics: DashboardFinanceSettingsMetrics | undefined = stats.financeSettingsMetrics;

  const budgetStatusLabel = (status: "normal" | "warning" | "alert" | "approval_required") => {
    if (status === "approval_required") return "Aprobación requerida";
    if (status === "alert") return "Alerta";
    if (status === "warning") return "Advertencia";
    return "Normal";
  };

  const budgetStatusClassName = (status: "normal" | "warning" | "alert" | "approval_required") => {
    if (status === "approval_required") return "bg-red-100 text-red-800";
    if (status === "alert") return "bg-orange-100 text-orange-800";
    if (status === "warning") return "bg-amber-100 text-amber-800";
    return "bg-emerald-100 text-emerald-800";
  };

  const costDistributionData = useMemo<CostDistributionItem[]>(() => {
    // Calcular distribución real de costos por categoría
    const categoryMap = new Map<string, number>();
    
    // Procesar transacciones recientes para agrupar por categoría
    stats.recentTransactions.forEach((transaction) => {
      if (transaction.type === "EXPENSE" || transaction.type === "HONORARIOS") {
        const category = transaction.category || (transaction.type === "HONORARIOS" ? "Honorarios" : "Otros");
        const current = categoryMap.get(category) || 0;
        categoryMap.set(category, current + transaction.amount);
      }
    });

    // Calcular total de gastos
    const totalExpenses = Array.from(categoryMap.values()).reduce((sum, val) => sum + val, 0);

    // Si no hay gastos, retornar datos mock
    if (totalExpenses === 0 || categoryMap.size === 0) {
      return [
        { name: 'Sin datos', value: 100, color: '#6b7280' },
      ].map((item) => ({ ...item, amount: 0 }));
    }

    // Definir colores para categorías comunes
    const categoryColors: Record<string, string> = {
      'Comida': '#f59e0b',
      'Transporte': '#3b82f6',
      'Software': '#8b5cf6',
      'Honorarios': '#10b981',
      'Producción': '#10b981',
      'Marketing': '#f59e0b',
      'Personal': '#3b82f6',
      'Operación': '#8b5cf6',
      'Invitaciones': '#ec4899',
      'Otros': '#6b7280',
    };

    // Convertir a array y calcular porcentajes
    const distribution = Array.from(categoryMap.entries())
      .map(([name, amount]) => ({
        name,
        value: Math.round((amount / totalExpenses) * 100),
        amount,
        color: categoryColors[name] || '#6b7280',
      }))
      .sort((a, b) => b.amount - a.amount);

    return distribution;
  }, [stats.recentTransactions]);

  const clientComparisonData = useMemo<Array<{ name: string; ingresos: number; reels: number; rodajes: number; margen: number }>>(() => {
    return topClients.map((plan: DashboardClientPlan, index: number) => ({
      name: plan.name,
      ingresos: plan.monthlyRate ?? 0,
      reels: plan.monthlyReels ?? 0,
      rodajes: plan.monthlyShoots ?? 0,
      margen: 75 - (index * 5), // Mock margin decreasing with rank
    }));
  }, [topClients]);

  const projectionsData = useMemo(() => {
    const baseIncome = totals.totalRate * 3; // Quarterly projection
    // Calcular margen base de forma más segura
    const netProfit = stats.netProfit || 0;
    const totalIncome = stats.totalIncome || 1;
    const calculatedMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
    const baseMargin = Math.max(Math.min(calculatedMargin, 80), -50); // Limitar entre -50% y 80%
    
    // Calcular runway real basado en datos actuales
    const monthlyExpenses = stats.totalExpenses || 1;
    const currentCash = Math.max(stats.totalIncome - stats.totalExpenses, 0) * 2; // Estimación de efectivo actual
    const baseLiquidity = Math.max(Math.round((currentCash / monthlyExpenses) * 30), 1); // Días de operación

    return [
      {
        name: "Conservador",
        ingresos: Math.round(baseIncome * 0.85), // -15% vs base
        margen: Math.max(baseMargin - 5, -20), // -5% margin points, mínimo -20%
        liquidez: Math.max(baseLiquidity - 10, 30), // -10 days
        badge: "Bajo riesgo",
      },
      {
        name: "Base",
        ingresos: Math.round(baseIncome), // Current trend
        margen: Math.round(baseMargin),
        liquidez: baseLiquidity,
        badge: "Realista",
      },
      {
        name: "Agresivo",
        ingresos: Math.round(baseIncome * 1.25), // +25% vs base
        margen: Math.min(baseMargin + 3, 60), // +3% margin points, máximo 60%
        liquidez: baseLiquidity + 15, // +15 days
        badge: "Alto crecimiento",
      },
    ];
  }, [totals.totalRate, stats.netProfit, stats.totalIncome]);

  const kpiCards = useMemo<KpiCard[]>(() => {
    const base: KpiCard[] = [
      {
        title: "Ingresos brutos",
        value: stats.totalIncome,
        delta: stats.incomeDeltaPct ?? 0,
        tone: "positive",
        compareLabel: "vs. mes anterior",
        explanation: "Todo el dinero que entra por nuestros servicios antes de restar gastos. Como lo que cobramos a los clientes mensualmente.",
        tooltip: "Ingresos brutos = Suma total de facturas, pagos y honorarios recibidos. Es el dinero que generas antes de cualquier deducción. Ejemplo: si cobras $1M en facturas y $200k en honorarios, tus ingresos brutos son $1.2M.",
      },
      {
        title: "Gasto operativo",
        value: stats.totalExpenses,
        delta: stats.expensesDeltaPct ?? 0,
        tone: "negative",
        compareLabel: "vs. mes anterior",
        explanation: "Costos necesarios para mantener el negocio funcionando: sueldos, alquiler, software, producción, etc.",
        tooltip: "Gastos operativos = Todos los costos para operar el negocio. Incluye: sueldos, alquiler, software, marketing, producción, transporte, impuestos, etc. No incluye inversiones o gastos personales no relacionados con el negocio.",
      },
      {
        title: "Utilidad neta",
        value: stats.netProfit,
        delta: stats.netProfitDeltaPct ?? 0,
        tone: stats.netProfit >= 0 ? "positive" : "negative",
        compareLabel: "vs. promedio 90d",
        explanation: "Lo que realmente nos queda después de pagar todos los gastos. Es la ganancia real del negocio.",
        tooltip: "Utilidad neta = Ingresos brutos - Gastos operativos. Es el dinero real que te queda para reinvertir, pagar dividendos o ahorrar. Si es negativa, estás perdiendo dinero y necesitas reducir gastos o aumentar ingresos.",
      },
      {
        title: "Saldo en Caja",
        value: stats.netProfit,
        delta: stats.netProfitDeltaPct ?? 0,
        tone: stats.netProfit >= 0 ? "positive" : "negative",
        compareLabel: "vs. mes anterior",
        explanation: "Flujo de efectivo neto disponible. Diferencia entre lo que entra y lo que sale del negocio.",
        tooltip: "Saldo en Caja = Flujo neto de efectivo (Ingresos - Gastos). Representa el dinero disponible después de todas las operaciones. Un saldo positivo indica liquidez saludable; negativo requiere atención inmediata para evitar problemas de caja.",
      },
      {
        title: "Margen operativo",
        value: profitability?.profitMargin ?? null,
        delta: stats.marginDeltaPct ?? 0,
        tone: "positive",
        compareLabel: "vs. meta anual",
        isPercent: true,
        explanation: "Porcentaje de cada dólar que se convierte en ganancia. Si es 30%, de $100 ganamos $30.",
        tooltip: "Margen operativo = (Utilidad neta ÷ Ingresos brutos) × 100. Mide eficiencia: cuánto ganas por cada peso que ingresa. Un margen saludable suele ser 20-40%. Si es muy bajo, tus gastos son muy altos respecto a tus ingresos.",
      },
      {
        title: "Reembolsos pendientes",
        value: stats.pendingReimbursements ?? null,
        delta: stats.pendingReimbursementsDeltaPct ?? 0,
        tone: "neutral",
        compareLabel: "vs. semana anterior",
        explanation: "Gastos del equipo que la empresa nos debe reembolsar: almuerzos, transporte, software, etc. Pagamos con nuestro dinero y nos lo devuelven.",
        tooltip: "Reembolsos = Dinero que los empleados pagan por cuenta de la empresa y deben ser devueltos. Ejemplo: si pagas $50k de almuerzo para el equipo, la empresa te debe reembolsar esos $50k. Es un pasivo para la empresa.",
        actionHref: "/finance/expenses",
        actionLabel: "Ver gastos",
      },
      {
        title: "Honorarios pagados",
        value: stats.totalHonorariosPaid ?? null,
        delta: stats.totalHonorariosPaidDeltaPct ?? 0,
        tone: "positive",
        compareLabel: "vs. mes anterior",
        explanation: "Pagos realizados a todos los colaboradores por trabajo extraordinario: proyectos especiales, horas extra, servicios adicionales.",
        tooltip: "Honorarios pagados = total de pagos extra realizados a TODOS los colaboradores de la empresa. Se suma cada honorario pagado a cualquier usuario durante el mes.",
      },
    ];

    if (userRole === "EDITOR") {
      return base.slice(0, 4);
    }

    return base;
  }, [profitability?.profitMargin, stats, userRole]);


  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        {userRole === "ADMIN" && (
          <Button variant="outline" asChild>
            <Link href="/finance/receivables">
              <Receipt className="mr-2 h-4 w-4" />
              Cuentas por Cobrar
            </Link>
          </Button>
        )}
        {userRole !== "EDITOR" && (
          <Button variant="outline" asChild>
            <Link href="/finance/expenses">
              <TrendingDown className="mr-2 h-4 w-4" />
              Gastos y Egresos
            </Link>
          </Button>
        )}
        {userRole === "ADMIN" && (
          <Button variant="outline" asChild>
            <Link href="/finance/settlement">
              <Receipt className="mr-2 h-4 w-4" />
              Liquidación Interna
            </Link>
          </Button>
        )}
        <TransactionDialog>
          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva Transacción
          </Button>
        </TransactionDialog>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Filtros estratégicos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ajusta la vista por período, cliente y tipo de servicio para un análisis profundo.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filtros activos
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">Mes actual</SelectItem>
              <SelectItem value="previous_month">Mes pasado</SelectItem>
              <SelectItem value="last_30_days">Últimos 30 días</SelectItem>
              <SelectItem value="last_6_months">Últimos 6 meses</SelectItem>
              <SelectItem value="ytd">Año en curso</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={client} onValueChange={setClient}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clientPlans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={service} onValueChange={setService}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los servicios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los servicios</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="branding">Branding</SelectItem>
              <SelectItem value="production">Producción</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">KPIs financieros clave</h2>
              <p className="text-sm text-muted-foreground">
                Indicadores esenciales con comparativas para decisiones tácticas.
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              Actualización automática
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {kpiCards.map((kpi) => (
              <Card key={kpi.title} className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                    <ExplainedTooltip title={kpi.title} explanation={kpi.explanation} tooltip={kpi.tooltip} />
                  </div>
                  <TrendBadge delta={kpi.delta} tone={kpi.tone} />
                </CardHeader>
                <CardContent className="space-y-2">
                  <KpiValue value={kpi.value} isPercent={kpi.isPercent} />
                  <p className="text-xs text-muted-foreground">{kpi.compareLabel}</p>
                  {kpi.actionHref && kpi.actionLabel && (
                    <Link
                      href={kpi.actionHref}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {kpi.actionLabel}
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Rentabilidad multinivel
              <ExplainedTooltip 
                title="Rentabilidad multinivel" 
                explanation="Te mostramos 3 niveles de ganancia: Directa (lo que cobramos), Ajustada (restando costos directos como producción), y Real (considerando todos los riesgos y gastos ocultos)."
              />
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Comparación entre rentabilidad directa, ajustada y real con supuestos críticos.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              💡 <strong>Para no financieros:</strong> Imagina que cobras $1000. Directa son $1000, pero si gastas $100 en producción, la ajustada son $900. La real considera también tiempo extra, imprevistos y riesgos.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {[
              {
                label: "Directa",
                multiplier: 1,
                helper: "Ingreso recurrente contratado",
              },
              {
                label: "Ajustada",
                multiplier: 0.9,
                helper: "Considera costos directos",
              },
              {
                label: "Real",
                multiplier: 0.78,
                helper: "Impacto real + riesgo",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <Badge variant="outline" className="text-xs">
                    {item.label === "Real" ? "Con riesgo" : ""}
                  </Badge>
                </div>
                <p className="text-xl font-semibold">
                  {formatCurrency(Math.round(totals.totalRate * item.multiplier))}
                </p>
                <p className="text-xs text-muted-foreground">{item.helper}</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>Reels mensuales</span>
                    <span className="font-medium">{totals.totalReels}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Rodajes mensuales</span>
                    <span className="font-medium">{totals.totalShoots}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Proyectado vs cobrado (mensual)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Comparación del ingreso esperado con lo efectivamente cobrado en el mes seleccionado.
            </p>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectedVsCollected} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="proyectado" name="Proyectado" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cobrado" name="Cobrado" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Semáforo financiero</CardTitle>
            <p className="text-sm text-muted-foreground">Alertas tempranas por dimensión crítica.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <TrafficIndicator label="Liquidez" status="warning" />
            <TrafficIndicator label="Rentabilidad" status="good" />
            <TrafficIndicator label="Cartera" status="critical" />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              Tendencias de flujo de caja
              <ExplainedTooltip 
                title="Tendencias de flujo de caja" 
                explanation="Muestra cómo entra y sale dinero cada mes. Los ingresos son lo que cobramos, gastos lo que pagamos, y utilidad lo que nos queda."
              />
            </CardTitle>
            <p className="text-sm text-muted-foreground">Evolución mensual con comparativas históricas.</p>
            <p className="text-xs text-muted-foreground mt-2">
              📈 <strong>Para no financieros:</strong> Como tu cuenta personal: ves cuánto entra (sueldo), cuánto sale (facturas), y cuánto te queda para ahorrar.
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={256}>
              <AreaChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Area type="monotone" dataKey="ingresos" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                <Area type="monotone" dataKey="gastos" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                <Area type="monotone" dataKey="utilidad" stackId="3" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Distribución de costos
              <ExplainedTooltip 
                title="Distribución de costos" 
                explanation="Muestra en qué gastamos el dinero. Producción (videos, fotos), Personal (salarios), Marketing (publicidad), Operación (oficina, software) y Otros."
              />
            </CardTitle>
            <p className="text-sm text-muted-foreground">Mix por categoría y servicio.</p>
            <p className="text-xs text-muted-foreground mt-2">
              💰 <strong>Para no financieros:</strong> Como dividir tus gastos personales: 35% en alquiler, 28% en comida, 18% en transporte, etc. Así vemos dónde se va el dinero.
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={256}>
              <RePieChart>
                <Pie
                  data={costDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {costDistributionData.map((entry: CostDistributionItem, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: number, name: string, props: { payload?: CostDistributionItem }) => {
                    const amount = props.payload?.amount ?? 0;
                    return [`${value}% (${formatCurrency(amount)})`, name];
                  }} 
                />
              </RePieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {financeSettingsMetrics ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Control de cupos y consumo interno</h2>
            <p className="text-sm text-muted-foreground">
              El reembolso oficial sigue la lógica empresarial. Estos bloques controlan consumo interno y presupuesto administrativo.
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Cupo global mensual</CardTitle>
                <p className="text-sm text-muted-foreground">Límite no honorarios calculado sobre los ingresos del mes y categorías configuradas.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Base ingresos</p>
                    <p className="text-xl font-semibold">{formatCurrency(financeSettingsMetrics.overview.baseIncome)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Consumido</p>
                    <p className="text-xl font-semibold">{formatCurrency(financeSettingsMetrics.overview.trackedExpenses)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Disponible</p>
                    <p className="text-xl font-semibold">{formatCurrency(financeSettingsMetrics.overview.globalBudgetRemaining)}</p>
                  </div>
                </div>
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Tope global</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(financeSettingsMetrics.overview.globalBudgetLimit)}</p>
                    </div>
                    <Badge className={budgetStatusClassName(financeSettingsMetrics.overview.globalBudgetStatus)}>
                      {budgetStatusLabel(financeSettingsMetrics.overview.globalBudgetStatus)}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Uso del cupo</span>
                      <span>{formatPercent(financeSettingsMetrics.overview.globalBudgetUsagePercent)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-2 rounded-full transition-all",
                          financeSettingsMetrics.overview.globalBudgetStatus === "normal"
                            ? "bg-emerald-500"
                            : financeSettingsMetrics.overview.globalBudgetStatus === "warning"
                              ? "bg-amber-500"
                              : "bg-red-500"
                        )}
                        style={{ width: `${Math.min(financeSettingsMetrics.overview.globalBudgetUsagePercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cupo por ADMIN</CardTitle>
                <p className="text-sm text-muted-foreground">Consumo interno atribuido por split para cada ADMIN.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {financeSettingsMetrics.adminBudgets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay usuarios ADMIN para evaluar.</p>
                ) : (
                  financeSettingsMetrics.adminBudgets.map((budget: DashboardAdminBudget) => (
                    <div key={budget.userId} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{budget.userName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(budget.consumedAmount)} de {formatCurrency(budget.limitAmount)}
                          </p>
                        </div>
                        <Badge className={budgetStatusClassName(budget.status)}>{budgetStatusLabel(budget.status)}</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Disponible</span>
                          <span>{formatCurrency(budget.remainingAmount)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-2 rounded-full transition-all",
                              budget.status === "normal"
                                ? "bg-emerald-500"
                                : budget.status === "warning"
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                            )}
                            style={{ width: `${Math.min(budget.usagePercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {financeSettingsMetrics.personalAnalytics.enabled ? (
            <Card>
              <CardHeader>
                <CardTitle>Analítica personal entre usuarios</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Solo referencia interna. No afecta reembolsos, nómina ni contabilidad oficial de Totem.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Pagado</TableHead>
                        <TableHead>Consumido</TableHead>
                        <TableHead>Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {financeSettingsMetrics.personalAnalytics.summaries.map((summary: DashboardAnalyticsSummary) => (
                        <TableRow key={`analytics-${summary.userId}`}>
                          <TableCell className="font-medium">{summary.userName}</TableCell>
                          <TableCell>{formatCurrency(summary.paidAmount)}</TableCell>
                          <TableCell>{formatCurrency(summary.consumedAmount)}</TableCell>
                          <TableCell className={summary.balance >= 0 ? "text-emerald-600" : "text-rose-600"}>
                            {formatCurrency(summary.balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Esta vista es solo analítica privada para orientar ajustes personales entre el equipo. La empresa sigue reembolsando según quién pagó.
                  </div>
                  <Card className="shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">Transferencias sugeridas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {financeSettingsMetrics.personalAnalytics.suggestedTransfers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay cruces sugeridos para este período.</p>
                      ) : (
                        financeSettingsMetrics.personalAnalytics.suggestedTransfers.map((transfer: DashboardAnalyticsTransfer, index: number) => (
                          <div key={`transfer-${transfer.fromUserId}-${transfer.toUserId}-${index}`} className="rounded-lg border p-3 text-sm">
                            <p className="font-medium">{transfer.fromUserName} → {transfer.toUserName}</p>
                            <p className="text-muted-foreground">{formatCurrency(transfer.amount)}</p>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Comparación por cliente</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ranking de ingresos, margen y riesgos con foco en cuentas clave.
            </p>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <div className="h-64 rounded-lg border border-dashed border-border/60 bg-muted/20 p-4">
                <Skeleton className="h-full w-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={clientComparisonData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
                  <RechartsTooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Bar dataKey="ingresos" fill="#10b981" />
                  <Bar dataKey="margen" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mapa de calor operativo</CardTitle>
            <p className="text-sm text-muted-foreground">Patrones de costos por semana y servicio.</p>
          </CardHeader>
          <CardContent>
            {!heatmapGrid.grid || heatmapGrid.grid.length === 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 28 }).map((_, index) => (
                    <div
                      key={`heat-skeleton-${index}`}
                      className="h-8 rounded-md bg-muted/30"
                    />
                  ))}
                </div>
                <p className="text-xs text-center text-muted-foreground mt-4">
                  No hay datos de gastos este mes
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {heatmapGrid.categories.map((category: string) => {
                    const safeCategory = String(category);
                    const totalAmount = heatmapGrid.grid
                      .filter((cell: HeatmapGridCell) => cell.category === safeCategory)
                      .reduce((sum: number, cell: HeatmapGridCell) => sum + cell.amount, 0);
                    const totalCount = heatmapGrid.grid
                      .filter((cell: HeatmapGridCell) => cell.category === safeCategory)
                      .reduce((sum: number, cell: HeatmapGridCell) => sum + cell.count, 0);

                    return (
                      <div key={safeCategory} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{safeCategory}</p>
                          <Badge variant="outline">{totalCount} mov.</Badge>
                        </div>
                        <p className="mt-2 text-lg font-semibold">{formatCurrency(totalAmount)}</p>
                        <p className="text-xs text-muted-foreground">Concentración acumulada del mes por categoría.</p>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {[1, 2, 3, 4].map((week: number) => {
                    const weekAmount = heatmapGrid.grid
                      .filter((cell: HeatmapGridCell) => cell.week === week)
                      .reduce((sum: number, cell: HeatmapGridCell) => sum + cell.amount, 0);

                    return (
                      <div key={`week-summary-${week}`} className="rounded-lg border p-3 text-center">
                        <p className="text-xs text-muted-foreground">Semana {week}</p>
                        <p className="text-sm font-semibold">{formatCurrency(weekAmount)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>Bajo</span>
              <span>Alto</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Detalle transaccional y rentabilidad</CardTitle>
            <p className="text-sm text-muted-foreground">
              Datos completos con scroll virtual y exportación por segmento.
            </p>
          </CardHeader>
          <CardContent>
            {selectedPlans.length === 0 ? (
              <div className="h-48 rounded-lg border border-dashed border-border/60 bg-muted/20 p-4">
                <Skeleton className="h-full w-full" />
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tarifa mensual</TableHead>
                      <TableHead>Reels</TableHead>
                      <TableHead>Rodajes</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPlans.map((plan: DashboardClientPlan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">{plan.name}</TableCell>
                        <TableCell>{formatCurrency((plan["monthlyRate"] as number | undefined) ?? 0)}</TableCell>
                        <TableCell>{(plan["monthlyReels"] as number | undefined) ?? 0}</TableCell>
                        <TableCell>{(plan["monthlyShoots"] as number | undefined) ?? 0}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{plan.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Alertas y oportunidades</CardTitle>
            <p className="text-sm text-muted-foreground">
              Insights automáticos para proteger margen y caja.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                title: "Riesgo de desbalance de caja",
                tone: "bg-rose-50 text-rose-700",
                detail: "El runway bajó a 18 días. Ajustar cobros prioritarios.",
              },
              {
                title: "Oportunidad de optimización",
                tone: "bg-amber-50 text-amber-700",
                detail: "Producción audiovisual concentra 42% del gasto. Revisar contratos.",
              },
              {
                title: "Cliente con alto margen",
                tone: "bg-emerald-50 text-emerald-700",
                detail: "La cuenta " +
                  "Nimbus" +
                  " supera el 35% de margen. Mantener foco comercial.",
              },
            ].map((alert) => (
              <div key={alert.title} className="rounded-lg border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{alert.title}</p>
                  <Badge className={cn("text-xs", alert.tone)}>Activo</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{alert.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Proyecciones financieras y escenarios
              <ExplainedTooltip 
                title="Proyecciones por escenario" 
                explanation="Conservador: Si las cosas van mal (pérdida de clientes, baja demanda). Base: Si todo continúa como ahora. Agresivo: Si todo va perfecto (nuevos clientes, más ventas)."
              />
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Simulación de ingresos y costos con supuestos ajustables.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              🎯 <strong>Para no financieros:</strong> Esto es como predecir el futuro del negocio. El conservador es el plan B, el base es lo más probable, y el agresivo es el sueño cumplido.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {projectionsData.map((scenario) => (
              <div key={scenario.name} className="rounded-lg border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{scenario.name}</p>
                  <Badge variant="outline" className="text-xs">
                    {scenario.badge}
                  </Badge>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="group relative flex items-center justify-between text-xs w-full">
                    <span>Ingresos proyectados</span>
                    <span className="font-medium">{formatCurrency(scenario.ingresos)}</span>
                    <div className="absolute bottom-full left-1/2 mb-2 hidden w-64 -translate-x-1/2 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-lg group-hover:block z-50">
                      <div className="font-semibold mb-1">Ingresos proyectados</div>
                      <div>Ingresos que esperamos generar en los próximos 3 meses según este escenario. Incluye facturas actuales y contratos esperados.</div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-popover"></div>
                    </div>
                  </div>
                  <div className="group relative flex items-center justify-between text-xs w-full">
                    <span>Margen esperado</span>
                    <span className="font-medium">{formatPercent(scenario.margen)}</span>
                    <div className="absolute bottom-full left-1/2 mb-2 hidden w-64 -translate-x-1/2 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-lg group-hover:block z-50">
                      <div className="font-semibold mb-1">Margen esperado</div>
                      <div>Porcentaje de ganancia esperada. Un margen del 25% significa que de cada $100 de ingresos, $25 serán ganancia neta después de todos los gastos.</div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-popover"></div>
                    </div>
                  </div>
                  <div className="group relative flex items-center justify-between text-xs w-full">
                    <span>Liquidez (Runway)</span>
                    <span className="font-medium">{scenario.liquidez} días</span>
                    <div className="absolute bottom-full left-1/2 mb-2 hidden w-64 -translate-x-1/2 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-lg group-hover:block z-50">
                      <div className="font-semibold mb-1">Liquidez (Runway)</div>
                      <div>Días que la empresa puede operar con el efectivo actual. Si es 45 días, puedes mantener el negocio funcionando por 45 días sin recibir más ingresos.</div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-popover"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Resumen ejecutivo</CardTitle>
            <p className="text-sm text-muted-foreground">Conclusiones rápidas para dirección.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/60 p-4">
              <p className="text-sm font-semibold">Liquidez</p>
              <p className="text-xs text-muted-foreground mt-2">
                Se recomienda priorizar cobros en los próximos 14 días y renegociar los pagos con mayor impacto.
              </p>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <p className="text-sm font-semibold">Rentabilidad</p>
              <p className="text-xs text-muted-foreground mt-2">
                Ajustar tarifas en servicios de baja rentabilidad y potenciar cuentas con margen superior al 30%.
              </p>
            </div>
            <Button variant="outline" className="w-full gap-2">
              <Wallet className="h-4 w-4" />
              Generar informe ejecutivo
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* AI Insights Section */}
      <SimpleAIInsights
        stats={stats}
        profitability={profitability ? { profitMargin: profitability.profitMargin ?? null } : null}
        clientPlans={clientPlans.map((plan: DashboardClientPlan) => ({
          id: plan.id,
          name: plan.name,
          status: plan.status,
          monthlyRate: (plan["monthlyRate"] as number | undefined) ?? 0,
          monthlyReels: (plan["monthlyReels"] as number | undefined) ?? 0,
          monthlyShoots: (plan["monthlyShoots"] as number | undefined) ?? 0,
        }))}
      />
    </div>
  );
}
