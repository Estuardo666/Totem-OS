"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notifyAdmins } from "@/actions/notification-actions";
import {
  calculateProfitMargin,
  calculateRunwayDays,
  isBudgetDeviationExceeded,
  isExpenseAnomaly,
  isProfitabilityDropExceeded,
  toMonthKey,
} from "@/lib/finance-alerts";
import type { ApiResponse } from "@/types";
type FinanceAlertData = {
  id: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  fingerprint: string;
  metadata: string | null;
  assignedToId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type FinanceAlertRuleData = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  severity: string;
  config: string;
  createdAt: Date;
  updatedAt: Date;
};

const DEFAULT_RULES: Array<{
  key: string;
  name: string;
  description: string;
  severity: string;
  config: Record<string, unknown>;
}> = [
  {
    key: "cash_flow_runway",
    name: "Flujo de caja crítico",
    description: "Detecta cuando el runway de caja es menor al umbral definido.",
    severity: "CRITICAL",
    config: {
      minRunwayDays: 15,
      lookbackDays: 30,
    },
  },
  {
    key: "budget_deviation",
    name: "Desviación presupuestaria",
    description: "Alerta cuando los gastos mensuales superan el presupuesto.",
    severity: "HIGH",
    config: {
      thresholdPercent: 10,
      monthlyBudget: 0,
    },
  },
  {
    key: "profitability_drop",
    name: "Caída de rentabilidad",
    description: "Compara el margen actual vs histórico reciente.",
    severity: "HIGH",
    config: {
      dropPercent: 20,
      lookbackMonths: 3,
    },
  },
  {
    key: "client_renewal_risk",
    name: "Riesgo de no renovación",
    description: "Clientes con pagos vencidos o estatus de deuda.",
    severity: "MEDIUM",
    config: {
      overdueDays: 30,
    },
  },
  {
    key: "expense_anomaly",
    name: "Gastos anómalos",
    description: "Gastos del mes por encima del promedio histórico.",
    severity: "MEDIUM",
    config: {
      multiplier: 1.5,
      lookbackMonths: 3,
    },
  },
  {
    key: "cost_optimization",
    name: "Oportunidades de optimización",
    description: "Detecta categorías de gasto con concentración excesiva.",
    severity: "LOW",
    config: {
      categorySharePercent: 40,
    },
  },
];

const ALERT_TYPES = {
  cashFlow: "CASH_FLOW",
  budget: "BUDGET",
  profitability: "PROFITABILITY",
  clientRisk: "CLIENT_RISK",
  anomaly: "ANOMALY",
  optimization: "OPTIMIZATION",
} as const;

type RuleConfig = {
  minRunwayDays?: number;
  lookbackDays?: number;
  thresholdPercent?: number;
  monthlyBudget?: number;
  dropPercent?: number;
  lookbackMonths?: number;
  overdueDays?: number;
  multiplier?: number;
  categorySharePercent?: number;
};

function parseRuleConfig(rule: FinanceAlertRuleData): RuleConfig {
  try {
    return JSON.parse(rule.config) as RuleConfig;
  } catch {
    return {};
  }
}

async function ensureDefaultRules(): Promise<void> {
  await db.$transaction(
    DEFAULT_RULES.map((rule) =>
      db.financeAlertRule.upsert({
        where: { key: rule.key },
        update: {
          name: rule.name,
          description: rule.description,
          severity: rule.severity,
          config: JSON.stringify(rule.config),
        },
        create: {
          key: rule.key,
          name: rule.name,
          description: rule.description,
          severity: rule.severity,
          config: JSON.stringify(rule.config),
        },
      })
    )
  );
}

async function upsertAlert(params: {
  type: string;
  severity: string;
  title: string;
  message: string;
  fingerprint: string;
  metadata?: Record<string, unknown>;
}): Promise<FinanceAlertData> {
  const metadata = params.metadata ? JSON.stringify(params.metadata) : null;
  const existing = await db.financeAlert.findUnique({
    where: { fingerprint: params.fingerprint },
  });

  if (existing) {
    return db.financeAlert.update({
      where: { id: existing.id },
      data: {
        type: params.type,
        severity: params.severity,
        title: params.title,
        message: params.message,
        metadata,
        status: existing.status === "RESOLVED" ? "ACTIVE" : existing.status,
        resolvedAt: existing.status === "RESOLVED" ? null : existing.resolvedAt,
      },
    });
  }

  const created = await db.financeAlert.create({
    data: {
      type: params.type,
      severity: params.severity,
      title: params.title,
      message: params.message,
      fingerprint: params.fingerprint,
      metadata,
    },
  });

  await notifyAdmins(`⚠️ ${params.title}: ${params.message}`, "FINANCE_ALERT");

  return created;
}

async function resolveAlertByFingerprint(fingerprint: string): Promise<void> {
  await db.financeAlert.updateMany({
    where: { fingerprint, status: { not: "RESOLVED" } },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
}

export async function getFinanceAlertRules(): Promise<ApiResponse<FinanceAlertRuleData[]>> {
  try {
    await ensureDefaultRules();
    const rules = await db.financeAlertRule.findMany({
      orderBy: { createdAt: "asc" },
    });
    return { success: true, data: rules };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al cargar reglas",
    };
  }
}

export async function updateFinanceAlertRule(
  id: string,
  updates: Partial<Pick<FinanceAlertRuleData, "enabled" | "severity" | "config" | "name" | "description">>
): Promise<ApiResponse<FinanceAlertRuleData>> {
  try {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const updated = await db.financeAlertRule.update({
      where: { id },
      data: updates,
    });

    revalidatePath("/finance/alerts");
    return { success: true, data: updated };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar regla",
    };
  }
}

export async function getFinanceAlerts(params?: {
  status?: string;
  severity?: string;
}): Promise<ApiResponse<FinanceAlertData[]>> {
  try {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const alerts = await db.financeAlert.findMany({
      where: {
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.severity ? { severity: params.severity } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: alerts };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al cargar alertas",
    };
  }
}

export async function updateFinanceAlertStatus(
  alertId: string,
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED"
): Promise<ApiResponse<FinanceAlertData>> {
  try {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const updated = await db.financeAlert.update({
      where: { id: alertId },
      data: {
        status,
        resolvedAt: status === "RESOLVED" ? new Date() : null,
      },
    });

    revalidatePath("/finance/alerts");
    return { success: true, data: updated };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar alerta",
    };
  }
}

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

async function getMonthlyIncomeExpenses(date: Date) {
  const { start, end } = getMonthRange(date);

  const [invoiceSum, incomeTransactionSum, expenseSum, expenseTransactionSum, honorariosSum] =
    await Promise.all([
      db.invoice.aggregate({
        where: { status: "PAID", generatedAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: { type: "INCOME", status: "PAID", createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      db.expense.aggregate({
        where: { date: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: { type: "EXPENSE", status: "PAID", createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: { type: "HONORARIOS", status: "PAID", createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
    ]);

  const income = (invoiceSum._sum.amount ?? 0) + (incomeTransactionSum._sum.amount ?? 0);
  const expenses =
    (expenseSum._sum.amount ?? 0) +
    (expenseTransactionSum._sum.amount ?? 0) +
    (honorariosSum._sum.amount ?? 0);

  return { income, expenses };
}

export async function evaluateFinanceAlerts(): Promise<ApiResponse<{ alerts: FinanceAlertData[] }>> {
  try {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    await ensureDefaultRules();
    const rules = await db.financeAlertRule.findMany({ where: { enabled: true } });

    const now = new Date();
    const monthKey = toMonthKey(now);
    const alerts: FinanceAlertData[] = [];

    const globalBudgetConfig = await db.globalConfig.findUnique({
      where: { key: "financeMonthlyBudget" },
    });

    const globalMonthlyBudget = globalBudgetConfig?.value
      ? Number(globalBudgetConfig.value)
      : 0;

    const cashFlowRule = rules.find((rule: FinanceAlertRuleData) => rule.key === "cash_flow_runway");
    if (cashFlowRule) {
      const config = parseRuleConfig(cashFlowRule);
      const lookbackDays = config.lookbackDays ?? 30;
      const lookbackStart = new Date();
      lookbackStart.setDate(lookbackStart.getDate() - lookbackDays);

      const [incomeSum, expenseSum, recentExpenseSum] = await Promise.all([
        db.transaction.aggregate({
          where: { type: "INCOME", status: "PAID" },
          _sum: { amount: true },
        }),
        db.transaction.aggregate({
          where: { type: "EXPENSE", status: "PAID" },
          _sum: { amount: true },
        }),
        db.expense.aggregate({
          where: { date: { gte: lookbackStart } },
          _sum: { amount: true },
        }),
      ]);

      const cashOnHand = (incomeSum._sum.amount ?? 0) - (expenseSum._sum.amount ?? 0);
      const recentExpenses = recentExpenseSum._sum.amount ?? 0;
      const averageDailyExpense = recentExpenses / lookbackDays;
      const runway = calculateRunwayDays(cashOnHand, averageDailyExpense);

      const fingerprint = `${cashFlowRule.key}-${monthKey}`;
      if (runway.runwayDays <= (config.minRunwayDays ?? 15)) {
        const alert = await upsertAlert({
          type: ALERT_TYPES.cashFlow,
          severity: cashFlowRule.severity,
          title: "Flujo de caja crítico",
          message: `El runway estimado es de ${Math.round(runway.runwayDays)} días (umbral: ${config.minRunwayDays} días).`,
          fingerprint,
          metadata: {
            cashOnHand,
            averageDailyExpense,
            runwayDays: runway.runwayDays,
            lookbackDays,
          },
        });
        alerts.push(alert);
      } else {
        await resolveAlertByFingerprint(fingerprint);
      }
    }

    const budgetRule = rules.find((rule: FinanceAlertRuleData) => rule.key === "budget_deviation");
    if (budgetRule) {
      const config = parseRuleConfig(budgetRule);
      const { expenses } = await getMonthlyIncomeExpenses(now);
      const monthlyBudget = config.monthlyBudget && config.monthlyBudget > 0
        ? config.monthlyBudget
        : globalMonthlyBudget;

      const fingerprint = `${budgetRule.key}-${monthKey}`;
      if (monthlyBudget > 0 && isBudgetDeviationExceeded(expenses, monthlyBudget, config.thresholdPercent ?? 10)) {
        const alert = await upsertAlert({
          type: ALERT_TYPES.budget,
          severity: budgetRule.severity,
          title: "Desviación presupuestaria",
          message: `Los gastos del mes (${expenses.toFixed(2)}) superan el presupuesto (${monthlyBudget.toFixed(2)}).`,
          fingerprint,
          metadata: {
            expenses,
            monthlyBudget,
            thresholdPercent: config.thresholdPercent ?? 10,
          },
        });
        alerts.push(alert);
      } else {
        await resolveAlertByFingerprint(fingerprint);
      }
    }

    const profitabilityRule = rules.find((rule: FinanceAlertRuleData) => rule.key === "profitability_drop");
    if (profitabilityRule) {
      const config = parseRuleConfig(profitabilityRule);
      const lookbackMonths = config.lookbackMonths ?? 3;
      const currentStats = await getMonthlyIncomeExpenses(now);
      const currentMargin = calculateProfitMargin(currentStats.income, currentStats.expenses);

      const historicalMargins: number[] = [];
      for (let i = 1; i <= lookbackMonths; i += 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const stats = await getMonthlyIncomeExpenses(date);
        historicalMargins.push(calculateProfitMargin(stats.income, stats.expenses));
      }

      const historicalAverage = historicalMargins.length
        ? historicalMargins.reduce((sum, value) => sum + value, 0) / historicalMargins.length
        : 0;

      const fingerprint = `${profitabilityRule.key}-${monthKey}`;
      if (isProfitabilityDropExceeded(currentMargin, historicalAverage, config.dropPercent ?? 20)) {
        const alert = await upsertAlert({
          type: ALERT_TYPES.profitability,
          severity: profitabilityRule.severity,
          title: "Caída de rentabilidad",
          message: `El margen actual (${(currentMargin * 100).toFixed(1)}%) cayó respecto al histórico (${(historicalAverage * 100).toFixed(1)}%).`,
          fingerprint,
          metadata: {
            currentMargin,
            historicalAverage,
            lookbackMonths,
          },
        });
        alerts.push(alert);
      } else {
        await resolveAlertByFingerprint(fingerprint);
      }
    }

    const clientRiskRule = rules.find((rule: FinanceAlertRuleData) => rule.key === "client_renewal_risk");
    if (clientRiskRule) {
      const config = parseRuleConfig(clientRiskRule);
      const overdueDays = config.overdueDays ?? 30;
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - overdueDays);

      const [clientsInDebt, overdueInvoices] = await Promise.all([
        db.client.findMany({
          where: { status: "DEBT" },
          select: { id: true, name: true },
        }),
        db.invoice.findMany({
          where: {
            status: "PENDING",
            dueDate: { lt: overdueDate },
          },
          include: { client: true },
        }),
      ]);

      const riskyClients = new Map<string, string>();
      clientsInDebt.forEach((client) => riskyClients.set(client.id, client.name));
      overdueInvoices.forEach((invoice) => riskyClients.set(invoice.clientId, invoice.client.name));

      const fingerprint = `${clientRiskRule.key}-${monthKey}`;
      if (riskyClients.size > 0) {
        const alert = await upsertAlert({
          type: ALERT_TYPES.clientRisk,
          severity: clientRiskRule.severity,
          title: "Clientes con riesgo de no renovación",
          message: `Detectamos ${riskyClients.size} clientes con pagos vencidos o estatus de deuda.`,
          fingerprint,
          metadata: {
            overdueDays,
            clients: Array.from(riskyClients.values()),
          },
        });
        alerts.push(alert);
      } else {
        await resolveAlertByFingerprint(fingerprint);
      }
    }

    const anomalyRule = rules.find((rule: FinanceAlertRuleData) => rule.key === "expense_anomaly");
    if (anomalyRule) {
      const config = parseRuleConfig(anomalyRule);
      const lookbackMonths = config.lookbackMonths ?? 3;
      const currentStats = await getMonthlyIncomeExpenses(now);

      const historicalExpenses: number[] = [];
      for (let i = 1; i <= lookbackMonths; i += 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const stats = await getMonthlyIncomeExpenses(date);
        historicalExpenses.push(stats.expenses);
      }

      const historicalAverage = historicalExpenses.length
        ? historicalExpenses.reduce((sum, value) => sum + value, 0) / historicalExpenses.length
        : 0;

      const fingerprint = `${anomalyRule.key}-${monthKey}`;
      if (isExpenseAnomaly(currentStats.expenses, historicalAverage, config.multiplier ?? 1.5)) {
        const alert = await upsertAlert({
          type: ALERT_TYPES.anomaly,
          severity: anomalyRule.severity,
          title: "Gastos anómalos detectados",
          message: `Los gastos del mes (${currentStats.expenses.toFixed(2)}) superan el promedio histórico (${historicalAverage.toFixed(2)}).`,
          fingerprint,
          metadata: {
            currentExpenses: currentStats.expenses,
            historicalAverage,
            lookbackMonths,
          },
        });
        alerts.push(alert);
      } else {
        await resolveAlertByFingerprint(fingerprint);
      }
    }

    const optimizationRule = rules.find((rule: FinanceAlertRuleData) => rule.key === "cost_optimization");
    if (optimizationRule) {
      const config = parseRuleConfig(optimizationRule);
      const { start, end } = getMonthRange(now);

      const groupedExpenses = await db.expense.groupBy({
        by: ["category"],
        where: { date: { gte: start, lte: end } },
        _sum: { amount: true },
      });

      const totalExpense = groupedExpenses.reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);
      const topCategory = groupedExpenses
        .map((row) => ({ category: row.category, amount: row._sum.amount ?? 0 }))
        .sort((a, b) => b.amount - a.amount)[0];

      const sharePercent = totalExpense > 0 && topCategory
        ? (topCategory.amount / totalExpense) * 100
        : 0;

      const fingerprint = `${optimizationRule.key}-${monthKey}`;
      if (topCategory && sharePercent >= (config.categorySharePercent ?? 40)) {
        const alert = await upsertAlert({
          type: ALERT_TYPES.optimization,
          severity: optimizationRule.severity,
          title: "Oportunidad de optimización de costos",
          message: `La categoría ${topCategory.category} concentra ${sharePercent.toFixed(1)}% de los gastos del mes.`,
          fingerprint,
          metadata: {
            category: topCategory.category,
            categoryAmount: topCategory.amount,
            sharePercent,
          },
        });
        alerts.push(alert);
      } else {
        await resolveAlertByFingerprint(fingerprint);
      }
    }

    revalidatePath("/finance/alerts");
    return { success: true, data: { alerts } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al evaluar alertas",
    };
  }
}
