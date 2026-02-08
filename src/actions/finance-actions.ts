"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  createInvoiceSchema,
  createExpenseSchema,
  updateExpenseSchema,
  updateTransactionSchema,
  updateInvoiceSchema,
  createTransactionSchema,
  updateUserSalaryConfigSchema,
  processSalaryPaymentSchema,
} from "@/schemas/finance";
import type { ApiResponse } from "@/types";
import type { User, Transaction } from "@prisma/client";

// Import services
import {
  createInvoiceInDb,
  registerPaymentInDb,
  markInvoiceAsPaidInDb,
  updateInvoiceInDb,
  getInvoiceByIdFromDb,
} from "@/lib/finance-invoice-service";

import {
  createExpenseInDb,
  updateExpenseInDb,
  markExpenseAsReimbursedInDb,
  liquidateExpenseReimbursements,
  getExpenseByIdFromDb,
} from "@/lib/finance-expense-service";

import {
  createTransactionInDb,
  updateTransactionInDb,
  markTransactionAsPaidInDb,
  cancelTransactionInDb,
  getTransactionByIdFromDb,
  getReceivablesFromDb,
} from "@/lib/finance-transaction-service";

import {
  getFinancialStatsFromDb,
  getExpensesStatsFromDb,
  getGlobalProfitabilityStatsFromDb,
} from "@/lib/finance-reporting-service";

// Type definitions
export interface FinancialStats {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
}

export interface GlobalProfitabilityStats {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
}

export interface StrategicClientPlan {
  id: string;
  name: string;
  status: string;
}

export interface UserSettlementReport {
  userId: string;
  userName: string;
  userRole: string;
  salaryType: string;
  salary: number;
  reimbursements: number;
  paidSoFar: number;
  remaining: number;
}

/**
 * Server Action wrapper para obtener planes estratégicos de clientes
 * Solo retorna clientes asociados al usuario (si es EDITOR)
 */
export async function getStrategicClientPlans():
  Promise<ApiResponse<Array<{ id: string; name: string; status: string }>>> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const userRole = session?.user?.role;
    const isEditor = userRole === "EDITOR";

    const clients = await db.client.findMany({
      where: {
        ...(isEditor && userId ? { editorId: userId } : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        monthlyRate: true,
        monthlyReels: true,
        monthlyShoots: true,
      },
      orderBy: { name: "asc" },
    });

    return { success: true, data: clients };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al cargar planes de clientes",
    };
  }
}

// ============ INVOICE OPERATIONS ============

export async function createInvoice(input: unknown): Promise<ApiResponse<any>> {
  try {
    const validatedData = createInvoiceSchema.parse(input);
    const invoice = await createInvoiceInDb({
      amount: validatedData.amount,
      status: validatedData.status as any,
      clientId: validatedData.clientId,
      dueDate: validatedData.dueDate,
      generatedAt: validatedData.generatedAt,
    });
    revalidatePath("/finance");
    return { success: true, data: invoice };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al crear factura",
    };
  }
}

export async function registerPayment(
  invoiceId: string,
  amount: number
): Promise<ApiResponse<any>> {
  try {
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      return { success: false, error: "Factura no encontrada" };
    }
    await registerPaymentInDb({ amount, clientId: invoice.clientId });
    revalidatePath("/finance");
    return { success: true, data: invoice };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al registrar pago",
    };
  }
}

export async function markInvoiceAsPaid(invoiceId: string): Promise<ApiResponse<any>> {
  try {
    const invoice = await markInvoiceAsPaidInDb(invoiceId);
    revalidatePath("/finance");
    return { success: true, data: invoice };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al marcar como pagada",
    };
  }
}

export async function updateInvoice(
  id: string,
  input: unknown
): Promise<ApiResponse<any>> {
  try {
    const validatedData = updateInvoiceSchema.parse(input);
    const invoice = await updateInvoiceInDb(id, validatedData as any)
    revalidatePath("/finance");
    return { success: true, data: invoice };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar factura",
    };
  }
}

export async function getInvoiceById(invoiceId: string): Promise<ApiResponse<any>> {
  try {
    const invoice = await getInvoiceByIdFromDb(invoiceId);
    if (!invoice) {
      return { success: false, error: "Factura no encontrada" };
    }
    return { success: true, data: invoice };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener factura",
    };
  }
}

// ============ EXPENSE OPERATIONS ============

export async function createExpense(input: unknown): Promise<ApiResponse<any>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "No autorizado" };
    }

    const validatedData = createExpenseSchema.parse(input);
    const expense = await createExpenseInDb({
      ...validatedData,
      createdByUserId: session.user.id,
      isEditor: session.user.role === "EDITOR",
    });
    revalidatePath("/finance");
    return { success: true, data: expense };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al crear gasto",
    };
  }
}

export async function updateExpense(
  id: string,
  input: unknown
): Promise<ApiResponse<any>> {
  try {
    const validatedData = updateExpenseSchema.parse(input);
    const expense = await updateExpenseInDb(id, validatedData as any);
    revalidatePath("/finance");
    return { success: true, data: expense };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar gasto",
    };
  }
}

export async function markExpenseAsReimbursed(
  expenseId: string
): Promise<ApiResponse<any>> {
  try {
    const expense = await markExpenseAsReimbursedInDb(expenseId);
    revalidatePath("/finance");
    return { success: true, data: expense };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al marcar como reembolsado",
    };
  }
}

export async function liquidateReimbursements(
  userIds: string[]
): Promise<ApiResponse<any>> {
  try {
    const result = await liquidateExpenseReimbursements(userIds);
    revalidatePath("/finance");
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al liquidar reembolsos",
    };
  }
}

export async function getExpenseById(expenseId: string): Promise<ApiResponse<any>> {
  try {
    const expense = await getExpenseByIdFromDb(expenseId);
    if (!expense) {
      return { success: false, error: "Gasto no encontrado" };
    }
    return { success: true, data: expense };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener gasto",
    };
  }
}

// ============ TRANSACTION OPERATIONS ============

export async function createTransaction(input: unknown): Promise<ApiResponse<any>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "No autorizado" };
    }

    const validatedData = createTransactionSchema.parse(input);
    const transaction = await createTransactionInDb(validatedData, session.user.id, session.user.role);
    revalidatePath("/finance");
    return { success: true, data: transaction };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al crear transacción",
    };
  }
}

export async function updateTransaction(
  id: string,
  input: unknown
): Promise<ApiResponse<any>> {
  try {
    const validatedData = updateTransactionSchema.parse(input);
    const transaction = await updateTransactionInDb(id, validatedData);
    revalidatePath("/finance");
    return { success: true, data: transaction };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar transacción",
    };
  }
}

export async function markTransactionAsPaid(
  transactionId: string
): Promise<ApiResponse<any>> {
  try {
    const transaction = await markTransactionAsPaidInDb(transactionId);
    revalidatePath("/finance");
    return { success: true, data: transaction };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al marcar como pagada",
    };
  }
}

export async function cancelTransaction(
  transactionId: string
): Promise<ApiResponse<any>> {
  try {
    const transaction = await cancelTransactionInDb(transactionId);
    revalidatePath("/finance");
    return { success: true, data: transaction };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al cancelar transacción",
    };
  }
}

export async function getTransactionById(
  transactionId: string
): Promise<ApiResponse<any>> {
  try {
    const transaction = await getTransactionByIdFromDb(transactionId);
    if (!transaction) {
      return { success: false, error: "Transacción no encontrada" };
    }
    return { success: true, data: transaction };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener transacción",
    };
  }
}

export async function getReceivables(): Promise<ApiResponse<any>> {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return { success: false, error: "Usuario no autenticado" };
    }

    const result = await getReceivablesFromDb(userId);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener cuentas por cobrar",
    };
  }
}

export async function getClientAccountStatus(
  clientId: string
): Promise<ApiResponse<any>> {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const clientInvoices = await db.invoice.findMany({
      where: { clientId },
      include: { client: true },
      orderBy: { generatedAt: "desc" },
    });

    const clientTransactions = await db.transaction.findMany({
      where: {
        relatedClientId: clientId,
        type: "INCOME",
      },
      include: {
        relatedClient: true,
        assignedTo: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const pendingDebts = [
      ...clientInvoices
        .filter((inv) => inv.status === "PENDING")
        .map((inv) => {
          const invoiceDate = new Date(inv.generatedAt);
          const daysDiff = Math.floor(
            (today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          return {
            id: inv.id,
            description: `Factura - ${inv.client.name}`,
            amount: inv.amount,
            date: invoiceDate,
            daysOverdue: daysDiff > 0 ? daysDiff : 0,
            sourceType: "INVOICE" as const,
          };
        }),
      ...clientTransactions
        .filter((t) => t.status === "PENDING")
        .map((t) => {
          const transactionDate = new Date(t.createdAt);
          const daysDiff = Math.floor(
            (today.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          return {
            id: t.id,
            description: t.description || "Transacción",
            amount: t.amount,
            date: transactionDate,
            daysOverdue: daysDiff > 0 ? daysDiff : 0,
            sourceType: "TRANSACTION" as const,
          };
        }),
    ].sort((a, b) => b.daysOverdue - a.daysOverdue);

    const paymentHistory = [
      ...clientInvoices
        .filter((inv) => inv.status === "PAID")
        .map((inv) => ({
          id: inv.id,
          description: `Factura - ${inv.client.name}`,
          amount: inv.amount,
          date: new Date(inv.generatedAt),
          status: inv.status,
          sourceType: "INVOICE" as const,
        })),
      ...clientTransactions
        .filter((t) => t.status === "PAID")
        .map((t) => ({
          id: t.id,
          description: t.description || "Transacción",
          amount: t.amount,
          date: new Date(t.createdAt),
          status: t.status,
          sourceType: "TRANSACTION" as const,
        })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      success: true,
      data: { pendingDebts, paymentHistory },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener estado de cuenta",
    };
  }
}

// ============ REPORTING OPERATIONS ============

export async function getFinancialStats(): Promise<ApiResponse<any>> {
  return getFinancialStatsFromDb();
}

export async function getExpensesStats(filters?: {
  month?: string;
  userId?: string;
  clientId?: string;
  category?: string;
}): Promise<ApiResponse<any>> {
  return getExpensesStatsFromDb(filters);
}

export async function getGlobalProfitabilityStats(): Promise<ApiResponse<any>> {
  return getGlobalProfitabilityStatsFromDb();
}

// ============ SALARY & SETTLEMENT OPERATIONS ============

export async function updateUserSalaryConfig(
  userId: string,
  input: unknown
): Promise<ApiResponse<User>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "No tienes permisos para realizar esta acción",
      };
    }

    const validatedData = updateUserSalaryConfigSchema.parse(input);

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, error: "Usuario no encontrado" };
    }

    const updateData: any = {};

    if (validatedData.salaryType !== undefined) {
      updateData.salaryType = validatedData.salaryType;
    }
    if (validatedData.baseSalary !== undefined) {
      updateData.baseSalary = validatedData.baseSalary;
    }
    if (validatedData.hourlyRate !== undefined) {
      updateData.hourlyRate = validatedData.hourlyRate;
    }
    if (validatedData.profitSharePercent !== undefined) {
      updateData.profitSharePercent = validatedData.profitSharePercent;
    }
    if (validatedData.bankAccountInfo !== undefined) {
      updateData.bankAccountInfo = validatedData.bankAccountInfo;
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
    });

    if (validatedData.hourlyRate !== undefined) {
      await db.timeEntry.updateMany({
        where: { userId: userId, status: "RUNNING" },
        data: { hourlyRate: validatedData.hourlyRate },
      });
    }

    revalidatePath("/admin/users");
    revalidatePath("/finance/settlement");
    revalidatePath("/chronos");

    return { success: true, data: updatedUser };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar configuración salarial",
    };
  }
}

export async function getSettlementReport(
  month: number,
  year: number
): Promise<ApiResponse<any[]>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "No autorizado" };
    }

    const currentUserId = session.user.id;
    const isAdmin = session.user.role === "ADMIN";

    const monthStart = new Date(year, month - 1, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        salaryType: true,
        baseSalary: true,
        hourlyRate: true,
        profitSharePercent: true,
      },
    });

    const paidInvoices = await db.invoice.findMany({
      where: {
        status: "PAID",
        generatedAt: { gte: monthStart, lte: monthEnd },
      },
    });

    const paidIncomeTransactions = await db.transaction.findMany({
      where: {
        type: "INCOME",
        status: "PAID",
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    });

    const totalIncome =
      paidInvoices.reduce((sum, inv) => sum + inv.amount, 0) +
      paidIncomeTransactions.reduce((sum, t) => sum + t.amount, 0);

    const reimbursedExpenses = await db.expense.findMany({
      where: {
        reimbursed: true,
        date: { gte: monthStart, lte: monthEnd },
      },
    });

    const paidExpenseTransactions = await db.transaction.findMany({
      where: {
        type: "EXPENSE",
        status: "PAID",
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    });

    const paidHonorariosTransactions = await db.transaction.findMany({
      where: {
        type: "HONORARIOS",
        status: "PAID",
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    });

    const totalExpenses =
      reimbursedExpenses.reduce((sum, e) => sum + e.amount, 0) +
      paidExpenseTransactions.reduce((sum, t) => sum + t.amount, 0) +
      paidHonorariosTransactions.reduce((sum, t) => sum + t.amount, 0);

    const netIncome = totalIncome - totalExpenses;

    const allPaidTransactionsThisMonth = await db.transaction.findMany({
      where: {
        status: "PAID",
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    });

    const settlementReports = await Promise.all(
      users.map(async (user) => {
        let salary = 0;
        let reimbursements = 0;
        let paidSoFar = 0;

        if (user.salaryType === "MONTHLY") {
          salary = user.baseSalary ?? 0;
        } else if (user.salaryType === "HOURLY") {
          const timeEntries = await db.timeEntry.findMany({
            where: {
              userId: user.id,
              status: "COMPLETED",
              startTime: { gte: monthStart, lte: monthEnd },
            },
            select: { duration: true },
          });

          const totalHours = timeEntries.reduce(
            (sum, entry) => sum + (entry.duration ?? 0) / 3600,
            0
          );
          salary = totalHours * (user.hourlyRate ?? 0);
        } else if (user.salaryType === "PROFIT_SHARE") {
          const profitSharePercent = user.profitSharePercent ?? 0;
          salary = netIncome * (profitSharePercent / 100);
        }

        const pendingExpenses = await db.expense.findMany({
          where: { paidByUserId: user.id, reimbursed: false },
        });

        reimbursements = pendingExpenses.reduce(
          (sum, exp) => sum + exp.amount,
          0
        );

        const userPaidTransactions = allPaidTransactionsThisMonth.filter(
          (t) =>
            t.userId === user.id &&
            (t.type === "HONORARIOS" ||
              (t.type === "EXPENSE" && t.category === "SALARY"))
        );

        paidSoFar = userPaidTransactions.reduce((sum, t) => sum + t.amount, 0);
        const remaining = salary + reimbursements - paidSoFar;

        return {
          userId: user.id,
          userName: user.name,
          userRole: "STAFF",
          salaryType: user.salaryType ?? "MONTHLY",
          salary,
          reimbursements,
          paidSoFar,
          remaining: Math.max(0, remaining),
        };
      })
    );

    let filteredReports = settlementReports;
    if (!isAdmin) {
      filteredReports = filteredReports.filter(
        (r) => r.userId === currentUserId
      );
    }

    return { success: true, data: filteredReports };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener reporte de liquidación",
    };
  }
}

export async function processSalaryPayment(
  input: unknown
): Promise<ApiResponse<Transaction>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "No tienes permisos para realizar esta acción",
      };
    }

    const validatedData = processSalaryPaymentSchema.parse(input);

    const recipientUser = await db.user.findUnique({
      where: { id: validatedData.recipientUserId },
      select: { id: true, name: true, salaryType: true },
    });

    if (!recipientUser) {
      return { success: false, error: "Usuario receptor no encontrado" };
    }

    const transactionType =
      recipientUser.salaryType === "PROFIT_SHARE" ? "HONORARIOS" : "EXPENSE";

    const transaction = await db.transaction.create({
      data: {
        amount: validatedData.amount,
        type: transactionType,
        status: "PAID",
        description:
          validatedData.description ||
          `Pago de ${transactionType === "HONORARIOS" ? "honorarios" : "salario"} - ${validatedData.month}/${validatedData.year}`,
        category: transactionType === "EXPENSE" ? "SALARY" : undefined,
        userId: validatedData.recipientUserId,
      },
    });

    if (validatedData.includeReimbursements) {
      await db.expense.updateMany({
        where: {
          paidByUserId: validatedData.recipientUserId,
          reimbursed: false,
        },
        data: { reimbursed: true },
      });
    }

    revalidatePath("/finance/settlement");
    revalidatePath("/finance");

    return { success: true, data: transaction };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al procesar pago de salario",
    };
  }
}

