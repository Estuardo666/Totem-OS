"use strict";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getFinanceSettingsWithFallback } from "@/actions/finance-settings-actions";
import type { FinanceSettings } from "@/schemas/finance-settings";
import type { ApiResponse } from "@/types";
import type { BudgetUsageStatus, FinanceSettingsMetrics } from "@/types";

/**
 * Interfaz para datos del mapa de calor operativo
 */
export interface HeatmapCell {
  week: number; // 1-4 (semanas del mes)
  category: string; // Categoría del gasto
  amount: number; // Monto total
  count: number; // Número de transacciones
}

/**
 * Interfaz para estadísticas financieras
 */
export interface FinancialStats {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  incomeDeltaPct?: number;
  expensesDeltaPct?: number;
  netProfitDeltaPct?: number;
  marginDeltaPct?: number;
  pendingReimbursementsDeltaPct?: number;
  honorariosDeltaPct?: number;
  totalHonorariosPaid?: number;
  totalHonorariosPaidDeltaPct?: number;
  recentTransactions: Array<{
    id: string;
    type: "INCOME" | "EXPENSE" | "HONORARIOS";
    amount: number;
    description: string;
    date: Date;
    clientName?: string;
    clientLogo?: string | null;
    status?: string;
    category?: string;
    sourceType?: "INVOICE" | "EXPENSE" | "TRANSACTION";
    assignedToName?: string;
    assignedToImage?: string | null;
    assignedToId?: string;
    userId?: string;
  }>;
  pendingReimbursements?: number;
  honorariosReceived?: number;
  heatmapData?: HeatmapCell[];
  financeSettingsMetrics?: FinanceSettingsMetrics;
}

function resolveBudgetStatus(params: {
  usagePercent: number;
  approvalRequired: boolean;
  alertThresholdPercent: number;
  warningThresholdPercent: number;
}): BudgetUsageStatus {
  const { usagePercent, approvalRequired, alertThresholdPercent, warningThresholdPercent } = params;

  if (approvalRequired && usagePercent > alertThresholdPercent) {
    return "approval_required";
  }

  if (usagePercent >= alertThresholdPercent) {
    return "alert";
  }

  if (usagePercent >= warningThresholdPercent) {
    return "warning";
  }

  return "normal";
}

async function buildFinanceSettingsMetrics(params: {
  totalIncome: number;
  expensesThisMonth: Array<{ amount: number; category: string; paidByUserId: string | null }>;
  expenseTransactionsThisMonth: Array<{ amount: number; category: string | null; assignedToId: string | null }>;
}): Promise<FinanceSettingsMetrics> {
  const settings: FinanceSettings = await getFinanceSettingsWithFallback();
  const trackedCategories = new Set(settings.trackedCategories);

  const trackedExpenseAmount = params.expensesThisMonth
    .filter((expense) => trackedCategories.has(expense.category as FinanceSettings["trackedCategories"][number]))
    .reduce((sum, expense) => sum + expense.amount, 0);

  const trackedTransactionAmount = params.expenseTransactionsThisMonth
    .filter((transaction) => transaction.category && trackedCategories.has(transaction.category as FinanceSettings["trackedCategories"][number]))
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const trackedExpenses = trackedExpenseAmount + trackedTransactionAmount;
  const globalBudgetLimit = settings.budgetControlEnabled
    ? (params.totalIncome * settings.globalBudgetPercentage) / 100
    : 0;
  const globalBudgetUsagePercent = globalBudgetLimit > 0 ? (trackedExpenses / globalBudgetLimit) * 100 : 0;
  const globalBudgetRemaining = Math.max(globalBudgetLimit - trackedExpenses, 0);
  const globalBudgetStatus = resolveBudgetStatus({
    usagePercent: globalBudgetUsagePercent,
    approvalRequired: settings.approvalRequiredOnExceed,
    alertThresholdPercent: settings.alertThresholdPercent,
    warningThresholdPercent: settings.warningThresholdPercent,
  });

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      roleLegacy: true,
    },
  });

  const adminUsers = users.filter((user) => user.roleLegacy === "ADMIN");

  const userConsumedMap = new Map<string, number>();
  params.expensesThisMonth.forEach((expense) => {
    if (!expense.paidByUserId || !trackedCategories.has(expense.category as FinanceSettings["trackedCategories"][number])) {
      return;
    }

    userConsumedMap.set(expense.paidByUserId, (userConsumedMap.get(expense.paidByUserId) ?? 0) + expense.amount);
  });

  params.expenseTransactionsThisMonth.forEach((transaction) => {
    if (!transaction.assignedToId || !transaction.category || !trackedCategories.has(transaction.category as FinanceSettings["trackedCategories"][number])) {
      return;
    }

    userConsumedMap.set(transaction.assignedToId, (userConsumedMap.get(transaction.assignedToId) ?? 0) + transaction.amount);
  });

  const adminBudgets = adminUsers.map((user) => {
    const override = settings.adminBudgetOverrides.find((item) => item.userId === user.id);
    const mode = override?.mode ?? settings.adminBudgetMode;
    const rawValue = override?.value ?? settings.adminBudgetDefaultValue;
    const limitAmount = settings.adminBudgetEnabled
      ? mode === "PERCENTAGE"
        ? (params.totalIncome * rawValue) / 100
        : rawValue
      : 0;
    const consumedAmount = userConsumedMap.get(user.id) ?? 0;
    const usagePercent = limitAmount > 0 ? (consumedAmount / limitAmount) * 100 : 0;
    const remainingAmount = Math.max(limitAmount - consumedAmount, 0);

    return {
      userId: user.id,
      userName: user.name ?? "Usuario",
      consumedAmount,
      limitAmount,
      remainingAmount,
      usagePercent,
      status: resolveBudgetStatus({
        usagePercent,
        approvalRequired: settings.approvalRequiredOnExceed,
        alertThresholdPercent: settings.alertThresholdPercent,
        warningThresholdPercent: settings.warningThresholdPercent,
      }),
    };
  });

  const personalAnalyticsSummaries = users.map((user) => {
    const paidAmount = params.expensesThisMonth
      .filter((expense) => expense.paidByUserId === user.id)
      .reduce((sum, expense) => sum + expense.amount, 0);
    const consumedAmount = userConsumedMap.get(user.id) ?? 0;

    return {
      userId: user.id,
      userName: user.name ?? "Usuario",
      paidAmount,
      consumedAmount,
      balance: paidAmount - consumedAmount,
    };
  });

  const creditors = personalAnalyticsSummaries
    .filter((item) => item.balance > 0.01)
    .map((item) => ({ ...item }));
  const debtors = personalAnalyticsSummaries
    .filter((item) => item.balance < -0.01)
    .map((item) => ({ ...item, balance: Math.abs(item.balance) }));
  const suggestedTransfers: FinanceSettingsMetrics["personalAnalytics"]["suggestedTransfers"] = [];

  creditors.forEach((creditor) => {
    let remainingCredit = creditor.balance;

    debtors.forEach((debtor) => {
      if (remainingCredit <= 0.01 || debtor.balance <= 0.01) {
        return;
      }

      const amount = Math.min(remainingCredit, debtor.balance);
      if (amount <= 0.01) {
        return;
      }

      suggestedTransfers.push({
        fromUserId: debtor.userId,
        fromUserName: debtor.userName,
        toUserId: creditor.userId,
        toUserName: creditor.userName,
        amount,
      });

      remainingCredit -= amount;
      debtor.balance -= amount;
    });
  });

  return {
    overview: {
      baseIncome: params.totalIncome,
      trackedExpenses,
      globalBudgetLimit,
      globalBudgetRemaining,
      globalBudgetUsagePercent,
      globalBudgetStatus,
      trackedCategories: Array.from(trackedCategories),
      approvalRequiredOnExceed: settings.approvalRequiredOnExceed,
    },
    adminBudgets,
    personalAnalytics: {
      enabled: settings.personalAnalyticsEnabled,
      summaries: personalAnalyticsSummaries,
      suggestedTransfers,
    },
  };
}

/**
 * Interfaz para estadísticas de gastos
 */
export interface ExpensesStatsData {
  totalExpensesThisMonth: number;
  pendingReimbursement: number;
  expenses: Array<{
    id: string;
    description: string;
    amount: number;
    category: string;
    date: Date;
    status: string;
    assignedToName?: string;
    assignedToId?: string;
    reimbursed: boolean;
    sourceType?: "EXPENSE" | "TRANSACTION";
    clientName?: string;
    clientId?: string;
  }>;
  categoryDistribution: Array<{
    category: string;
    amount: number;
  }>;
  clientDistribution: Array<{
    clientName: string;
    amount: number;
  }>;
  financeSettingsMetrics?: FinanceSettingsMetrics;
}

/**
 * Interfaz para rentabilidad global
 */
export interface MonthlyProfitability {
  month: string;
  monthKey: string;
  income: number;
  expenses: number;
  profit: number;
}

export interface GlobalProfitabilityStatsData {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  monthlyData: MonthlyProfitability[];
  partnerDistribution: {
    stuart: number;
    paty: number;
  };
}

/**
 * Obtiene estadísticas financieras generales
 * Para ADMIN: ingresos de facturas + transacciones INCOME, gastos de expenses + transacciones
 * Para Non-ADMIN: apenas honorarios y gastos personales
 */
export async function getFinancialStatsFromDb(): Promise<ApiResponse<FinancialStats>> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const userRole = session?.user?.role;
    const isAdmin = userRole === "ADMIN";

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Obtener facturas pagadas (solo ADMIN)
    const paidInvoicesThisMonth = isAdmin
      ? await db.invoice.findMany({
          where: {
            status: "PAID",
            generatedAt: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
          include: {
            client: true,
          },
        })
      : [];

    const paidInvoicesPrevMonth = isAdmin
      ? await db.invoice.findMany({
          where: {
            status: "PAID",
            generatedAt: {
              gte: prevMonthStart,
              lte: prevMonthEnd,
            },
          },
          include: {
            client: true,
          },
        })
      : [];

    // Obtener transacciones INCOME/HONORARIOS pagadas
    const paidTransactionsThisMonth = await db.transaction.findMany({
      where: {
        type: !isAdmin ? "HONORARIOS" : "INCOME",
        status: "PAID",
        ...(!isAdmin && userId ? { userId: userId } : {}),
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    const paidTransactionsPrevMonth = await db.transaction.findMany({
      where: {
        type: !isAdmin ? "HONORARIOS" : "INCOME",
        status: "PAID",
        ...(!isAdmin && userId ? { userId: userId } : {}),
        createdAt: {
          gte: prevMonthStart,
          lte: prevMonthEnd,
        },
      },
    });

    // Calcular ingresos totales
    const totalIncome =
      paidInvoicesThisMonth.reduce((sum, invoice) => sum + invoice.amount, 0) +
      paidTransactionsThisMonth.reduce((sum, transaction) => sum + transaction.amount, 0);

    const prevTotalIncome =
      paidInvoicesPrevMonth.reduce((sum, invoice) => sum + invoice.amount, 0) +
      paidTransactionsPrevMonth.reduce((sum, transaction) => sum + transaction.amount, 0);

    // Obtener gastos
    const paidExpensesThisMonth = await db.expense.findMany({
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
        ...(!isAdmin && userId ? { paidByUserId: userId } : {}),
      },
    });

    const paidExpensesPrevMonth = await db.expense.findMany({
      where: {
        date: {
          gte: prevMonthStart,
          lte: prevMonthEnd,
        },
        ...(!isAdmin && userId ? { paidByUserId: userId } : {}),
      },
    });

    // Obtener honorarios pagados (transacciones de tipo HONORARIOS, solo ADMIN)
    const paidHonorariosThisMonth = isAdmin
      ? await db.transaction.findMany({
          where: {
            type: "HONORARIOS",
            status: "PAID",
            createdAt: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
        })
      : [];

    const paidHonorariosPrevMonth = isAdmin
      ? await db.transaction.findMany({
          where: {
            type: "HONORARIOS",
            status: "PAID",
            createdAt: {
              gte: prevMonthStart,
              lte: prevMonthEnd,
            },
          },
        })
      : [];

    // Obtener transacciones EXPENSE pagadas
    const paidExpenseTransactionsThisMonth = await db.transaction.findMany({
      where: {
        type: "EXPENSE",
        status: "PAID",
        ...(!isAdmin && userId ? { assignedToId: userId } : {}),
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      include: {
        assignedTo: {
          select: {
            name: true,
          },
        },
      },
    });

    const paidExpenseTransactionsPrevMonth = await db.transaction.findMany({
      where: {
        type: "EXPENSE",
        status: "PAID",
        ...(!isAdmin && userId ? { assignedToId: userId } : {}),
        createdAt: {
          gte: prevMonthStart,
          lte: prevMonthEnd,
        },
      },
      include: {
        assignedTo: {
          select: {
            name: true,
          },
        },
      },
    });

    // Calcular gastos totales
    const totalExpenses =
      paidExpensesThisMonth.reduce((sum, expense) => sum + expense.amount, 0) +
      paidExpenseTransactionsThisMonth.reduce((sum, transaction) => sum + transaction.amount, 0) +
      paidHonorariosThisMonth.reduce((sum, transaction) => sum + transaction.amount, 0);

    const prevTotalExpenses =
      paidExpensesPrevMonth.reduce((sum, expense) => sum + expense.amount, 0) +
      paidExpenseTransactionsPrevMonth.reduce((sum, transaction) => sum + transaction.amount, 0) +
      paidHonorariosPrevMonth.reduce((sum, transaction) => sum + transaction.amount, 0);

    // Calcular ganancias netas
    const netProfit = totalIncome - totalExpenses;
    const prevNetProfit = prevTotalIncome - prevTotalExpenses;

    const calculateDeltaPct = (current: number, previous: number) => {
      if (previous === 0) return current === 0 ? 0 : 100;
      return ((current - previous) / Math.abs(previous)) * 100;
    };

    const incomeDeltaPct = calculateDeltaPct(totalIncome, prevTotalIncome);
    const expensesDeltaPct = calculateDeltaPct(totalExpenses, prevTotalExpenses);
    const netProfitDeltaPct = calculateDeltaPct(netProfit, prevNetProfit);
    const currentMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
    const prevMargin = prevTotalIncome > 0 ? (prevNetProfit / prevTotalIncome) * 100 : 0;
    const marginDeltaPct = calculateDeltaPct(currentMargin, prevMargin);

    // Calcular honorarios totales pagados (para ADMIN)
    let totalHonorariosPaid: number | undefined;
    let totalHonorariosPaidDeltaPct: number | undefined;

    if (isAdmin) {
      totalHonorariosPaid = paidHonorariosThisMonth.reduce((sum, t) => sum + t.amount, 0);
      const prevTotalHonorariosPaid = paidHonorariosPrevMonth.reduce((sum, t) => sum + t.amount, 0);
      totalHonorariosPaidDeltaPct = calculateDeltaPct(totalHonorariosPaid, prevTotalHonorariosPaid);
    }

    // Estadísticas específicas del usuario
    let pendingReimbursements: number | undefined;
    let honorariosReceived: number | undefined;
    let pendingReimbursementsDeltaPct = 0;
    let honorariosDeltaPct = 0;

    if (userId) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const prevWeekStart = new Date();
      prevWeekStart.setDate(prevWeekStart.getDate() - 14);
      const prevWeekEnd = new Date();
      prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

      const pendingExpenseTransactions = await db.transaction.findMany({
        where: {
          type: "EXPENSE",
          status: "PENDING",
          assignedToId: userId,
        },
      });

      const pendingExpenseTransactionsPrevWeek = await db.transaction.findMany({
        where: {
          type: "EXPENSE",
          status: "PENDING",
          assignedToId: userId,
          createdAt: {
            gte: prevWeekStart,
            lte: prevWeekEnd,
          },
        },
      });

      const pendingExpenses = await db.expense.findMany({
        where: {
          reimbursed: false,
          paidByUserId: userId,
        },
      });

      const pendingExpensesPrevWeek = await db.expense.findMany({
        where: {
          reimbursed: false,
          paidByUserId: userId,
          date: {
            gte: prevWeekStart,
            lte: prevWeekEnd,
          },
        },
      });

      pendingReimbursements =
        pendingExpenseTransactions.reduce((sum, t) => sum + t.amount, 0) +
        pendingExpenses.reduce((sum, e) => sum + e.amount, 0);

      const pendingReimbursementsPrevWeek =
        pendingExpenseTransactionsPrevWeek.reduce((sum, t) => sum + t.amount, 0) +
        pendingExpensesPrevWeek.reduce((sum, e) => sum + e.amount, 0);

      // Honorarios pagados
      const honorariosThisMonth = await db.transaction.findMany({
        where: {
          type: "HONORARIOS",
          status: "PAID",
          userId,
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      const honorariosPrevMonth = await db.transaction.findMany({
        where: {
          type: "HONORARIOS",
          status: "PAID",
          userId,
          createdAt: {
            gte: prevMonthStart,
            lte: prevMonthEnd,
          },
        },
      });

      honorariosReceived = honorariosThisMonth.reduce((sum, t) => sum + t.amount, 0);
      const honorariosPrev = honorariosPrevMonth.reduce((sum, t) => sum + t.amount, 0);
      pendingReimbursementsDeltaPct = calculateDeltaPct(
        pendingReimbursements,
        pendingReimbursementsPrevWeek
      );
      honorariosDeltaPct = calculateDeltaPct(honorariosReceived, honorariosPrev);
    }

    // Obtener todas las transacciones
    const allInvoices = isAdmin
      ? await db.invoice.findMany({
          include: {
            client: true,
          },
          orderBy: {
            generatedAt: "desc",
          },
        })
      : [];

    const expenseWhereClause = isAdmin ? {} : userId ? { paidByUserId: userId } : { id: undefined };

    const allExpenses = await db.expense.findMany({
      where: expenseWhereClause,
      include: {
        client: true,
        paidByUser: {
          select: {
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    const transactionWhereClause = isAdmin
      ? {}
      : userId
        ? {
            OR: [
              {
                type: "EXPENSE",
                assignedToId: userId,
              },
              {
                type: "HONORARIOS",
                userId,
              },
            ],
          }
        : { id: undefined };

    const allTransactions = await db.transaction.findMany({
      where: transactionWhereClause,
      include: {
        relatedClient: true,
        assignedTo: {
          select: {
            name: true,
            image: true,
          },
        },
        user: {
          select: {
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Mezclar y ordenar transacciones
    const baseTransactions = [
      ...(isAdmin
        ? allInvoices.map((invoice) => ({
            id: invoice.id,
            type: "INCOME" as const,
            amount: invoice.amount,
            description: `Factura - ${invoice.client.name}`,
            date: invoice.generatedAt,
            clientName: invoice.client.name,
            clientLogo: invoice.client.logo ?? undefined,
            status: invoice.status,
            category: undefined as string | undefined,
            sourceType: "INVOICE" as const,
            assignedToName: undefined as string | undefined,
            assignedToId: undefined as string | undefined,
          }))
        : []),
      ...allExpenses.map((expense) => ({
        id: expense.id,
        type: "EXPENSE" as const,
        amount: expense.amount,
        description: expense.description,
        date: expense.date,
        clientName: expense.client?.name,
        clientLogo: expense.client?.logo ?? undefined,
        status: expense.reimbursed ? "PAID" : "PENDING",
        category: expense.category,
        sourceType: "EXPENSE" as const,
        assignedToName: expense.paidByUser?.name,
        assignedToImage: expense.paidByUser?.image ?? undefined,
        assignedToId: expense.paidByUserId ?? undefined,
        userId: expense.paidByUserId ?? undefined,
      })),
      ...allTransactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type as "INCOME" | "EXPENSE" | "HONORARIOS",
        amount: transaction.amount,
        description: transaction.description || "Transacción",
        date: transaction.createdAt,
        clientName: transaction.relatedClient?.name,
        clientLogo: transaction.relatedClient?.logo ?? undefined,
        status: transaction.status,
        category: transaction.category ?? undefined,
        sourceType: "TRANSACTION" as const,
        assignedToName:
          transaction.type === "HONORARIOS"
            ? transaction.user?.name
            : transaction.assignedTo?.name,
        assignedToImage:
          transaction.type === "HONORARIOS"
            ? transaction.user?.image
            : transaction.assignedTo?.image ?? undefined,
        assignedToId:
          transaction.type === "HONORARIOS"
            ? transaction.userId ?? transaction.assignedToId ?? undefined
            : transaction.assignedToId ?? undefined,
        userId: transaction.userId ?? undefined,
      })),
    ];

    const transactions = baseTransactions
      .filter((t) => {
        if (isAdmin) {
          return true;
        }

        if (userId) {
          if (t.type === "INCOME") {
            return false;
          }

          const ownerId = t.assignedToId ?? t.userId;
          const recipientId = t.userId ?? t.assignedToId;
          const isUserExpense = t.type === "EXPENSE" && ownerId === userId;
          const isHonorario = t.type === "HONORARIOS" && recipientId === userId;

          return isUserExpense || isHonorario;
        }

        return true;
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime()) as FinancialStats["recentTransactions"];

    // Calcular datos del mapa de calor (solo para ADMIN)
    let heatmapData: HeatmapCell[] | undefined;
    
    if (isAdmin) {
      // Función para obtener el número de semana del mes (1-4)
      const getWeekOfMonth = (date: Date): number => {
        const dayOfMonth = date.getDate();
        return Math.ceil(dayOfMonth / 7);
      };

      // Combinar todos los gastos del mes actual
      const allExpensesThisMonth = [
        ...paidExpensesThisMonth.map((e) => ({
          date: e.date,
          category: e.category || "Otros",
          amount: e.amount,
        })),
        ...paidExpenseTransactionsThisMonth.map((t) => ({
          date: t.createdAt,
          category: t.category || "Otros",
          amount: t.amount,
        })),
        ...paidHonorariosThisMonth.map((t) => ({
          date: t.createdAt,
          category: "Honorarios",
          amount: t.amount,
        })),
      ];

      // Agrupar por semana y categoría
      const heatmapMap = new Map<string, { amount: number; count: number }>();

      allExpensesThisMonth.forEach((expense) => {
        const week = getWeekOfMonth(expense.date);
        const key = `${week}-${expense.category}`;
        
        const existing = heatmapMap.get(key) || { amount: 0, count: 0 };
        heatmapMap.set(key, {
          amount: existing.amount + expense.amount,
          count: existing.count + 1,
        });
      });

      // Convertir a array
      heatmapData = Array.from(heatmapMap.entries()).map(([key, data]) => {
        const [week, category] = key.split("-");
        return {
          week: parseInt(week, 10),
          category,
          amount: data.amount,
          count: data.count,
        };
      });
    }

    const financeSettingsMetrics = isAdmin
      ? await buildFinanceSettingsMetrics({
          totalIncome,
          expensesThisMonth: paidExpensesThisMonth.map((expense) => ({
            amount: expense.amount,
            category: expense.category,
            paidByUserId: expense.paidByUserId ?? null,
          })),
          expenseTransactionsThisMonth: paidExpenseTransactionsThisMonth.map((transaction) => ({
            amount: transaction.amount,
            category: transaction.category ?? null,
            assignedToId: transaction.assignedToId ?? null,
          })),
        })
      : undefined;

    return {
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        netProfit,
        incomeDeltaPct,
        expensesDeltaPct,
        netProfitDeltaPct,
        marginDeltaPct,
        recentTransactions: transactions,
        ...(isAdmin && {
          totalHonorariosPaid,
          totalHonorariosPaidDeltaPct,
          heatmapData,
          financeSettingsMetrics,
        }),
        ...(userId && {
          pendingReimbursements,
          honorariosReceived,
          pendingReimbursementsDeltaPct,
          honorariosDeltaPct,
        }),
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener estadísticas financieras",
    };
  }
}

/**
 * Obtiene estadísticas de gastos con filtros opcionales
 */
export async function getExpensesStatsFromDb(filters?: {
  month?: string;
  userId?: string;
  clientId?: string;
  category?: string;
}): Promise<ApiResponse<ExpensesStatsData>> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const userRole = session?.user?.role;
    const isAdmin = userRole === "ADMIN";

    if (!userId) {
      return {
        success: false,
        error: "Usuario no autenticado",
      };
    }

    const now = new Date();
    const [selectedYear, selectedMonth] = filters?.month ? filters.month.split("-") : [];
    const parsedYear = selectedYear ? Number(selectedYear) : now.getFullYear();
    const parsedMonthIndex = selectedMonth ? Number(selectedMonth) - 1 : now.getMonth();
    const safeYear = Number.isNaN(parsedYear) ? now.getFullYear() : parsedYear;
    const safeMonthIndex = Number.isNaN(parsedMonthIndex) ? now.getMonth() : parsedMonthIndex;
    const monthStart = new Date(safeYear, safeMonthIndex, 1);
    const monthEnd = new Date(safeYear, safeMonthIndex + 1, 0, 23, 59, 59, 999);

    const expenseWhere: any = {
      date: {
        gte: monthStart,
        lte: monthEnd,
      },
    };

    if (filters?.userId && filters.userId !== "all") {
      expenseWhere.paidByUserId = filters.userId;
    } else if (!isAdmin) {
      expenseWhere.paidByUserId = userId;
    }

    if (filters?.clientId && filters.clientId !== "all") {
      expenseWhere.clientId = filters.clientId;
    }

    if (filters?.category && filters.category !== "all") {
      expenseWhere.category = filters.category;
    }

    const expensesThisMonth = await db.expense.findMany({
      where: expenseWhere,
      include: {
        paidByUser: true,
        client: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    const transactionWhere: any = {
      type: "EXPENSE",
      createdAt: {
        gte: monthStart,
        lte: monthEnd,
      },
    };

    if (filters?.userId && filters.userId !== "all") {
      transactionWhere.assignedToId = filters.userId;
    } else if (!isAdmin) {
      transactionWhere.assignedToId = userId;
    }

    if (filters?.clientId && filters.clientId !== "all") {
      transactionWhere.relatedClientId = filters.clientId;
      transactionWhere.clientId = filters.clientId;
    }

    if (filters?.category && filters.category !== "all") {
      transactionWhere.category = filters.category;
    }

    const expenseTransactionsThisMonth = await db.transaction.findMany({
      where: transactionWhere,
      include: {
        assignedTo: {
          select: {
            name: true,
          },
        },
        relatedClient: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const incomeWindowStart = monthStart;
    const incomeWindowEnd = monthEnd;

    const paidInvoices = isAdmin
      ? await db.invoice.findMany({
          where: {
            status: "PAID",
            generatedAt: {
              gte: incomeWindowStart,
              lte: incomeWindowEnd,
            },
          },
        })
      : [];

    const incomeTransactions = await db.transaction.findMany({
      where: {
        type: isAdmin ? "INCOME" : "HONORARIOS",
        status: "PAID",
        ...(!isAdmin && userId ? { userId } : {}),
        createdAt: {
          gte: incomeWindowStart,
          lte: incomeWindowEnd,
        },
      },
    });

    const totalIncome =
      paidInvoices.reduce((sum, invoice) => sum + invoice.amount, 0) +
      incomeTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);

    const financeSettingsMetrics = isAdmin
      ? await buildFinanceSettingsMetrics({
          totalIncome,
          expensesThisMonth: expensesThisMonth.map((expense) => ({
            amount: expense.amount,
            category: expense.category,
            paidByUserId: expense.paidByUserId,
          })),
          expenseTransactionsThisMonth: expenseTransactionsThisMonth.map((transaction) => ({
            amount: transaction.amount,
            category: transaction.category,
            assignedToId: transaction.assignedToId,
          })),
        })
      : undefined;

    const totalExpensesThisMonth =
      expensesThisMonth.reduce((sum, exp) => sum + exp.amount, 0) +
      expenseTransactionsThisMonth.reduce((sum, t) => sum + t.amount, 0);

    const pendingReimbursement =
      expensesThisMonth
        .filter((exp) => exp.paidByUserId && !exp.reimbursed)
        .reduce((sum, exp) => sum + exp.amount, 0) +
      expenseTransactionsThisMonth
        .filter((t) => t.assignedToId && t.status === "PENDING")
        .reduce((sum, t) => sum + t.amount, 0);

    const expenseMap = new Map<string, boolean>();
    expensesThisMonth.forEach((exp) => {
      if (exp.clientId && exp.paidByUserId) {
        const dateKey = exp.date.toISOString().split('T')[0];
        const key = `${exp.clientId}-${exp.paidByUserId}-${dateKey}-${exp.amount}`;
        expenseMap.set(key, true);
      }
    });

    const expensesList = [
      ...expensesThisMonth.map((exp) => ({
        id: exp.id,
        description: exp.description,
        amount: exp.amount,
        category: exp.category,
        date: exp.date,
        status: exp.reimbursed ? "REIMBURSED" : "PENDING",
        assignedToName: exp.paidByUser?.name,
        assignedToId: exp.paidByUserId ?? undefined,
        reimbursed: exp.reimbursed,
        sourceType: "EXPENSE" as const,
        clientName: exp.client?.name,
        clientId: exp.clientId ?? undefined,
      })),
      ...expenseTransactionsThisMonth
        .filter((t) => {
          if (t.relatedClientId && t.assignedToId) {
            const dateKey = t.createdAt.toISOString().split('T')[0];
            const key = `${t.relatedClientId}-${t.assignedToId}-${dateKey}-${t.amount}`;
            return !expenseMap.has(key);
          }
          return true;
        })
        .map((t) => ({
          id: t.id,
          description: t.description || "Gasto",
          amount: t.amount,
          category: t.category || "OTROS",
          date: t.createdAt,
          status: t.status,
          assignedToName: t.assignedTo?.name,
          assignedToId: t.assignedToId ?? undefined,
          reimbursed: t.status === "PAID",
          sourceType: "TRANSACTION" as const,
          clientName: t.relatedClient?.name,
          clientId: t.relatedClientId ?? undefined,
        })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    const categoryMap = new Map<string, number>();
    expensesList.forEach((exp) => {
      const current = categoryMap.get(exp.category) || 0;
      categoryMap.set(exp.category, current + exp.amount);
    });
    const categoryDistribution = Array.from(categoryMap.entries()).map(([category, amount]) => ({
      category,
      amount,
    }));

    const clientMap = new Map<string, number>();
    expensesThisMonth.forEach((exp) => {
      if (exp.client) {
        const current = clientMap.get(exp.client.name) || 0;
        clientMap.set(exp.client.name, current + exp.amount);
      }
    });
    expenseTransactionsThisMonth.forEach((t) => {
      if (t.relatedClient) {
        const current = clientMap.get(t.relatedClient.name) || 0;
        clientMap.set(t.relatedClient.name, current + t.amount);
      }
    });
    const clientDistribution = Array.from(clientMap.entries()).map(([clientName, amount]) => ({
      clientName,
      amount,
    }));

    return {
      success: true,
      data: {
        totalExpensesThisMonth,
        pendingReimbursement,
        expenses: expensesList,
        categoryDistribution,
        clientDistribution,
        financeSettingsMetrics,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener estadísticas de gastos",
    };
  }
}

/**
 * Obtiene estadísticas de rentabilidad global con datos mensuales
 */
export async function getGlobalProfitabilityStatsFromDb(): Promise<
  ApiResponse<GlobalProfitabilityStatsData>
> {
  try {
    const now = new Date();

    const months: Array<{ year: number; month: number; start: Date; end: Date }> = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
      months.push({
        year: date.getFullYear(),
        month: date.getMonth(),
        start,
        end,
      });
    }

    const monthlyData: MonthlyProfitability[] = await Promise.all(
      months.map(async ({ year, month, start, end }) => {
        const incomeInvoices = await db.invoice.findMany({
          where: {
            status: "PAID",
            generatedAt: {
              gte: start,
              lte: end,
            },
          },
        });

        const incomeTransactions = await db.transaction.findMany({
          where: {
            type: "INCOME",
            status: "PAID",
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        });

        const income =
          incomeInvoices.reduce((sum, inv) => sum + inv.amount, 0) +
          incomeTransactions.reduce((sum, t) => sum + t.amount, 0);

        const expenses = await db.expense.findMany({
          where: {
            date: {
              gte: start,
              lte: end,
            },
            reimbursed: true,
          },
        });

        const expenseTransactions = await db.transaction.findMany({
          where: {
            type: "EXPENSE",
            status: "PAID",
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        });

        const honorariosTransactions = await db.transaction.findMany({
          where: {
            type: "HONORARIOS",
            status: "PAID",
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        });

        const expensesTotal =
          expenses.reduce((sum, e) => sum + e.amount, 0) +
          expenseTransactions.reduce((sum, t) => sum + t.amount, 0) +
          honorariosTransactions.reduce((sum, t) => sum + t.amount, 0);

        const profit = income - expensesTotal;

        const monthNames = [
          "Enero",
          "Febrero",
          "Marzo",
          "Abril",
          "Mayo",
          "Junio",
          "Julio",
          "Agosto",
          "Septiembre",
          "Octubre",
          "Noviembre",
          "Diciembre",
        ];

        return {
          month: `${monthNames[month]} ${year}`,
          monthKey: `${year}-${String(month + 1).padStart(2, "0")}`,
          income,
          expenses: expensesTotal,
          profit,
        };
      })
    );

    const currentMonth = monthlyData[monthlyData.length - 1];
    const totalIncome = currentMonth.income;
    const totalExpenses = currentMonth.expenses;
    const netProfit = currentMonth.profit;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    const partnerDistribution = {
      stuart: netProfit * 0.5,
      paty: netProfit * 0.5,
    };

    return {
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        netProfit,
        profitMargin,
        monthlyData,
        partnerDistribution,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener estadísticas de rentabilidad global",
    };
  }
}
