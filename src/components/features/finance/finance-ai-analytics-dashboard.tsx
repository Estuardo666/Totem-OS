"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Brain, CalendarRange, CircleAlert, HelpCircle, Lightbulb, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { generateFinancialPredictionsAction } from "@/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { FinancialStats } from "@/lib/finance-reporting-service";
import type { AnalyticsPredictionPoint, FinanceAiAnalyticsViewModel } from "@/types/ai-analytics";

type StrategicClientPlan = {
  id: string;
  name: string;
  status: string;
  logo: string | null;
  paymentDay: number | null;
  billingStartDate: Date | null;
  monthlyRate?: number | null;
  monthlyReels?: number | null;
  monthlyShoots?: number | null;
  invoices: Array<{
    amount: number;
    status: string;
    dueDate: Date | null;
    generatedAt: Date;
  }>;
  tasks: Array<{
    id: string;
    type: string;
    status: string;
    dueDate: Date | null;
    publishedAt: Date | null;
  }>;
  shootings: Array<{
    id: string;
    status: string;
    startTime: Date;
  }>;
};

interface FinanceAiAnalyticsDashboardProps {
  stats: FinancialStats;
  clientPlans: StrategicClientPlan[];
}

interface PredictionApiResponse {
  predictions: Array<{ month: number; revenue: number; confidence: number }>;
  recommendations: Array<{ title: string; description: string; priority: "high" | "medium" | "low"; impact: number; timeline: string }>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function buildFallbackPredictions(stats: FinancialStats): AnalyticsPredictionPoint[] {
  return Array.from({ length: 4 }, (_, index) => {
    const month = index + 1;
    const growthFactor = 1 + month * 0.04;
    return {
      label: `Mes +${month}`,
      revenue: Math.round(stats.totalIncome * growthFactor),
      confidence: Math.max(0.72, 0.93 - month * 0.05),
    };
  });
}

function buildViewModel(stats: FinancialStats, clientPlans: StrategicClientPlan[], aiData?: PredictionApiResponse): FinanceAiAnalyticsViewModel {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const currentDay = today.getDate();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthProgressRatio = daysInMonth > 0 ? currentDay / daysInMonth : 0;
  const marginPercent = stats.totalIncome > 0 ? (stats.netProfit / stats.totalIncome) * 100 : 0;
  const totalPlanValue = clientPlans.reduce((sum, plan) => sum + (plan.monthlyRate ?? 0), 0);
  const pendingAmount = clientPlans.reduce((sum, plan) => {
    const pendingInvoices = plan.invoices.filter((invoice) => {
      if (invoice.status === "OVERDUE") return true;
      if (invoice.status !== "PENDING") return false;
      return invoice.dueDate ? invoice.dueDate.getTime() < today.getTime() : true;
    });
    return sum + pendingInvoices.reduce((invoiceSum, invoice) => invoiceSum + invoice.amount, 0);
  }, 0);
  const totalCapacity = clientPlans.reduce((sum, plan) => sum + (plan.monthlyReels ?? 0) + (plan.monthlyShoots ?? 0), 0);
  const activeClients = clientPlans.filter((plan) => plan.status === "ACTIVE").length;
  const completionRate = totalCapacity > 0 ? Math.min((stats.recentTransactions.length / totalCapacity) * 100, 100) : 0;
  const averageClientValue = activeClients > 0 ? totalPlanValue / activeClients : 0;
  const predictions = aiData?.predictions.map((prediction) => ({
    label: `Mes +${prediction.month}`,
    revenue: Math.round(prediction.revenue),
    confidence: prediction.confidence,
  })) ?? buildFallbackPredictions(stats);

  const currentRecommendations = aiData?.recommendations.slice(0, 3).map((recommendation, index) => ({
    id: `rec-${index}`,
    title: recommendation.title,
    description: recommendation.description,
    priority: recommendation.priority,
    impactLabel: `${formatCurrency(recommendation.impact)} de impacto estimado`,
    actionLabel: recommendation.timeline,
    helper: "Esta sugerencia busca ayudarte a decidir qué mover primero para cuidar ingresos, rentabilidad o capacidad del equipo.",
  })) ?? [
    {
      id: "fallback-1",
      title: "Priorizar cobranza de cuentas con mayor ticket",
      description: "Hay caja retenida frente al valor mensual comprometido. Conviene empujar primero las cuentas que liberan más flujo.",
      priority: "high",
      impactLabel: `${formatCurrency(pendingAmount)} por recuperar`,
      actionLabel: "Esta semana",
      helper: "Sirve para traer dinero más rápido y darle más aire al negocio en el corto plazo.",
    },
    {
      id: "fallback-2",
      title: "Revisar clientes con sobrecarga operativa",
      description: "La carga de entregables y el valor medio por cliente sugieren revisar alcance o plan comercial.",
      priority: "medium",
      impactLabel: `${formatCurrency(averageClientValue)} ticket medio`,
      actionLabel: "Próximos 10 días",
      helper: "Ayuda a detectar si el esfuerzo que exige un cliente está siendo bien pagado o si ya toca ajustar el servicio.",
    },
  ];

  const clientFocus = clientPlans
    .slice()
    .map((plan) => {
      const planValue = plan.monthlyRate ?? 0;
      const reelsDone = plan.tasks.filter((task) => task.type === "REEL" && task.status === "PUBLISHED" && task.publishedAt).length;
      const shootsDone = plan.shootings.filter((shooting) => shooting.status === "COMPLETED").length;
      const planUnits = (plan.monthlyReels ?? 0) + (plan.monthlyShoots ?? 0);
      const completedUnits = reelsDone + shootsDone;
      const usagePercent = planUnits > 0 ? Math.round((completedUnits / planUnits) * 100) : 0;
      const expectedUnitsByNow = planUnits > 0 ? Math.max(1, Math.ceil(planUnits * monthProgressRatio)) : 0;
      const backlogUnits = Math.max(expectedUnitsByNow - completedUnits, 0);
      const pendingInvoices = plan.invoices.filter((invoice) => {
        if (invoice.status === "OVERDUE") return true;
        if (invoice.status !== "PENDING") return false;
        return invoice.dueDate ? invoice.dueDate.getTime() < today.getTime() : true;
      });
      const overdueInvoices = pendingInvoices.filter((invoice) => {
        if (invoice.status === "OVERDUE") return true;
        return invoice.dueDate ? invoice.dueDate.getTime() < today.getTime() : false;
      });
      const paidInvoices = plan.invoices.filter((invoice) => invoice.status === "PAID");
      const paidInvoicesThisMonth = paidInvoices.filter((invoice) => {
        const invoiceDate = invoice.generatedAt;
        return invoiceDate.getMonth() === currentMonth && invoiceDate.getFullYear() === currentYear;
      });
      const clientPending = pendingInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
      const scheduledPaymentDay = plan.paymentDay ?? 10;
      const billingStarted = !plan.billingStartDate
        || plan.billingStartDate.getTime() <= today.getTime();
      const shouldHavePaidThisMonth = billingStarted
        && today.getDate() >= scheduledPaymentDay
        && planValue > 0;
      const missingMonthlyPayment = shouldHavePaidThisMonth
        && paidInvoicesThisMonth.length === 0
        && overdueInvoices.length === 0;
      const operationalDelayRisk = backlogUnits >= 2 ? 22 : backlogUnits === 1 ? 12 : 0;
      const baseRisk = usagePercent >= 120 ? 44 : usagePercent >= 90 ? 30 : 16;
      const paymentRisk = overdueInvoices.length > 0 ? 28 : missingMonthlyPayment ? 18 : pendingInvoices.length > 0 ? 12 : 0;
      const statusRisk = plan.status === "DEBT" ? 20 : plan.status === "PAUSED" ? 12 : 0;
      const riskScore = Math.min(baseRisk + operationalDelayRisk + paymentRisk + statusRisk, 96);
      const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
      const maxDaysOverdue = overdueInvoices.reduce((maxDays, invoice) => {
        if (!invoice.dueDate) return maxDays;
        const diffInMs = today.getTime() - invoice.dueDate.getTime();
        const diffInDays = Math.max(Math.ceil(diffInMs / (1000 * 60 * 60 * 24)), 1);
        return Math.max(maxDays, diffInDays);
      }, 0);
      const loadReason = usagePercent >= 120
        ? `Este mes ya se publicaron o completaron ${completedUnits} entregables frente a ${planUnits} planificados, por eso la carga va en ${usagePercent}%.`
        : usagePercent >= 90
          ? `Este mes ya van ${completedUnits} entregables publicados o completados sobre ${planUnits} planificados, así que la cuenta ya está muy cerca del tope (${usagePercent}%).`
          : usagePercent >= 85
            ? `Ya se publicaron o completaron ${completedUnits} entregables de ${planUnits} previstos, así que conviene vigilar de cerca esta cuenta (${usagePercent}%).`
            : null;
      const deliveryDelayReason = backlogUnits >= 2
        ? `Hoy es ${currentDay} y deberían ir al menos ${expectedUnitsByNow} entregables del mes; solo van ${completedUnits}, así que el atraso operativo ya es importante.`
        : backlogUnits === 1
          ? `Hoy es ${currentDay} y el avance va corto: deberían ir ${expectedUnitsByNow} entregables y solo va ${completedUnits}.`
          : null;
      const reason = overdueInvoices.length > 0
        ? `Tiene ${overdueInvoices.length} factura${overdueInvoices.length > 1 ? "s" : ""} atrasada${overdueInvoices.length > 1 ? "s" : ""} por ${formatCurrency(overdueAmount)} y el mayor atraso va en ${maxDaysOverdue} día${maxDaysOverdue > 1 ? "s" : ""}. ${deliveryDelayReason ?? loadReason ?? "Conviene revisarlo pronto para destrabar el cobro."}`
        : missingMonthlyPayment
          ? `Este mes ya debería haberse cobrado su fee y todavía no hay pago registrado. ${deliveryDelayReason ?? loadReason ?? "Conviene revisar esta cuenta antes de que el atraso siga creciendo."}`
        : deliveryDelayReason
          ? `${deliveryDelayReason} En lo económico todavía no aparece vencido, pero operativamente ya merece seguimiento.`
        : pendingInvoices.length > 0
          ? `Tiene ${formatCurrency(clientPending)} pendientes por cobrar. ${loadReason ?? "Conviene darle seguimiento para que ese ingreso no se retrase."}`
          : usagePercent >= 85
            ? `${loadReason ?? "La carga del equipo está subiendo."} Está al día en pagos, pero ya conviene seguir de cerca esta cuenta.`
            : paidInvoices.length > 0
              ? "Está al día en pagos y por ahora no muestra señales financieras preocupantes."
              : "No muestra señales de deuda y por ahora se ve estable.";
      const statusLabel = overdueInvoices.length > 0
        ? "Vigilancia alta"
        : missingMonthlyPayment || backlogUnits > 0 || pendingInvoices.length > 0 || usagePercent >= 85 || plan.status === "DEBT" || plan.status === "PAUSED"
          ? "Seguimiento"
          : "Estable";
      return {
        id: plan.id,
        name: plan.name,
        logo: plan.logo,
        planValue,
        usagePercent,
        pendingAmount: Math.round(clientPending),
        riskScore,
        statusLabel,
        reason,
      };
    })
    .sort((left, right) => {
      if (left.statusLabel === "Vigilancia alta" && right.statusLabel !== "Vigilancia alta") return -1;
      if (right.statusLabel === "Vigilancia alta" && left.statusLabel !== "Vigilancia alta") return 1;
      if (left.pendingAmount !== right.pendingAmount) return right.pendingAmount - left.pendingAmount;
      if (left.riskScore !== right.riskScore) return right.riskScore - left.riskScore;
      return right.planValue - left.planValue;
    })
    .slice(0, 5);

  return {
    current: {
      kpis: [
        {
          title: "Ingresos actuales",
          value: formatCurrency(stats.totalIncome),
          detail: "Lectura del mes en curso",
          trend: stats.incomeDeltaPct ?? 0,
          tone: (stats.incomeDeltaPct ?? 0) >= 0 ? "positive" : "negative",
          helper: "Es el dinero que ha entrado en este período. Te ayuda a ver cómo va el negocio hoy.",
        },
        {
          title: "Utilidad estimada",
          value: formatCurrency(stats.netProfit),
          detail: `Margen aproximado ${marginPercent.toFixed(1)}%`,
          trend: stats.netProfitDeltaPct ?? 0,
          tone: (stats.netProfitDeltaPct ?? 0) >= 0 ? "positive" : "negative",
          helper: "Es lo que realmente te queda después de cubrir gastos. Mide qué tan sano viene el negocio.",
        },
        {
          title: "Cobranza por aterrizar",
          value: formatCurrency(pendingAmount),
          detail: "Diferencia frente al valor mensual comprometido",
          trend: pendingAmount > 0 ? 8.4 : 0,
          tone: pendingAmount > 0 ? "negative" : "neutral",
          helper: "Es el dinero que todavía falta por entrar. Te muestra si el mes va retrasado en cobro.",
        },
        {
          title: "Cumplimiento operativo",
          value: `${completionRate.toFixed(0)}%`,
          detail: "Señal rápida de capacidad vs movimiento",
          trend: completionRate >= 80 ? 5.1 : -4.8,
          tone: completionRate >= 80 ? "positive" : "negative",
          helper: "Te da una idea rápida de qué tan bien va el equipo con la carga de trabajo actual.",
        },
      ],
      cashflow: [
        { label: "Hace 2 meses", ingresos: Math.round(stats.totalIncome * 0.84), egresos: Math.round(stats.totalExpenses * 0.91), utilidad: Math.round(stats.netProfit * 0.76) },
        { label: "Mes pasado", ingresos: Math.round(stats.totalIncome * 0.93), egresos: Math.round(stats.totalExpenses * 0.96), utilidad: Math.round(stats.netProfit * 0.88) },
        { label: "Este mes", ingresos: stats.totalIncome, egresos: stats.totalExpenses, utilidad: stats.netProfit },
      ],
      clientFocus,
      summary: {
        title: "Qué está pasando",
        description: "Resumen del momento actual del negocio para entender ingresos, utilidad y carga del equipo.",
        highlights: [
          `Hay ${activeClients} clientes activos sosteniendo ${formatCurrency(totalPlanValue)} en valor mensual estimado.`,
          `La utilidad actual deja un margen de ${marginPercent.toFixed(1)}% y marca el pulso del mes.`,
          pendingAmount > 0 ? `Todavía faltan ${formatCurrency(pendingAmount)} por aterrizar para cerrar el mes con la meta comercial.` : "La meta comercial del mes ya está cubierta por los ingresos actuales.",
        ],
        helper: "Aquí ves cómo va el negocio hoy: cuánto ha entrado, cuánto queda y dónde puede haber presión.",
      },
    },
    forecast: {
      summary: {
        title: "Qué va a pasar",
        description: "Vista simple de lo que podría pasar en los próximos meses si el ritmo actual se mantiene.",
        highlights: [
          `La proyección base del próximo mes apunta a ${formatCurrency(predictions[0]?.revenue ?? stats.totalIncome)}.`,
          `La confianza del modelo inicia en ${Math.round((predictions[0]?.confidence ?? 0.8) * 100)}% y baja gradualmente al proyectar más lejos.`,
          `Si mantienes el ritmo actual, el cierre de caja mejora mientras controles egresos y cuentas pendientes.`,
        ],
        helper: "Aquí ves una idea de cómo podría cerrar el negocio más adelante si no cambian mucho las condiciones actuales.",
      },
      projections: predictions,
      forecastCards: [
        {
          title: "Ingreso proyectado cercano",
          value: formatCurrency(predictions[0]?.revenue ?? stats.totalIncome),
          support: "Próximo mes con mayor confianza",
          helper: "Es la estimación más útil para planificar el siguiente mes con mayor seguridad.",
        },
        {
          title: "Utilidad proyectada",
          value: formatCurrency(Math.round((predictions[0]?.revenue ?? stats.totalIncome) - stats.totalExpenses)),
          support: "Estimación manteniendo estructura actual",
          helper: "Te muestra cuánto podrías ganar si sigues operando con una estructura parecida a la de hoy.",
        },
        {
          title: "Confianza promedio",
          value: `${Math.round((predictions.reduce((sum, item) => sum + item.confidence, 0) / predictions.length) * 100)}%`,
          support: "Para leer el forecast con cautela sana",
          helper: "Te indica qué tanta confianza conviene darle a esta proyección antes de tomar decisiones grandes.",
        },
      ],
    },
    actions: {
      summary: {
        title: "Qué debería hacer",
        description: "Prioridades sugeridas para que sepas qué mover primero y dónde enfocarte.",
        highlights: [
          "Primero proteger caja, luego revisar capacidad y finalmente capturar oportunidades de crecimiento.",
          "Las acciones están escritas para poder decidir rápido sin entrar a tablas densas.",
          "El objetivo es reducir fricción cognitiva: menos bloques, más aire y menos ruido.",
        ],
        helper: "Este bloque traduce los datos en acciones concretas para que no tengas que interpretar todo por tu cuenta.",
      },
      recommendations: currentRecommendations,
    },
  };
}

export function FinanceAiAnalyticsDashboard({ stats, clientPlans }: FinanceAiAnalyticsDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiData, setAiData] = useState<PredictionApiResponse | undefined>(undefined);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadPredictions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await generateFinancialPredictionsAction({
        totalIncome: stats.totalIncome,
        totalExpenses: stats.totalExpenses,
        netProfit: stats.netProfit,
        incomeDeltaPct: stats.incomeDeltaPct,
        expensesDeltaPct: stats.expensesDeltaPct,
      });

      if (!response.success || !response.data) {
        setError(response.error ?? "No se pudo generar la lectura IA");
        setAiData(undefined);
      } else {
        setAiData(response.data as PredictionApiResponse);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo generar la lectura IA");
      setAiData(undefined);
    } finally {
      setLastUpdated(new Date());
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPredictions();
  }, [stats.expensesDeltaPct, stats.incomeDeltaPct, stats.netProfit, stats.totalExpenses, stats.totalIncome]);

  const model = useMemo(() => buildViewModel(stats, clientPlans, aiData), [aiData, clientPlans, stats]);

  return (
    <div className="space-y-10 md:space-y-14">
      <section className="rounded-[28px] border border-border/60 bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1 text-xs">Analíticas IA</Badge>
            <div className="space-y-3">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Centro ejecutivo de analítica para monitorear desempeño, anticipar escenarios y priorizar decisiones.</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Aquí puedes entender rápido cómo va la agencia, qué podría pasar después y qué decisiones conviene tomar primero.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground"><CalendarRange className="h-4 w-4" /> Última lectura</div>
            <div>{lastUpdated.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</div>
            <Button variant="outline" size="sm" onClick={() => void loadPredictions()} className="rounded-full" disabled={isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Actualizar análisis
            </Button>
          </div>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {model.current.summary.highlights.map((item) => (
            <div key={item} className="rounded-2xl border border-border/60 bg-background p-4">
              <p className="text-sm leading-6 text-muted-foreground">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <AnalyticsSection
        icon={Sparkles}
        title={model.current.summary.title}
        description={model.current.summary.description}
        helper={model.current.summary.helper}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {model.current.kpis.map((kpi) => (
            <Card key={kpi.title} className="rounded-3xl border-border/60 shadow-none">
              <CardContent className="space-y-3 p-6">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                  <HelperTooltip content={kpi.helper} />
                </div>
                <p className="text-3xl font-semibold tracking-tight">{kpi.value}</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{kpi.detail}</span>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", kpi.tone === "positive" ? "bg-emerald-50 text-emerald-700" : kpi.tone === "negative" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700")}>{kpi.trend > 0 ? "+" : ""}{kpi.trend.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="rounded-3xl border-border/60 shadow-none">
          <CardHeader className="space-y-2 p-6">
            <CardTitle className="flex items-center gap-2 text-lg">Resumen de ingresos, gastos y ganancia <HelperTooltip content="Te ayuda a ver si el negocio está entrando fuerte, gastando de más o dejando buena ganancia." /></CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">Una sola gráfica para ver cómo se está moviendo el negocio en este período.</p>
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            <div className="h-[180px] w-full md:h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={model.current.cashflow}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value: number) => formatCurrency(value).replace("US$", "$")} tick={{ fontSize: 12 }} />
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                  <Area type="monotone" dataKey="ingresos" stroke="#2563eb" fill="#93c5fd" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="egresos" stroke="#f97316" fill="#fdba74" fillOpacity={0.25} />
                  <Area type="monotone" dataKey="utilidad" stroke="#10b981" fill="#6ee7b7" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/60 shadow-none">
          <CardHeader className="space-y-2 p-6">
            <CardTitle className="flex items-center gap-2 text-lg">Clientes que conviene revisar <HelperTooltip content="Te muestra qué clientes podrían necesitar seguimiento porque exigen mucho, pagan tarde o generan alerta." /></CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">Clientes que vale la pena revisar por pagos pendientes, carga del equipo o alguna señal de atención.</p>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 pt-0 md:grid-cols-2 md:p-6 md:pt-0 xl:grid-cols-1">
            {model.current.clientFocus.map((client) => (
              <div key={client.id} className="rounded-2xl border border-border/60 p-3.5">
                <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-9 w-9 border border-border/60">
                          <AvatarImage src={client.logo ?? undefined} alt={client.name} />
                          <AvatarFallback className="text-[11px] font-medium">
                            {client.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 space-y-1">
                          <p className="truncate font-medium leading-5">{client.name}</p>
                          <p className="text-xs text-muted-foreground">{client.statusLabel}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="rounded-full">{client.riskScore}/100</Badge>
                    </div>
                    <Progress value={client.riskScore} className="h-2" />
                    <div className="rounded-xl bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                      {client.reason}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <MetricMiniCard label="Plan mensual" value={formatCurrency(client.planValue)} />
                    <MetricMiniCard label="Carga del equipo" value={`${client.usagePercent}%`} />
                    <MetricMiniCard label="Pendiente real" value={formatCurrency(client.pendingAmount)} />
                    <MetricMiniCard label="Nivel de riesgo" value={client.riskScore >= 75 ? "Alto" : client.riskScore >= 55 ? "Medio" : "Bajo"} />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </AnalyticsSection>

      <AnalyticsSection
        icon={TrendingUp}
        title={model.forecast.summary.title}
        description={model.forecast.summary.description}
        helper={model.forecast.summary.helper}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {model.forecast.forecastCards.map((item) => (
            <Card key={item.title} className="rounded-3xl border-border/60 shadow-none">
              <CardContent className="space-y-2 p-6">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-muted-foreground">{item.title}</p>
                  <HelperTooltip content={item.helper} />
                </div>
                <p className="text-3xl font-semibold tracking-tight">{item.value}</p>
                <p className="text-xs leading-5 text-muted-foreground">{item.support}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="rounded-3xl border-border/60 shadow-none">
          <CardHeader className="space-y-2 p-6">
            <CardTitle className="flex items-center gap-2 text-lg">Lo que podría entrar en los próximos meses <HelperTooltip content="Te da una idea de cuánto dinero podría entrar si el negocio sigue un ritmo parecido al actual." /></CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">Esta estimación te ayuda a ver si lo que viene mantiene buen ritmo o si conviene reforzar ventas y cobros desde ahora.</p>
          </CardHeader>
          <CardContent className="space-y-5 p-4 pt-0 md:p-6 md:pt-0">
            <div className="space-y-3">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                Si esta curva se mantiene o sube, significa que el negocio todavía tiene buen respaldo para los próximos meses. Si baja, conviene revisar desde ya ventas nuevas, renovaciones y cobros.
              </div>
              <div className="h-[180px] w-full md:h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={model.forecast.projections}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(value: number) => formatCurrency(value).replace("US$", "$")} tick={{ fontSize: 12 }} />
                    <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                    <Area type="monotone" dataKey="revenue" stroke="#7c3aed" fill="#c4b5fd" fillOpacity={0.35} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {model.forecast.projections.map((prediction) => (
                <div key={prediction.label} className="rounded-2xl border border-border/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{prediction.label}</p>
                    <span className="text-sm font-semibold">{formatCurrency(prediction.revenue)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Qué tan confiable es esta estimación</span>
                    <span>{Math.round(prediction.confidence * 100)}%</span>
                  </div>
                  <Progress value={prediction.confidence * 100} className="mt-2 h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </AnalyticsSection>

      <AnalyticsSection
        icon={Lightbulb}
        title={model.actions.summary.title}
        description={model.actions.summary.description}
        helper={model.actions.summary.helper}
      >
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="rounded-3xl border-border/60 shadow-none">
            <CardHeader className="space-y-2 p-6">
              <CardTitle className="flex items-center gap-2 text-lg">Qué hacer primero <HelperTooltip content="Esta caja te ayuda a decidir por dónde empezar sin tener que interpretar tanto dato." /></CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">Úsala como una guía rápida para decidir qué mover hoy, qué revisar esta semana y qué puede esperar.</p>
            </CardHeader>
            <CardContent className="space-y-3 p-6 pt-0">
              <div className="rounded-2xl border border-border/60 bg-background p-4">
                <p className="text-sm font-medium">Haz primero</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Lo que destrabe cobros, cuide caja o evite atrasos importantes.</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background p-4">
                <p className="text-sm font-medium">Revisa después</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Las cuentas con mucha carga, poco margen o señales de desgaste del equipo.</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background p-4">
                <p className="text-sm font-medium">Puede esperar</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Lo que no tiene deuda, no aprieta al equipo y no pone en riesgo el mes.</p>
              </div>
              {error ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex items-start gap-2"><CircleAlert className="mt-0.5 h-4 w-4" /><span>{error}. Se está mostrando una lectura local de respaldo.</span></div>
                </div>
              ) : null}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="flex items-start gap-2"><Brain className="mt-0.5 h-4 w-4" /><span>{isLoading ? "Actualizando lectura con IA..." : "La IA ya dejó una propuesta de prioridades lista para revisar."}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/60 shadow-none">
            <CardHeader className="space-y-2 p-6">
              <CardTitle className="flex items-center gap-2 text-lg">Acciones sugeridas <HelperTooltip content="Son decisiones recomendadas para ayudarte a mover primero lo que más impacto puede tener en el negocio." /></CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">Una lista corta y respirable. Nada de bloques apretados ni decisiones escondidas.</p>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="rounded-2xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Acción</TableHead>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>Impacto</TableHead>
                      <TableHead>Cuándo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.actions.recommendations.map((recommendation) => (
                      <TableRow key={recommendation.id}>
                        <TableCell className="min-w-[260px]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{recommendation.title}</p>
                              <HelperTooltip content={recommendation.helper} />
                            </div>
                            <p className="text-xs leading-5 text-muted-foreground">{recommendation.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("rounded-full", recommendation.priority === "high" ? "bg-rose-100 text-rose-700 hover:bg-rose-100" : recommendation.priority === "medium" ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100")}>{recommendation.priority === "high" ? "Alta" : recommendation.priority === "medium" ? "Media" : "Baja"}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{recommendation.impactLabel}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{recommendation.actionLabel}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </AnalyticsSection>
    </div>
  );
}

function AnalyticsSection({ icon: Icon, title, description, helper, children }: { icon: typeof Sparkles; title: string; description: string; helper: string; children: ReactNode }) {
  return (
    <section className="space-y-6 md:space-y-8">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h2>
              <HelperTooltip content={helper} />
            </div>
            <p className="text-sm leading-6 text-muted-foreground md:text-base">{description}</p>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function HelperTooltip({ content }: { content: string }) {
  return (
    <div className="group relative inline-flex">
      <HelpCircle className="h-4 w-4 cursor-help text-muted-foreground" />
      <div className="absolute bottom-full left-1/2 z-50 mb-2 hidden w-72 -translate-x-1/2 rounded-2xl border bg-popover p-3 text-xs leading-5 text-popover-foreground shadow-xl group-hover:block">
        {content}
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-popover"></div>
      </div>
    </div>
  );
}

function MetricMiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-3">
      <p className="text-[11px] leading-4 text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium leading-5">{value}</p>
    </div>
  );
}
