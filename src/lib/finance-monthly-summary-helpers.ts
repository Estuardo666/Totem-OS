import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type {
  BillingExceptionRow,
  MonthlyFinancialSummaryData,
  MonthlySummaryAlert,
  MonthlySummaryHeroFocus,
  ReceivableEntry,
  ReceivableRisk,
} from "@/lib/finance-monthly-summary-types";

export function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getMonthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function formatMonthValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export function resolveSummaryMonth(monthValue?: string | null) {
  const currentMonth = getMonthStart(new Date());

  if (!monthValue) {
    return currentMonth;
  }

  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthValue.trim());
  if (!match) {
    return currentMonth;
  }

  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return parsed.getTime() > currentMonth.getTime() ? currentMonth : parsed;
}

export function getSummaryCutoffDate(monthStart: Date) {
  const currentMonth = getMonthStart(new Date());
  if (monthStart.getTime() === currentMonth.getTime()) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
}

function getLastDayOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function getRecurringStartMonth(createdAt: Date, paymentDay: number) {
  const candidate = getMonthStart(createdAt);
  const scheduledDay = Math.min(paymentDay, getLastDayOfMonth(candidate.getFullYear(), candidate.getMonth()));
  const firstDueDate = new Date(candidate.getFullYear(), candidate.getMonth(), scheduledDay, 23, 59, 59, 999);

  if (createdAt.getTime() > firstDueDate.getTime()) {
    return addMonths(candidate, 1);
  }

  return candidate;
}

export function toPercent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

export async function getBillingExceptions(clientIds: string[], year: number, month: number) {
  if (clientIds.length === 0) {
    return [] as BillingExceptionRow[];
  }

  try {
    return await db.$queryRaw<Array<BillingExceptionRow>>`
      SELECT "clientId", "month", "year", "type", "overrideAmount"
      FROM "ClientBillingException"
      WHERE "clientId" IN (${Prisma.join(clientIds)})
        AND "year" = ${year}
        AND "month" = ${month}
    `;
  } catch {
    return [] as BillingExceptionRow[];
  }
}

export function groupReceivables(entries: ReceivableEntry[]): Array<{
  clientName: string;
  clientLogo?: string | null;
  amount: number;
  items: number;
  risk: ReceivableRisk;
}> {
  const grouped = new Map<string, { clientName: string; clientLogo?: string | null; amount: number; items: number; maxDays: number }>();

  for (const entry of entries) {
    const clientName = entry.clientName || "Sin cliente asignado";
    const existing = grouped.get(clientName);
    if (existing) {
      existing.amount += entry.amount;
      existing.items += 1;
      existing.maxDays = Math.max(existing.maxDays, entry.daysOverdue);
      continue;
    }

    grouped.set(clientName, {
      clientName,
      clientLogo: entry.clientLogo,
      amount: entry.amount,
      items: 1,
      maxDays: entry.daysOverdue,
    });
  }

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      risk: (item.maxDays > 30 ? "critical" : item.maxDays > 0 ? "warning" : "healthy") as ReceivableRisk,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

export function buildAlerts(input: Pick<MonthlyFinancialSummaryData, "executive" | "quality" | "receivables" | "closureControl">): MonthlySummaryAlert[] {
  const alerts: MonthlySummaryAlert[] = [];

  if (input.closureControl.pendingCount > 0) {
    alerts.push({
      tone: "critical",
      title: "Clientes recurrentes sin cierre mensual",
      description: `${input.closureControl.pendingCount} cliente(s) recurrente(s) siguen sin cierre del período por ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(input.closureControl.pendingAmount)}. Esa lectura puede inflar o distorsionar el ingreso devengado.`,
    });
  }

  if (input.executive.operatingResult < 0) {
    alerts.push({
      tone: "critical",
      title: "Resultado operativo negativo",
      description: "El mes está cerrando con pérdida operativa. Revisa costos directos y gasto administrativo antes de crecer la estructura.",
    });
  }

  if (input.quality.collectionEfficiencyPct < 80) {
    alerts.push({
      tone: "warning",
      title: "Cobranza por debajo del objetivo",
      description: "La conversión de ingreso a caja está por debajo de 80%. Prioriza seguimiento de cartera y acuerdos de pago.",
    });
  }

  if (input.quality.topClientConcentrationPct >= 35) {
    alerts.push({
      tone: "warning",
      title: "Alta concentración en un solo cliente",
      description: "Más de un tercio del ingreso del mes depende de una sola cuenta. Diversificar reduce riesgo de caja y negociación.",
    });
  }

  if (input.receivables.overdue31To60 + input.receivables.overdue61Plus > 0) {
    alerts.push({
      tone: "critical",
      title: "Cartera envejecida",
      description: "Ya existe cartera con más de 30 días. Conviene separar recobro intensivo y frenar trabajo nuevo si no hay acuerdo claro.",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      tone: "healthy",
      title: "Mes financieramente controlado",
      description: "Resultado, caja y cartera están alineados. Mantén disciplina de cobro y evita subir estructura fija más rápido que el ingreso recurrente.",
    });
  }

  return alerts;
}

export function buildHeroFocus(input: Pick<MonthlyFinancialSummaryData, "executive" | "quality" | "receivables" | "comparison">): MonthlySummaryHeroFocus {
  const agedReceivables = input.receivables.overdue31To60 + input.receivables.overdue61Plus;
  const resultDelta = input.comparison.metrics.find((metric) => metric.key === "operatingResult")?.deltaValue ?? 0;

  if (input.executive.operatingResult < 0) {
    return {
      tone: "critical",
      title: "La prioridad es corregir la rentabilidad",
      description: "El mes cierra con pérdida operativa. Antes de crecer, conviene ajustar costos directos, estructura o pricing.",
      metricLabel: "Resultado operativo",
      metricValue: input.executive.operatingResult,
      metricFormat: "currency",
      context: `Margen ${input.executive.operatingMarginPct.toFixed(1)}%`,
    };
  }

  if (agedReceivables > 0) {
    return {
      tone: "critical",
      title: "La cartera envejecida ya tensiona la caja",
      description: "Hay saldo con más de 30 días. Este foco exige cobro activo y límites claros antes de seguir entregando trabajo.",
      metricLabel: "Cartera > 30 días",
      metricValue: agedReceivables,
      metricFormat: "currency",
      context: `Cartera total ${new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(input.receivables.total)}`,
    };
  }

  if (input.quality.collectionEfficiencyPct < 80) {
    return {
      tone: "warning",
      title: "La conversión de ingreso a caja está floja",
      description: "Se está facturando más de lo que realmente entra. La prioridad es acelerar cobranza para no financiar la operación con cartera.",
      metricLabel: "Eficiencia de cobranza",
      metricValue: input.quality.collectionEfficiencyPct,
      metricFormat: "percent",
      context: `Caja cobrada ${new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(input.executive.collectedCash)}`,
    };
  }

  if (input.quality.topClientConcentrationPct >= 35) {
    return {
      tone: "warning",
      title: "La concentración comercial es alta",
      description: "Un solo cliente pesa demasiado en el mes. Conviene diversificar antes de asumir más estructura fija o descuentos agresivos.",
      metricLabel: "Concentración del cliente principal",
      metricValue: input.quality.topClientConcentrationPct,
      metricFormat: "percent",
      context: "Participación del cliente más grande en el ingreso del período",
    };
  }

  if (resultDelta < 0) {
    return {
      tone: "warning",
      title: "La rentabilidad se desacelera frente al mes anterior",
      description: "Aunque el mes sigue controlado, el resultado operativo perdió tracción versus el período previo. Vale revisar mezcla de ingresos y costos.",
      metricLabel: "Variación del resultado",
      metricValue: resultDelta,
      metricFormat: "currency",
      context: `Vs. ${input.comparison.previousPeriodLabel}`,
    };
  }

  return {
    tone: "healthy",
    title: "El foco del mes es sostener la disciplina actual",
    description: "Resultado, caja y cartera están alineados. La prioridad pasa por consolidar cobranza y proteger el margen logrado.",
    metricLabel: "Resultado operativo",
    metricValue: input.executive.operatingResult,
    metricFormat: "currency",
    context: `Cobranza ${input.quality.collectionEfficiencyPct.toFixed(1)}%`,
  };
}
