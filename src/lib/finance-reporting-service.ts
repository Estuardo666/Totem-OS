"use strict";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sumCurrency(values: number[]): number {
  return roundCurrency(values.reduce((sum, value) => sum + value, 0));
}

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
  cashBalance: number;
  /** Facturas emitidas que siguen PENDING u OVERDUE; no incluye cierres mensuales sin factura. */
  pendingInvoicingAmount?: number;
  pendingInvoicingCount?: number;
  incomeDeltaPct?: number;
  expensesDeltaPct?: number;
  netProfitDeltaPct?: number;
  cashBalanceDeltaPct?: number;
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
  closureControl?: {
    pendingCount: number;
    pendingAmount: number;
    pendingClients: Array<{
      id: string;
      name: string;
      monthlyRate: number;
    }>;
    currentMonthLabel: string;
  };
}

type RecurringClientRow = {
  id: string;
  name: string;
  monthlyRate: number;
};

type ClosureClientRow = {
  clientId: string;
};

/**
 * Interfaz para estadísticas de gastos
 */
export interface ExpensesStatsData {
  totalExpensesThisMonth: number;
  pendingReimbursement: number;
  previousMonthTotal: number;
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
    clientName?: string;
    clientId?: string;
    sourceType?: "EXPENSE" | "TRANSACTION";
  }>;
  categoryDistribution: Array<{
    category: string;
    amount: number;
  }>;
  clientDistribution: Array<{
    clientName: string;
    amount: number;
  }>;
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
    const currentMonthLabel = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(monthStart);
    let recurringClients: RecurringClientRow[] = [];
    let currentMonthClosures: ClosureClientRow[] = [];

    if (isAdmin) {
      [recurringClients, currentMonthClosures] = await Promise.all([
        db.client.findMany({
          where: {
            monthlyRate: { gt: 0 },
            paymentDay: { not: null },
            status: { notIn: ["PAUSED", "INACTIVE"] },
          },
          select: {
            id: true,
            name: true,
            monthlyRate: true,
          },
        }),
        db.$queryRaw<Array<ClosureClientRow>>`
          SELECT "clientId"
          FROM "ClientMonthlyClosure"
          WHERE "year" = ${now.getFullYear()}
            AND "month" = ${now.getMonth() + 1}
        `,
      ]);
    }

    const closureClientIds = new Set(currentMonthClosures.map((closure: ClosureClientRow) => closure.clientId));
    const pendingClosureClients = recurringClients.filter((client: RecurringClientRow) => !closureClientIds.has(client.id));

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

    // La métrica del Home debe reflejar facturas realmente emitidas y aún no pagadas.
    // `closureControl.pendingAmount` representa fees recurrentes sin cierre y no es equivalente.
    const pendingInvoices = isAdmin
      ? await db.invoice.findMany({
          where: { status: { in: ["PENDING", "OVERDUE"] } },
          select: { amount: true },
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
    const totalIncome = sumCurrency([
      paidInvoicesThisMonth.reduce((sum, invoice) => sum + invoice.amount, 0),
      paidTransactionsThisMonth.reduce((sum, transaction) => sum + transaction.amount, 0),
    ]);

    const prevTotalIncome = sumCurrency([
      paidInvoicesPrevMonth.reduce((sum, invoice) => sum + invoice.amount, 0),
      paidTransactionsPrevMonth.reduce((sum, transaction) => sum + transaction.amount, 0),
    ]);

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

    // Todas las transacciones EXPENSE del mes (PAID + PENDING) — para Saldo en Caja
    const allExpenseTransactionsThisMonth = isAdmin
      ? await db.transaction.findMany({
          where: {
            type: "EXPENSE",
            createdAt: { gte: monthStart, lte: monthEnd },
          },
          select: { amount: true },
        })
      : [];

    const allExpenseTransactionsPrevMonth = isAdmin
      ? await db.transaction.findMany({
          where: {
            type: "EXPENSE",
            createdAt: { gte: prevMonthStart, lte: prevMonthEnd },
          },
          select: { amount: true },
        })
      : [];

    // Calcular gastos totales
    const totalExpenses = sumCurrency([
      paidExpensesThisMonth.reduce((sum, expense) => sum + expense.amount, 0),
      paidExpenseTransactionsThisMonth.reduce((sum, transaction) => sum + transaction.amount, 0),
      paidHonorariosThisMonth.reduce((sum, transaction) => sum + transaction.amount, 0),
    ]);

    const prevTotalExpenses = sumCurrency([
      paidExpensesPrevMonth.reduce((sum, expense) => sum + expense.amount, 0),
      paidExpenseTransactionsPrevMonth.reduce((sum, transaction) => sum + transaction.amount, 0),
      paidHonorariosPrevMonth.reduce((sum, transaction) => sum + transaction.amount, 0),
    ]);

    // Calcular ganancias netas
    const netProfit = roundCurrency(totalIncome - totalExpenses);
    const prevNetProfit = roundCurrency(prevTotalIncome - prevTotalExpenses);

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

    const cashBalance = isAdmin
      ? roundCurrency(
          totalIncome -
            sumCurrency(paidExpensesThisMonth.map((e) => e.amount)) -
            sumCurrency(allExpenseTransactionsThisMonth.map((t) => t.amount)) -
            sumCurrency(paidHonorariosThisMonth.map((t) => t.amount))
        )
      : netProfit;
    const prevCashBalance = isAdmin
      ? roundCurrency(
          prevTotalIncome -
            sumCurrency(paidExpensesPrevMonth.map((e) => e.amount)) -
            sumCurrency(allExpenseTransactionsPrevMonth.map((t) => t.amount)) -
            sumCurrency(paidHonorariosPrevMonth.map((t) => t.amount))
        )
      : prevNetProfit;
    const cashBalanceDeltaPct = calculateDeltaPct(cashBalance, prevCashBalance);

    // Calcular honorarios totales pagados (para ADMIN)
    let totalHonorariosPaid: number | undefined;
    let totalHonorariosPaidDeltaPct: number | undefined;

    if (isAdmin) {
      totalHonorariosPaid = sumCurrency(paidHonorariosThisMonth.map((t) => t.amount));
      const prevTotalHonorariosPaid = sumCurrency(paidHonorariosPrevMonth.map((t) => t.amount));
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
          ...(isAdmin
            ? { assignedToId: { not: null } }
            : { assignedToId: userId }),
          ...(isAdmin
            ? {
                createdAt: {
                  gte: monthStart,
                  lte: monthEnd,
                },
              }
            : {}),
        },
      });

      const pendingExpenseTransactionsPrevWeek = await db.transaction.findMany({
        where: {
          type: "EXPENSE",
          status: "PENDING",
          ...(isAdmin
            ? { assignedToId: { not: null } }
            : { assignedToId: userId }),
          createdAt: isAdmin
            ? {
                gte: monthStart,
                lte: prevWeekEnd,
              }
            : {
                gte: prevWeekStart,
                lte: prevWeekEnd,
              },
        },
      });

      const pendingExpenses = await db.expense.findMany({
        where: {
          reimbursed: false,
          ...(isAdmin ? { paidByUserId: { not: null } } : { paidByUserId: userId }),
          ...(isAdmin
            ? {
                date: {
                  gte: monthStart,
                  lte: monthEnd,
                },
              }
            : {}),
        },
      });

      const pendingExpensesPrevWeek = await db.expense.findMany({
        where: {
          reimbursed: false,
          ...(isAdmin ? { paidByUserId: { not: null } } : { paidByUserId: userId }),
          date: isAdmin
            ? {
                gte: monthStart,
                lte: prevWeekEnd,
              }
            : {
                gte: prevWeekStart,
                lte: prevWeekEnd,
              },
        },
      });

      pendingReimbursements = sumCurrency([
        pendingExpenseTransactions.reduce((sum, t) => sum + t.amount, 0),
        pendingExpenses.reduce((sum, e) => sum + e.amount, 0),
      ]);

      const pendingReimbursementsPrevWeek = sumCurrency([
        pendingExpenseTransactionsPrevWeek.reduce((sum, t) => sum + t.amount, 0),
        pendingExpensesPrevWeek.reduce((sum, e) => sum + e.amount, 0),
      ]);

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

      honorariosReceived = sumCurrency(honorariosThisMonth.map((t) => t.amount));
      const honorariosPrev = sumCurrency(honorariosPrevMonth.map((t) => t.amount));
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

    return {
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        netProfit,
        cashBalance,
        ...(isAdmin && {
          pendingInvoicingAmount: sumCurrency(pendingInvoices.map((invoice) => invoice.amount)),
          pendingInvoicingCount: pendingInvoices.length,
        }),
        incomeDeltaPct,
        expensesDeltaPct,
        netProfitDeltaPct,
        cashBalanceDeltaPct,
        marginDeltaPct,
        recentTransactions: transactions,
        ...(isAdmin && {
          totalHonorariosPaid,
          totalHonorariosPaidDeltaPct,
          heatmapData,
          closureControl: {
            pendingCount: pendingClosureClients.length,
            pendingAmount: pendingClosureClients.reduce((sum: number, client: RecurringClientRow) => sum + client.monthlyRate, 0),
            pendingClients: pendingClosureClients,
            currentMonthLabel,
          },
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

    let monthStart: Date;
    let monthEnd: Date;

    if (filters?.month && filters.month !== "all") {
      const [year, month] = filters.month.split("-").map(Number);
      monthStart = new Date(year, month - 1, 1);
      monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    } else {
      const now = new Date();
      monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

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

    const totalExpensesThisMonth = expensesThisMonth.reduce((sum, exp) => sum + exp.amount, 0);

    const pendingReimbursement = expensesThisMonth
      .filter((exp) => exp.paidByUserId && !exp.reimbursed)
      .reduce((sum, exp) => sum + exp.amount, 0);

    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthEnd = new Date(monthStart);
    prevMonthEnd.setDate(prevMonthEnd.getDate() - 1);
    prevMonthEnd.setHours(23, 59, 59, 999);

    const prevMonthWhere: any = {
      date: { gte: prevMonthStart, lte: prevMonthEnd },
    };
    if (filters?.userId && filters.userId !== "all") {
      prevMonthWhere.paidByUserId = filters.userId;
    } else if (!isAdmin) {
      prevMonthWhere.paidByUserId = userId;
    }
    if (filters?.clientId && filters.clientId !== "all") {
      prevMonthWhere.clientId = filters.clientId;
    }
    if (filters?.category && filters.category !== "all") {
      prevMonthWhere.category = filters.category;
    }

    const expensesPrevMonth = await db.expense.findMany({
      where: prevMonthWhere,
      select: { amount: true },
    });
    const previousMonthTotal = expensesPrevMonth.reduce((sum, exp) => sum + exp.amount, 0);

    const expensesList = expensesThisMonth
      .map((exp) => ({
        id: exp.id,
        description: exp.description,
        amount: exp.amount,
        category: exp.category,
        date: exp.date,
        status: exp.reimbursed ? "REIMBURSED" : "PENDING",
        assignedToName: exp.paidByUser?.name,
        assignedToId: exp.paidByUserId ?? undefined,
        reimbursed: exp.reimbursed,
        clientName: exp.client?.name,
        clientId: exp.clientId ?? undefined,
        sourceType: "EXPENSE" as const,
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

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
      } else {
        const current = clientMap.get("Sin cliente") || 0;
        clientMap.set("Sin cliente", current + exp.amount);
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
        previousMonthTotal,
        expenses: expensesList,
        categoryDistribution,
        clientDistribution,
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
