"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Filter,
  LineChart,
  PieChart,
  TrendingDown,
  TrendingUp,
  Wallet,
  Info,
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import type { FinancialStats, GlobalProfitabilityStats, StrategicClientPlan } from "@/actions/finance-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SimpleAIInsights } from "@/components/features/finance/ai-insights-simple";
import { FinanceSectionNav } from "@/components/features/finance/finance-section-nav";
import { cn } from "@/lib/utils";

interface StrategicFinanceDashboardProps {
  stats: FinancialStats;
  profitability?: GlobalProfitabilityStats | null;
  clientPlans: StrategicClientPlan[];
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

  const selectedPlans = useMemo(() => {
    if (client === "all") return clientPlans;
    return clientPlans.filter((plan) => plan.id === client);
  }, [client, clientPlans]);

  const totals = useMemo(() => {
    return selectedPlans.reduce(
      (acc, plan) => {
        acc.totalRate += plan.monthlyRate;
        acc.totalReels += plan.monthlyReels;
        acc.totalShoots += plan.monthlyShoots;
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

  const topClients = useMemo(() => {
    return [...selectedPlans]
      .sort((a, b) => b.monthlyRate - a.monthlyRate)
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
  const heatmapGrid = useMemo(() => {
    if (!stats.heatmapData || stats.heatmapData.length === 0) {
      return { grid: [], categories: [], maxAmount: 0 };
    }

    // Obtener todas las categorías únicas
    const categories = Array.from(new Set(stats.heatmapData.map((d) => d.category))).sort();
    
    // Calcular el monto máximo para normalizar los colores
    const maxAmount = Math.max(...stats.heatmapData.map((d) => d.amount), 1);

    // Crear grid de 4 semanas x N categorías
    const grid = [];
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

  const costDistributionData = useMemo(() => {
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
      ];
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

  const clientComparisonData = useMemo(() => {
    return topClients.map((plan, index) => ({
      name: plan.name,
      ingresos: plan.monthlyRate,
      reels: plan.monthlyReels,
      rodajes: plan.monthlyShoots,
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
      <FinanceSectionNav userRole={userRole} />

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
                  {costDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: number, name: string, props: any) => {
                    const amount = props.payload.amount || 0;
                    return [`${value}% (${formatCurrency(amount)})`, name];
                  }} 
                />
              </RePieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

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
                  <RechartsTooltip 
                    formatter={(value: number, name: string) => {
                      if (name === 'ingresos') return formatCurrency(value);
                      return value;
                    }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
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
              <TooltipProvider>
                <div className="space-y-3">
                  {/* Encabezados de categorías */}
                  <div className="flex gap-2 items-center text-xs font-medium text-muted-foreground">
                    <div className="w-16 text-right">Semana</div>
                    <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${heatmapGrid.categories.length}, 1fr)` }}>
                      {heatmapGrid.categories.map((cat) => (
                        <div key={cat} className="text-center truncate" title={cat}>
                          {cat}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Grid de celdas */}
                  {[1, 2, 3, 4].map((week) => (
                    <div key={`week-${week}`} className="flex gap-2 items-center">
                      <div className="w-16 text-right text-xs font-medium text-muted-foreground">
                        S{week}
                      </div>
                      <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${heatmapGrid.categories.length}, 1fr)` }}>
                        {heatmapGrid.categories.map((category) => {
                          const cell = heatmapGrid.grid.find(
                            (c) => c.week === week && c.category === category
                          );
                          const intensity = cell?.intensity || 0;
                          const amount = cell?.amount || 0;
                          const count = cell?.count || 0;

                          return (
                            <Tooltip key={`${week}-${category}`}>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "h-10 rounded-md transition-all cursor-help",
                                    amount === 0
                                      ? "bg-muted/20 border border-dashed border-muted-foreground/20"
                                      : "bg-gradient-to-br from-emerald-400 to-emerald-600"
                                  )}
                                  style={{
                                    opacity: amount === 0 ? 0.3 : 0.4 + intensity * 0.6,
                                  }}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p className="font-semibold">{category}</p>
                                  <p className="text-xs">Semana {week}</p>
                                  <p className="text-xs font-mono">
                                    {formatCurrency(amount)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {count} transacción{count !== 1 ? 'es' : ''}
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </TooltipProvider>
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
                    {selectedPlans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">{plan.name}</TableCell>
                        <TableCell>{formatCurrency(plan.monthlyRate)}</TableCell>
                        <TableCell>{plan.monthlyReels}</TableCell>
                        <TableCell>{plan.monthlyShoots}</TableCell>
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
        profitability={profitability}
        clientPlans={clientPlans}
      />
    </div>
  );
}
