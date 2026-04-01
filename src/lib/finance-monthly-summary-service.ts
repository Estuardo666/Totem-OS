"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  buildAlerts,
  buildHeroFocus,
  formatMonthValue,
  getBillingExceptions,
  getMonthEnd,
  getMonthStart,
  getRecurringStartMonth,
  getSummaryCutoffDate,
  groupReceivables,
  resolveSummaryMonth,
  toPercent,
} from "@/lib/finance-monthly-summary-helpers";
import { getClientMonthlyClosureRows } from "@/lib/finance-monthly-close-service";
import { getReceivablesFromDb } from "@/lib/finance-transaction-service";
import type {
  ClientSummaryAccumulator,
  MonthlyFinancialSummaryData,
  MonthlySummaryComparison,
  MonthlySummaryClientRow,
} from "@/lib/finance-monthly-summary-types";
import type { ApiResponse } from "@/types";

export type { MonthlyFinancialSummaryData } from "@/lib/finance-monthly-summary-types";

type MonthlySummarySnapshot = Omit<MonthlyFinancialSummaryData, "comparison" | "heroFocus">;

function buildMonthlyComparison(current: MonthlySummarySnapshot, previous: MonthlySummarySnapshot): MonthlySummaryComparison {
  const metrics: MonthlySummaryComparison["metrics"] = [
    {
      key: "recognizedRevenue",
      label: "Ingreso",
      helper: "Variación del ingreso reconocido del período.",
      currentValue: current.executive.recognizedRevenue,
      previousValue: previous.executive.recognizedRevenue,
      deltaValue: current.executive.recognizedRevenue - previous.executive.recognizedRevenue,
      deltaPct: previous.executive.recognizedRevenue > 0
        ? toPercent(current.executive.recognizedRevenue - previous.executive.recognizedRevenue, previous.executive.recognizedRevenue)
        : current.executive.recognizedRevenue === 0 ? 0 : null,
      tone: current.executive.recognizedRevenue === previous.executive.recognizedRevenue
        ? "neutral"
        : current.executive.recognizedRevenue > previous.executive.recognizedRevenue ? "positive" : "negative",
    },
    {
      key: "collectedCash",
      label: "Caja",
      helper: "Cobros registrados frente al mes anterior.",
      currentValue: current.executive.collectedCash,
      previousValue: previous.executive.collectedCash,
      deltaValue: current.executive.collectedCash - previous.executive.collectedCash,
      deltaPct: previous.executive.collectedCash > 0
        ? toPercent(current.executive.collectedCash - previous.executive.collectedCash, previous.executive.collectedCash)
        : current.executive.collectedCash === 0 ? 0 : null,
      tone: current.executive.collectedCash === previous.executive.collectedCash
        ? "neutral"
        : current.executive.collectedCash > previous.executive.collectedCash ? "positive" : "negative",
    },
    {
      key: "operatingResult",
      label: "Resultado",
      helper: "Qué tanto mejora o empeora la rentabilidad operativa.",
      currentValue: current.executive.operatingResult,
      previousValue: previous.executive.operatingResult,
      deltaValue: current.executive.operatingResult - previous.executive.operatingResult,
      deltaPct: previous.executive.operatingResult !== 0
        ? toPercent(current.executive.operatingResult - previous.executive.operatingResult, Math.abs(previous.executive.operatingResult))
        : current.executive.operatingResult === 0 ? 0 : null,
      tone: current.executive.operatingResult === previous.executive.operatingResult
        ? "neutral"
        : current.executive.operatingResult > previous.executive.operatingResult ? "positive" : "negative",
    },
    {
      key: "closingReceivables",
      label: "Cartera",
      helper: "Saldo pendiente al cierre. Aquí menos es mejor.",
      currentValue: current.executive.closingReceivables,
      previousValue: previous.executive.closingReceivables,
      deltaValue: current.executive.closingReceivables - previous.executive.closingReceivables,
      deltaPct: previous.executive.closingReceivables > 0
        ? toPercent(current.executive.closingReceivables - previous.executive.closingReceivables, previous.executive.closingReceivables)
        : current.executive.closingReceivables === 0 ? 0 : null,
      tone: current.executive.closingReceivables === previous.executive.closingReceivables
        ? "neutral"
        : current.executive.closingReceivables < previous.executive.closingReceivables ? "positive" : "negative",
    },
  ];

  const resultDelta = current.executive.operatingResult - previous.executive.operatingResult;
  const cashDelta = current.executive.collectedCash - previous.executive.collectedCash;
  const receivablesDelta = current.executive.closingReceivables - previous.executive.closingReceivables;

  const summary = [
    resultDelta === 0
      ? "El resultado operativo se mantiene estable"
      : resultDelta > 0
        ? "el resultado operativo mejora"
        : "el resultado operativo cae",
    cashDelta === 0
      ? "la caja se mantiene plana"
      : cashDelta > 0
        ? "la caja cobrada sube"
        : "la caja cobrada baja",
    receivablesDelta === 0
      ? "y la cartera se mantiene"
      : receivablesDelta < 0
        ? "y la cartera cede"
        : "y la cartera crece",
  ].join(", ");

  return {
    previousPeriodLabel: previous.periodLabel,
    summary: `${summary} frente a ${previous.periodLabel}.`,
    metrics,
  };
}

async function buildMonthlyFinancialSummary(userId: string, monthDate: Date): Promise<MonthlySummarySnapshot> {
  const monthStart = getMonthStart(monthDate);
  const monthEnd = getMonthEnd(monthDate);
  const periodValue = formatMonthValue(monthStart);
  const currentMonthValue = formatMonthValue(new Date());
  const isCurrentMonth = periodValue === currentMonthValue;
  const cutoffDate = getSummaryCutoffDate(monthStart);
  const periodLabel = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(monthStart);
  const cutoffLabel = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(cutoffDate);

  const [clients, invoices, incomeTransactions, expenseTransactions, honorarios, expenses, pendingExpenseTransactions, pendingHonorarios, pendingExpenses, receivablesResult] = await Promise.all([
    db.client.findMany({
      where: { status: { not: "INACTIVE" } },
      select: { id: true, name: true, logo: true, status: true, monthlyRate: true, paymentDay: true, billingStartDate: true, createdAt: true },
    }),
    db.invoice.findMany({ where: { generatedAt: { gte: monthStart, lte: monthEnd } }, include: { client: true } }),
    db.transaction.findMany({ where: { type: "INCOME", status: "PAID", createdAt: { gte: monthStart, lte: monthEnd } }, include: { relatedClient: true } }),
    db.transaction.findMany({ where: { type: "EXPENSE", status: "PAID", createdAt: { gte: monthStart, lte: monthEnd } }, include: { relatedClient: true } }),
    db.transaction.findMany({ where: { type: "HONORARIOS", status: "PAID", createdAt: { gte: monthStart, lte: monthEnd } }, include: { relatedClient: true } }),
    db.expense.findMany({ where: { date: { gte: monthStart, lte: monthEnd } }, include: { client: true } }),
    db.transaction.findMany({ where: { type: "EXPENSE", status: "PENDING" } }),
    db.transaction.findMany({ where: { type: "HONORARIOS", status: "PENDING" } }),
    db.expense.findMany({ where: { reimbursed: false } }),
    getReceivablesFromDb(userId, monthStart),
  ]);

  const recurringClientIds = clients.filter((client) => client.paymentDay && client.monthlyRate > 0 && client.status !== "PAUSED").map((client) => client.id);
  const [billingExceptions, closureRows] = await Promise.all([
    getBillingExceptions(recurringClientIds, monthStart.getFullYear(), monthStart.getMonth() + 1),
    getClientMonthlyClosureRows(recurringClientIds, {
      maxYear: monthStart.getFullYear(),
      maxMonth: monthStart.getMonth() + 1,
    }),
  ]);
  const exceptionsByClient = new Map(billingExceptions.map((exception) => [exception.clientId, exception]));
  const closuresByClient = new Map(
    closureRows
      .filter((row) => row.year === monthStart.getFullYear() && row.month === monthStart.getMonth() + 1)
      .map((row) => [row.clientId, row])
  );
  const pendingClosureClients: Array<{
    id: string;
    name: string;
    logo?: string | null;
    monthlyRate: number;
  }> = [];
  const billedInvoicesByClient = new Map<string, number>();
  const clientRows = new Map<string, ClientSummaryAccumulator>();

  const getRow = (input: { id: string; name: string; logo?: string | null; billingModel: "Recurrente" | "Proyecto" }) => {
    const existing = clientRows.get(input.id);
    if (existing) return existing;
    const created: ClientSummaryAccumulator = { ...input, recognizedRevenue: 0, collectedCash: 0, directCosts: 0, outstanding: 0 };
    clientRows.set(input.id, created);
    return created;
  };

  for (const invoice of invoices) {
    billedInvoicesByClient.set(invoice.clientId, (billedInvoicesByClient.get(invoice.clientId) ?? 0) + invoice.amount);
  }

  let recurringCommittedRevenue = 0;
  let confirmedRecurringRevenue = 0;
  let pendingRecurringRevenue = 0;
  let extraordinaryRevenue = 0;

  for (const client of clients) {
    const paymentDay = client.paymentDay ?? null;
    if (!paymentDay || client.monthlyRate <= 0 || client.status === "PAUSED") continue;

    const startMonth = getRecurringStartMonth(new Date(client.billingStartDate ?? client.createdAt), paymentDay);
    if (startMonth.getTime() > monthStart.getTime()) continue;

    const exception = exceptionsByClient.get(client.id);
    const closure = closuresByClient.get(client.id);
    if (!closure) {
      pendingClosureClients.push({
        id: client.id,
        name: client.name,
        logo: client.logo,
        monthlyRate: client.monthlyRate,
      });
    }
    let plannedAmount = client.monthlyRate;

    if (closure) {
      plannedAmount = closure.accrualStatus === "NONE" ? 0 : closure.accruedAmount;
    } else {
      if (exception?.type === "SKIP" || exception?.type === "MARK_AS_PAID") plannedAmount = 0;
      if (exception?.type === "OVERRIDE_AMOUNT") plannedAmount = exception.overrideAmount ?? client.monthlyRate;
    }

    const billedAmount = billedInvoicesByClient.get(client.id) ?? 0;
    const extraAmount = Math.max(0, billedAmount - plannedAmount);
    const row = getRow({ id: client.id, name: client.name, logo: client.logo, billingModel: "Recurrente" });
    row.recognizedRevenue += plannedAmount + extraAmount;
    recurringCommittedRevenue += plannedAmount;
    if (closure) {
      confirmedRecurringRevenue += plannedAmount;
    } else {
      pendingRecurringRevenue += plannedAmount;
    }
    extraordinaryRevenue += extraAmount;
  }

  for (const invoice of invoices) {
    if (recurringClientIds.includes(invoice.clientId)) continue;
    const row = getRow({ id: invoice.clientId, name: invoice.client.name, logo: invoice.client.logo, billingModel: "Proyecto" });
    row.recognizedRevenue += invoice.amount;
    extraordinaryRevenue += invoice.amount;
  }

  for (const transaction of incomeTransactions) {
    const relatedClientId = transaction.relatedClientId ?? transaction.clientId ?? null;
    if (!relatedClientId || recurringClientIds.includes(relatedClientId)) continue;
    const row = getRow({ id: relatedClientId, name: transaction.relatedClient?.name || "Ingreso sin cliente", logo: transaction.relatedClient?.logo, billingModel: "Proyecto" });
    row.recognizedRevenue += transaction.amount;
    extraordinaryRevenue += transaction.amount;
  }

  for (const invoice of invoices.filter((item) => item.status === "PAID")) {
    const row = getRow({ id: invoice.clientId, name: invoice.client.name, logo: invoice.client.logo, billingModel: recurringClientIds.includes(invoice.clientId) ? "Recurrente" : "Proyecto" });
    row.collectedCash += invoice.amount;
  }

  for (const transaction of incomeTransactions) {
    const relatedClientId = transaction.relatedClientId ?? transaction.clientId ?? null;
    if (!relatedClientId) continue;
    const row = getRow({ id: relatedClientId, name: transaction.relatedClient?.name || "Ingreso sin cliente", logo: transaction.relatedClient?.logo, billingModel: recurringClientIds.includes(relatedClientId) ? "Recurrente" : "Proyecto" });
    row.collectedCash += transaction.amount;
  }

  let directCosts = honorarios.reduce((sum, item) => sum + item.amount, 0);
  let operatingExpenses = 0;

  for (const expense of expenses) {
    if (expense.clientId && expense.client) {
      const row = getRow({ id: expense.clientId, name: expense.client.name, logo: expense.client.logo, billingModel: recurringClientIds.includes(expense.clientId) ? "Recurrente" : "Proyecto" });
      row.directCosts += expense.amount;
      directCosts += expense.amount;
    } else {
      operatingExpenses += expense.amount;
    }
  }

  for (const transaction of expenseTransactions) {
    const relatedClientId = transaction.relatedClientId ?? transaction.clientId ?? null;
    if (relatedClientId && transaction.relatedClient) {
      const row = getRow({ id: relatedClientId, name: transaction.relatedClient.name, logo: transaction.relatedClient.logo, billingModel: recurringClientIds.includes(relatedClientId) ? "Recurrente" : "Proyecto" });
      row.directCosts += transaction.amount;
      directCosts += transaction.amount;
    } else {
      operatingExpenses += transaction.amount;
    }
  }

  for (const transaction of honorarios) {
    const relatedClientId = transaction.relatedClientId ?? transaction.clientId ?? null;
    if (!relatedClientId || !transaction.relatedClient) continue;
    const row = getRow({ id: relatedClientId, name: transaction.relatedClient.name, logo: transaction.relatedClient.logo, billingModel: recurringClientIds.includes(relatedClientId) ? "Recurrente" : "Proyecto" });
    row.directCosts += transaction.amount;
  }

  const receivableEntries = receivablesResult.success && receivablesResult.data ? receivablesResult.data.pendingTransactions : [];
  for (const entry of receivableEntries) {
    const row = Array.from(clientRows.values()).find((item) => item.name === (entry.clientName || ""));
    if (row) row.outstanding += entry.amount;
  }

  const recognizedRevenue = recurringCommittedRevenue + extraordinaryRevenue;
  const collectedCash = invoices.filter((invoice) => invoice.status === "PAID").reduce((sum, invoice) => sum + invoice.amount, 0) + incomeTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const grossMargin = recognizedRevenue - directCosts;
  const operatingResult = grossMargin - operatingExpenses;
  const netCashFlow = collectedCash - directCosts - operatingExpenses;
  const pendingReimbursements = pendingExpenses.reduce((sum, item) => sum + item.amount, 0);
  const pendingExpenseTransactionsTotal = pendingExpenseTransactions.reduce((sum, item) => sum + item.amount, 0);
  const pendingCompensation = pendingHonorarios.reduce((sum, item) => sum + item.amount, 0);
  const pendingCommitments = pendingReimbursements + pendingExpenseTransactionsTotal + pendingCompensation;

  const receivablesTotal = receivableEntries.reduce((sum, item) => sum + item.amount, 0);
  const current = receivableEntries.filter((item) => item.daysOverdue <= 0).reduce((sum, item) => sum + item.amount, 0);
  const overdue1To30 = receivableEntries.filter((item) => item.daysOverdue >= 1 && item.daysOverdue <= 30).reduce((sum, item) => sum + item.amount, 0);
  const overdue31To60 = receivableEntries.filter((item) => item.daysOverdue >= 31 && item.daysOverdue <= 60).reduce((sum, item) => sum + item.amount, 0);
  const overdue61Plus = receivableEntries.filter((item) => item.daysOverdue >= 61).reduce((sum, item) => sum + item.amount, 0);

  const clientsData: MonthlySummaryClientRow[] = Array.from(clientRows.values())
    .filter((row) => row.recognizedRevenue > 0 || row.collectedCash > 0 || row.directCosts > 0 || row.outstanding > 0)
    .map((row) => ({
      ...row,
      contributionMargin: row.recognizedRevenue - row.directCosts,
      contributionMarginPct: row.recognizedRevenue > 0 ? toPercent(row.recognizedRevenue - row.directCosts, row.recognizedRevenue) : null,
      collectionStatus: (row.outstanding <= 0
        ? row.recognizedRevenue > 0 || row.collectedCash > 0 ? "Al día" : "Sin movimiento"
        : row.collectedCash > 0 ? "Pago parcial" : "Pendiente") as MonthlySummaryClientRow["collectionStatus"],
    }))
    .sort((a, b) => b.recognizedRevenue - a.recognizedRevenue || b.outstanding - a.outstanding);

  const summary: MonthlySummarySnapshot = {
    period: {
      value: periodValue,
      year: monthStart.getFullYear(),
      month: monthStart.getMonth() + 1,
      isCurrentMonth,
      cutoffLabel,
    },
    periodLabel,
    executive: {
      recognizedRevenue,
      collectedCash,
      directCosts,
      grossMargin,
      grossMarginPct: toPercent(grossMargin, recognizedRevenue),
      operatingExpenses,
      operatingResult,
      operatingMarginPct: toPercent(operatingResult, recognizedRevenue),
      closingReceivables: receivablesTotal,
      netCashFlow,
    },
    quality: {
      recurringCommittedRevenue,
      confirmedRecurringRevenue,
      pendingRecurringRevenue,
      extraordinaryRevenue,
      recurringSharePct: toPercent(recurringCommittedRevenue, recognizedRevenue),
      collectionEfficiencyPct: toPercent(collectedCash, recognizedRevenue),
      topClientConcentrationPct: toPercent(clientsData[0]?.recognizedRevenue ?? 0, recognizedRevenue),
      isProvisional: pendingClosureClients.length > 0,
    },
    closureControl: {
      pendingCount: pendingClosureClients.length,
      pendingAmount: pendingClosureClients.reduce((sum, client) => sum + client.monthlyRate, 0),
      pendingClients: pendingClosureClients,
    },
    treasury: {
      collectedCash,
      directCashOut: directCosts,
      operatingCashOut: operatingExpenses,
      pendingCommitments,
      pendingReimbursements,
      pendingExpenseTransactions: pendingExpenseTransactionsTotal,
      pendingCompensation,
    },
    receivables: {
      total: receivablesTotal,
      current,
      overdue1To30,
      overdue31To60,
      overdue61Plus,
      topDebtors: groupReceivables(receivableEntries),
    },
    clients: clientsData,
    alerts: [],
  };

  summary.alerts = buildAlerts(summary);
  return summary;
}

export async function getMonthlyFinancialSummaryFromDb(monthValue?: string): Promise<ApiResponse<MonthlyFinancialSummaryData>> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const userRole = session?.user?.role;

    if (!userId || userRole !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const monthDate = resolveSummaryMonth(monthValue);
    const previousMonthDate = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);

    const [currentSummary, previousSummary] = await Promise.all([
      buildMonthlyFinancialSummary(userId, monthDate),
      buildMonthlyFinancialSummary(userId, previousMonthDate),
    ]);

    return {
      success: true,
      data: {
        ...currentSummary,
        comparison: buildMonthlyComparison(currentSummary, previousSummary),
        heroFocus: buildHeroFocus({
          ...currentSummary,
          comparison: buildMonthlyComparison(currentSummary, previousSummary),
        }),
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al generar el resumen financiero mensual" };
  }
}
