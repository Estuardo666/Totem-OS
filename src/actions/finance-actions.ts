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
import type {
  ExpensesStatsData,
  FinancialStats as FinancialStatsData,
  GlobalProfitabilityStatsData,
} from "@/lib/finance-reporting-service";
import {
  getFinanceDashboardPeriodSnapshotsFromDb,
  getMonthlyFinancialSummaryFromDb,
} from "@/lib/finance-monthly-summary-service";
export type { MonthlyFinancialSummaryData } from "@/lib/finance-monthly-summary-types";
export type { FinanceDashboardPeriodSnapshot } from "@/lib/finance-monthly-summary-service";
import {
  getClientMonthlyClosuresFromDb,
  upsertClientMonthlyClosureFromDb,
} from "@/lib/finance-monthly-close-service";
import {
  canReadStrategicClientAnalytics,
  getCurrentEcuadorMonthRange,
  getStrategicClientScope,
} from "@/lib/finance-strategic-access";
export type {
  ClientMonthlyClosurePageData,
  MonthlyClosureAccrualStatus,
} from "@/lib/finance-monthly-close-service";

// Type definitions
export type FinancialStats = FinancialStatsData;

export type GlobalProfitabilityStats = GlobalProfitabilityStatsData;

export interface StrategicClientPlan {
  id: string;
  name: string;
  status: string;
  logo: string | null;
  monthlyRate: number;
  monthlyReels: number;
  monthlyFlyers: number;
  monthlyShoots: number;
  paymentDay: number | null;
  billingStartDate: Date | null;
}

export interface StrategicClientAnalyticsPlan extends StrategicClientPlan {
  invoices: Array<{
    amount: number;
    status: string;
    dueDate: Date | null;
  }>;
  completedReels: number;
  completedShootings: number;
}

export interface UserSettlementReport {
  userId: string;
  userName: string;
  userRole: string;
  salaryType: string;
  salary: number;
  profitShare: number;
  profitSharePercent: number;
  reimbursements: number;
  paidSoFar: number;
  remaining: number;
}

function revalidateFinanceViews() {
  revalidatePath("/finance");
  revalidatePath("/finance/transactions");
  revalidatePath("/finance/monthly-close");
  revalidatePath("/finance/monthly-summary");
  revalidatePath("/finance/receivables");
}

/**
 * Server Action wrapper para obtener planes estratégicos de clientes
 * Solo retorna clientes asociados al usuario (si es EDITOR)
 */
export async function getStrategicClientPlans():
  Promise<ApiResponse<StrategicClientPlan[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado" };
    }

    const userRole = session.user.roleLegacy ?? session.user.role;
    const clientScope = getStrategicClientScope(session.user.id, userRole);
    if (!clientScope) {
      return { success: false, error: "No autorizado" };
    }

    const clients = await db.client.findMany({
      where: clientScope,
      select: {
        id: true,
        name: true,
        status: true,
        logo: true,
        monthlyRate: true,
        monthlyReels: true,
        monthlyFlyers: true,
        monthlyShoots: true,
        paymentDay: true,
        billingStartDate: true,
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

/**
 * Datos acotados para Analíticas IA. Los montos de facturas sólo se exponen a
 * administradores y los entregables corresponden al mes vigente en Ecuador.
 */
export async function getStrategicClientAnalyticsPlans():
  Promise<ApiResponse<StrategicClientAnalyticsPlan[]>> {
  try {
    const session = await auth();
    const userRole = session?.user?.roleLegacy ?? session?.user?.role;
    if (!canReadStrategicClientAnalytics(session?.user?.id, userRole)) {
      return {
        success: false,
        error: session?.user ? "No autorizado" : "No autenticado",
      };
    }

    const { start, end } = getCurrentEcuadorMonthRange();
    const clients = await db.client.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        logo: true,
        monthlyRate: true,
        monthlyReels: true,
        monthlyFlyers: true,
        monthlyShoots: true,
        paymentDay: true,
        billingStartDate: true,
        invoices: {
          where: {
            OR: [
              { status: { in: ["PENDING", "OVERDUE"] } },
              { status: "PAID", generatedAt: { gte: start, lt: end } },
            ],
          },
          select: { amount: true, status: true, dueDate: true },
        },
        tasks: {
          where: {
            type: "REEL",
            status: "PUBLISHED",
            publishedAt: { gte: start, lt: end },
          },
          select: { id: true },
        },
        shootings: {
          where: {
            status: "COMPLETED",
            startTime: { gte: start, lt: end },
          },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const analyticsPlans = clients.map(({ tasks, shootings, ...client }) => ({
      ...client,
      completedReels: tasks.length,
      completedShootings: shootings.length,
    }));

    return { success: true, data: analyticsPlans };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al cargar analíticas de clientes",
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
    revalidateFinanceViews();
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
    revalidateFinanceViews();
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
    revalidateFinanceViews();
    return { success: true, data: invoice };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al marcar como pagada",
    };
  }
}

/**
 * Marca una transacción recurrente como pagada:
 * 1. Crea una factura PAID con generatedAt del mes/año correspondiente (historial)
 * 2. Inserta una excepción MARK_AS_PAID (elimina de Por Cobrar)
 * El ID tiene formato: recurring-{clientId}-{year}-{month}
 */
export async function markRecurringAsPaid(
  recurringId: string,
  amount: number
): Promise<ApiResponse<any>> {
  try {
    const match = recurringId.match(/^recurring-(.+)-(\d{4})-(\d{1,2})$/);
    if (!match) {
      return { success: false, error: "ID de transacción recurrente inválido" };
    }

    const [, clientId, yearStr, monthStr] = match;
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { id: true, paymentDay: true, name: true },
    });

    if (!client) {
      return { success: false, error: "Cliente no encontrado" };
    }

    const paymentDay = client.paymentDay ?? 1;
    const lastDay = new Date(year, month, 0).getDate();
    const day = Math.min(paymentDay, lastDay);
    const generatedAt = new Date(year, month - 1, day);

    // 1. Create PAID invoice for transaction history
    await createInvoiceInDb({
      amount,
      status: "PAID",
      clientId,
      generatedAt,
    });

    // 2. Insert MARK_AS_PAID billing exception (removes from receivables)
    await db.$executeRaw`
      INSERT INTO "ClientBillingException" ("id", "clientId", "year", "month", "type", "reason", "createdAt", "updatedAt")
      VALUES (${`cbe-${clientId}-${year}-${month}`}, ${clientId}, ${year}, ${month}, 'MARK_AS_PAID', 'Marcado como pagado desde Por Cobrar', NOW(), NOW())
      ON CONFLICT ("clientId", "year", "month")
      DO UPDATE SET "type" = 'MARK_AS_PAID', "reason" = 'Marcado como pagado desde Por Cobrar', "updatedAt" = NOW()
    `;

    revalidateFinanceViews();
    return { success: true, data: { clientId, year, month } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al registrar pago recurrente",
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
    revalidateFinanceViews();
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
    revalidateFinanceViews();
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
    revalidateFinanceViews();
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
    revalidateFinanceViews();
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
    revalidateFinanceViews();
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
    revalidateFinanceViews();
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
    revalidateFinanceViews();
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
    revalidateFinanceViews();
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
    revalidateFinanceViews();
    return { success: true, data: transaction };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al cancelar transacción",
    };
  }
}

/**
 * Borrar múltiples transacciones de forma permanente
 * Solo borra de la tabla Transaction, no facturas ni gastos
 */
export async function bulkDeleteTransactions(
  transactionIds: string[]
): Promise<ApiResponse<{ deleted: number }>> {
  try {
    if (!transactionIds || transactionIds.length === 0) {
      return { success: false, error: "No se seleccionaron transacciones" };
    }

    // Borrar todas las transacciones seleccionadas
    const result = await db.transaction.deleteMany({
      where: {
        id: {
          in: transactionIds,
        },
      },
    });

    revalidatePath("/finance");
    return { 
      success: true, 
      data: { deleted: result.count }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al borrar transacciones",
    };
  }
}

/**
 * Borrar múltiples gastos de forma permanente
 */
export async function bulkDeleteExpenses(
  expenseIds: string[]
): Promise<ApiResponse<{ deleted: number }>> {
  try {
    if (!expenseIds || expenseIds.length === 0) {
      return { success: false, error: "No se seleccionaron gastos" };
    }

    // Borrar todos los gastos seleccionados
    const result = await db.expense.deleteMany({
      where: {
        id: {
          in: expenseIds,
        },
      },
    });

    revalidatePath("/finance");
    return { 
      success: true, 
      data: { deleted: result.count }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al borrar gastos",
    };
  }
}

/**
 * Borrar múltiples facturas (invoices) de forma permanente
 */
export async function bulkDeleteInvoices(
  invoiceIds: string[]
): Promise<ApiResponse<{ deleted: number }>> {
  try {
    if (!invoiceIds || invoiceIds.length === 0) {
      return { success: false, error: "No se seleccionaron facturas" };
    }

    const result = await db.invoice.deleteMany({
      where: {
        id: {
          in: invoiceIds,
        },
      },
    });

    revalidatePath("/finance");
    return {
      success: true,
      data: { deleted: result.count },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al borrar facturas",
    };
  }
}

/**
 * Cambiar el estado de múltiples transacciones
 */
export async function bulkUpdateTransactionStatus(
  transactionIds: string[],
  newStatus: "PENDING" | "PAID" | "CANCELLED"
): Promise<ApiResponse<{ updated: number }>> {
  try {
    if (!transactionIds || transactionIds.length === 0) {
      return { success: false, error: "No se seleccionaron transacciones" };
    }

    if (!["PENDING", "PAID", "CANCELLED"].includes(newStatus)) {
      return { success: false, error: "Estado inválido" };
    }

    // Actualizar todas las transacciones seleccionadas
    const result = await db.transaction.updateMany({
      where: {
        id: {
          in: transactionIds,
        },
      },
      data: {
        status: newStatus,
      },
    });

    revalidatePath("/finance");
    return { 
      success: true, 
      data: { updated: result.count }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar transacciones",
    };
  }
}

export async function getTransactionById(
  transactionId: string
): Promise<ApiResponse<any>> {
  try {
    const transaction = await getTransactionByIdFromDb(transactionId);
    return { success: true, data: transaction };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener transacción",
    };
  }
}

export async function getReceivables(): Promise<
  ApiResponse<{
    totalReceivable: number;
    clientsWithDebt: number;
    monthProjection: number;
    pendingTransactions: Array<{
      id: string;
        clientName?: string;
      clientLogo?: string | null;
      description: string;
      amount: number;
      date: Date;
      daysOverdue: number;
      status: "PENDING" | "PAID";
      sourceType: "INVOICE" | "TRANSACTION" | "RECURRING";
    }>;
  }>
> {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return { success: false, error: "Usuario no autenticado" };
    }

    const result = await getReceivablesFromDb(userId);
    return result;
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

export async function getFinancialStats(): Promise<ApiResponse<FinancialStatsData>> {
  return getFinancialStatsFromDb();
}

export async function getExpensesStats(filters?: {
  month?: string;
  userId?: string;
  clientId?: string;
  category?: string;
}): Promise<ApiResponse<ExpensesStatsData>> {
  return getExpensesStatsFromDb(filters);
}

export async function getAvailableExpenseMonths(): Promise<
  ApiResponse<{ value: string; label: string }[]>
> {
  try {
    const [oldestExpense, oldestTransaction] = await Promise.all([
      db.expense.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
      db.transaction.findFirst({
        where: { type: "EXPENSE" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

    const oldestDate = (() => {
      const dates: Date[] = [];
      if (oldestExpense?.date) dates.push(oldestExpense.date);
      if (oldestTransaction?.createdAt) dates.push(oldestTransaction.createdAt);
      if (dates.length === 0) return new Date();
      return new Date(Math.min(...dates.map((d) => d.getTime())));
    })();

    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ];

    const months: { value: string; label: string }[] = [];
    const current = new Date();
    let cursor = new Date(oldestDate.getFullYear(), oldestDate.getMonth(), 1);
    const end = new Date(current.getFullYear(), current.getMonth(), 1);

    while (cursor <= end) {
      const year = cursor.getFullYear();
      const month = String(cursor.getMonth() + 1).padStart(2, "0");
      months.push({
        value: `${year}-${month}`,
        label: `${monthNames[cursor.getMonth()]} ${year}`,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    months.sort((a, b) => b.value.localeCompare(a.value));

    return { success: true, data: months };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener meses disponibles",
    };
  }
}

export async function getGlobalProfitabilityStats(): Promise<ApiResponse<any>> {
  return getGlobalProfitabilityStatsFromDb();
}

export async function getMonthlyFinancialSummary(monthValue?: string): Promise<ApiResponse<any>> {
  return getMonthlyFinancialSummaryFromDb(monthValue);
}

export async function getFinanceDashboardPeriodSnapshots(monthValues: string[]) {
  return getFinanceDashboardPeriodSnapshotsFromDb(monthValues);
}

export async function getClientMonthlyClosures(
  month: number,
  year: number
): Promise<ApiResponse<any>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    return getClientMonthlyClosuresFromDb(year, month);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener cierres mensuales",
    };
  }
}

export async function saveClientMonthlyClosure(input: unknown): Promise<ApiResponse<{ id: string }>> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const userRole = session?.user?.role;

    if (!userId || userRole !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const result = await upsertClientMonthlyClosureFromDb(input, userId);
    if (result.success) {
      revalidateFinanceViews();
    }
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al guardar el cierre mensual",
    };
  }
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
        let profitShare = 0;
        let reimbursements = 0;
        let paidSoFar = 0;

        // Base compensation (salaryType determines the formula)
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
        }

        // Profit share is ADITIVE — applies on top of any salaryType
        const userProfitSharePercent = user.profitSharePercent ?? 0;
        if (userProfitSharePercent > 0 && netIncome > 0) {
          profitShare = netIncome * (userProfitSharePercent / 100);
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
        const remaining = salary + profitShare + reimbursements - paidSoFar;

        return {
          userId: user.id,
          userName: user.name,
          userRole: "STAFF",
          salaryType: user.salaryType ?? "MONTHLY",
          salary,
          profitShare,
          profitSharePercent: userProfitSharePercent,
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
      select: { id: true, name: true },
    });

    if (!recipientUser) {
      return { success: false, error: "Usuario receptor no encontrado" };
    }

    const transaction = await db.transaction.create({
      data: {
        amount: validatedData.amount,
        type: "EXPENSE",
        status: "PAID",
        description:
          validatedData.description ||
          `Pago de salario - ${validatedData.month}/${validatedData.year}`,
        category: "SALARY",
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

/**
 * Server Action para ejecutar cobranza checks manualmente
 * Admins pueden forzar detección de OVERDUE y alertas 72h
 */
export async function runCobranzaChecks(): Promise<
  ApiResponse<{
    overdue: { overdueCount: number; alertsSent: number };
    alerts72h: { alertCount: number; alertsSent: number };
  }>
> {
  try {
    // Verificar autenticación y rol ADMIN
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "No autenticado" };
    }

    if (session.user.role !== "ADMIN") {
      return { success: false, error: "Solo admins pueden ejecutar cobranza checks" };
    }

    const { checkAndMarkOverdueInvoices, checkPaymentAlerts72Hours } = await import(
      "@/lib/finance-cobranza-service"
    );

    // Ejecutar ambos checks
    const [overdueResult, alertsResult] = await Promise.all([
      checkAndMarkOverdueInvoices(),
      checkPaymentAlerts72Hours(),
    ]);

    revalidatePath("/finance");

    return {
      success: true,
      data: {
        overdue: {
          overdueCount: overdueResult.overdueCount,
          alertsSent: overdueResult.alertsSent,
        },
        alerts72h: {
          alertCount: alertsResult.alertCount,
          alertsSent: alertsResult.alertsSent,
        },
      },
    };
  } catch (error) {
    console.error("❌ Error en runCobranzaChecks:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al ejecutar cobranza checks",
    };
  }
}

/**
 * Server Action para obtener resumen de cobranzas
 */
export async function getCobranzaSummary(): Promise<ApiResponse<any>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "No autenticado" };
    }

    const { getCobranzaSummary: getCobranzaSummaryFromDb } = await import(
      "@/lib/finance-cobranza-service"
    );

    const summary = await getCobranzaSummaryFromDb();

    return { success: true, data: summary };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener resumen de cobranzas",
    };
  }
}
