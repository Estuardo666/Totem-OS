"use strict";

import { db } from "@/lib/db";
import { createTransactionSchema, updateTransactionSchema } from "@/schemas/finance";
import { sendNotification } from "@/actions/notification-actions";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { Transaction } from "@prisma/client";
import type { ApiResponse } from "@/types";

/**
 * Crea una nueva transacción en la base de datos
 * Valida permisos: ADMIN puede crear INCOME/HONORARIOS, EDITOR solo EXPENSE
 */
export async function createTransactionInDb(
  input: unknown,
  userId: string,
  userRole: string
): Promise<ApiResponse<Transaction>> {
  try {
    const validatedData = createTransactionSchema.parse(input);

    // Si es HONORARIOS, solo ADMIN puede crearlo
    if (validatedData.type === "HONORARIOS" && userRole !== "ADMIN") {
      return {
        success: false,
        error: "No tienes permisos para crear transacciones de tipo HONORARIOS",
      };
    }

    // Si es EDITOR, solo puede crear gastos (EXPENSE) y se fuerza assignedToId
    if (userRole === "EDITOR") {
      if (validatedData.type !== "EXPENSE") {
        return {
          success: false,
          error: "Solo puedes crear transacciones de tipo EXPENSE",
        };
      }
      // Forzar assignedToId al userId del EDITOR
      validatedData.assignedToId = userId;
    }

    // Crear la transacción
    const transaction = await db.transaction.create({
      data: {
        amount: validatedData.amount,
        type: validatedData.type,
        status: validatedData.status ?? "PENDING",
        description: validatedData.description ?? null,
        category: validatedData.category ?? null,
        relatedClientId: validatedData.relatedClientId ?? null,
        clientId: validatedData.clientId ?? null,
        assignedToId: validatedData.assignedToId ?? null,
        userId: validatedData.userId ?? null,
      },
    });

    // Notificar a los admins sobre nuevos ingresos u honorarios
    if (transaction.type === "INCOME" || transaction.type === "HONORARIOS") {
      try {
        const { notifyAdminsWithPush } = await import("@/actions/notification-actions");

        const typeLabel = transaction.type === "INCOME" ? "Ingreso" : "Honorario";
        const description = transaction.description || "Sin descripción";

        await notifyAdminsWithPush(
          `Nuevo ${typeLabel.toLowerCase()} registrado`,
          `Se registró un ${typeLabel.toLowerCase()}: ${description} - $${transaction.amount}`,
          "ADMIN_ALERT",
          "/finance",
          userId
        );
      } catch (error) {
        console.error("❌ Error al enviar notificaciones a admins:", error);
      }
    }

    revalidatePath("/finance");
    revalidatePath("/");

    return { success: true, data: transaction };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al crear transacción",
    };
  }
}

/**
 * Actualiza una transacción existente
 */
export async function updateTransactionInDb(
  id: string,
  input: unknown
): Promise<ApiResponse<Transaction>> {
  try {
    const validatedData = updateTransactionSchema.parse(input);

    const transaction = await db.transaction.update({
      where: { id },
      data: {
        ...(validatedData.amount !== undefined && { amount: validatedData.amount }),
        ...(validatedData.type !== undefined && { type: validatedData.type }),
        ...(validatedData.status !== undefined && { status: validatedData.status }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.relatedClientId !== undefined && {
          relatedClientId: validatedData.relatedClientId || null,
        }),
        ...(validatedData.assignedToId !== undefined && {
          assignedToId: validatedData.assignedToId || null,
        }),
      },
    });

    revalidatePath("/");
    revalidatePath("/finance");
    revalidatePath("/finance/receivables");

    return { success: true, data: transaction };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar transacción",
    };
  }
}

/**
 * Obtiene una transacción por ID con relaciones
 */
export async function getTransactionByIdFromDb(
  transactionId: string
): Promise<Transaction & { user?: { id: string; name: string | null; image: string | null } | null }> {
  try {
    const transaction = await db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        relatedClient: true,
        user: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    if (!transaction) {
      throw new Error("Transacción no encontrada");
    }

    console.log("🗄️ Transaction from DB:", {
      id: transaction.id,
      amount: transaction.amount,
      type: transaction.type,
      userId: transaction.userId,
      status: transaction.status,
      description: transaction.description,
      userRelation: transaction.user,
    });

    return transaction;
  } catch (error) {
    throw error instanceof Error ? error : new Error("Error al obtener transacción");
  }
}

/**
 * Obtiene transacciones con opciones de filtrado
 */
export async function getTransactionsFromDb(options?: {
  type?: "INCOME" | "EXPENSE" | "HONORARIOS";
  status?: "PENDING" | "PAID" | "CANCELLED";
  assignedToId?: string;
  relatedClientId?: string;
  limit?: number;
  skip?: number;
}): Promise<ApiResponse<Transaction[]>> {
  try {
    const transactions = await db.transaction.findMany({
      where: {
        ...(options?.type && { type: options.type }),
        ...(options?.status && { status: options.status }),
        ...(options?.assignedToId && { assignedToId: options.assignedToId }),
        ...(options?.relatedClientId && { relatedClientId: options.relatedClientId }),
      },
      include: {
        relatedClient: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: options?.limit,
      skip: options?.skip,
    });

    return { success: true, data: transactions };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener transacciones",
    };
  }
}

/**
 * Marca una transacción como pagada y notifica si es honorario
 */
export async function markTransactionAsPaidInDb(
  transactionId: string
): Promise<ApiResponse<Transaction>> {
  try {
    const transactionBefore = await db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        user: true,
      },
    });

    if (!transactionBefore) {
      return {
        success: false,
        error: "Transacción no encontrada",
      };
    }

    const result = await updateTransactionInDb(transactionId, { status: "PAID" });

    // Notificar si es pago de honorarios
    if (result.success && transactionBefore.type === "HONORARIOS" && transactionBefore.userId) {
      try {
        await sendNotification({
          userId: transactionBefore.userId,
          message: `Se ha procesado el pago de tus honorarios por $${transactionBefore.amount}.`,
          type: "PAYMENT",
          createdBy: undefined,
        });
      } catch (error) {
        console.error("❌ Error al enviar notificación de pago:", error);
      }
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al marcar transacción como pagada",
    };
  }
}

/**
 * Cancela una transacción (marca como CANCELLED)
 */
export async function cancelTransactionInDb(
  transactionId: string
): Promise<ApiResponse<Transaction>> {
  return updateTransactionInDb(transactionId, { status: "CANCELLED" });
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatBillingMonth(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getPeriodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

type BillingExceptionRow = {
  clientId: string;
  month: number;
  year: number;
  type: string;
  overrideAmount: number | null;
};

async function getBillingExceptions(input: {
  clientIds: string[];
  maxYear: number;
  maxMonth: number;
}): Promise<BillingExceptionRow[]> {
  if (input.clientIds.length === 0) {
    return [];
  }

  try {
    const rows = await db.$queryRaw<Array<BillingExceptionRow>>`
      SELECT
        "clientId",
        "month",
        "year",
        "type",
        "overrideAmount"
      FROM "ClientBillingException"
      WHERE "clientId" IN (${Prisma.join(input.clientIds)})
        AND (
          "year" < ${input.maxYear}
          OR (
            "year" = ${input.maxYear}
            AND "month" <= ${input.maxMonth}
          )
        )
    `;

    return rows;
  } catch {
    return [];
  }
}

function getRecurringStartMonth(createdAt: Date, paymentDay: number): Date {
  const candidate = getMonthStart(createdAt);
  const scheduledDay = Math.min(
    paymentDay,
    getLastDayOfMonth(candidate.getFullYear(), candidate.getMonth())
  );
  const firstDueDate = new Date(
    candidate.getFullYear(),
    candidate.getMonth(),
    scheduledDay,
    23,
    59,
    59,
    999
  );

  if (createdAt.getTime() > firstDueDate.getTime()) {
    return addMonths(candidate, 1);
  }

  return candidate;
}

function buildRecurringPeriods(input: {
  startMonth: Date;
  endMonth: Date;
  paymentDay: number;
  monthlyRate: number;
  today: Date;
  clientId: string;
  clientName: string;
  clientLogo?: string | null;
  totalPaid: number;
  exceptions: Array<{
    month: number;
    year: number;
    type: string;
    overrideAmount: number | null;
  }>;
  paidAmountsByPeriod: Map<string, number>;
}): Array<{
  id: string;
  clientName: string;
  clientLogo?: string | null;
  description: string;
  amount: number;
  date: Date;
  daysOverdue: number;
  status: "PENDING";
  sourceType: "RECURRING";
}> {
  const periods: Array<{
    monthStart: Date;
    dueDate: Date;
  }> = [];

  let cursor = getMonthStart(input.startMonth);
  const endCursor = getMonthStart(input.endMonth);
  const exceptionMap = new Map(
    input.exceptions.map((exception) => [getPeriodKey(exception.year, exception.month), exception])
  );

  while (cursor.getTime() <= endCursor.getTime()) {
    const scheduledDay = Math.min(
      input.paymentDay,
      getLastDayOfMonth(cursor.getFullYear(), cursor.getMonth())
    );

    periods.push({
      monthStart: new Date(cursor),
      dueDate: new Date(cursor.getFullYear(), cursor.getMonth(), scheduledDay),
    });

    cursor = addMonths(cursor, 1);
  }

  let remainingPaid = input.totalPaid;

  return periods.flatMap((period) => {
    const exception = exceptionMap.get(
      getPeriodKey(period.monthStart.getFullYear(), period.monthStart.getMonth() + 1)
    );

    if (exception?.type === "SKIP" || exception?.type === "MARK_AS_PAID") {
      return [];
    }

    const paidPeriodAmount = input.paidAmountsByPeriod.get(
      getPeriodKey(period.monthStart.getFullYear(), period.monthStart.getMonth() + 1)
    ) ?? 0;
    const periodAmount = exception?.type === "OVERRIDE_AMOUNT"
      ? exception.overrideAmount ?? input.monthlyRate
      : Math.max(input.monthlyRate, paidPeriodAmount);

    if (periodAmount <= 0) {
      return [];
    }

    const appliedAmount = Math.min(periodAmount, remainingPaid);
    const remainingAmount = Math.max(0, periodAmount - appliedAmount);
    remainingPaid = Math.max(0, remainingPaid - appliedAmount);

    if (remainingAmount <= 0) {
      return [];
    }

    const description = appliedAmount > 0
      ? `Saldo pendiente ${formatBillingMonth(period.monthStart)} - ${input.clientName} (Abonó $${appliedAmount.toFixed(2)})`
      : `Fee mensual ${formatBillingMonth(period.monthStart)} - ${input.clientName}`;

    const daysOverdue = Math.floor(
      (input.today.getTime() - period.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return [{
      id: `recurring-${input.clientId}-${period.monthStart.getFullYear()}-${period.monthStart.getMonth() + 1}`,
      clientName: input.clientName,
      clientLogo: input.clientLogo ?? undefined,
      description,
      amount: remainingAmount,
      date: period.dueDate,
      daysOverdue,
      status: "PENDING" as const,
      sourceType: "RECURRING" as const,
    }];
  });
}

/**
 * Obtiene el resumen de cuentas por cobrar
 * Incluye facturas pendientes, transacciones INCOME y tarifas mensuales recurrentes
 */
export async function getReceivablesFromDb(
  userId: string
): Promise<
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
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = getMonthStart(now);
    const monthEnd = getMonthEnd(now);

    const allInvoices = await db.invoice.findMany({
      where: {
        generatedAt: {
          lte: monthEnd,
        },
      },
      include: {
        client: true,
      },
      orderBy: {
        generatedAt: "asc",
      },
    });

    const allTransactions = await db.transaction.findMany({
      where: {
        type: "INCOME",
        createdAt: {
          lte: monthEnd,
        },
        OR: [
          { assignedToId: userId },
          { assignedToId: null },
        ],
      },
      include: {
        relatedClient: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const recurringClients = await db.client.findMany({
      where: {
        monthlyRate: { gt: 0 },
        paymentDay: { not: null },
        status: { not: "INACTIVE" },
      },
      select: {
        id: true,
        name: true,
        logo: true,
        monthlyRate: true,
        paymentDay: true,
        billingStartDate: true,
        createdAt: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    const recurringClientIdsArray = recurringClients.map((client) => client.id);
    const billingExceptions = await getBillingExceptions({
      clientIds: recurringClientIdsArray,
      maxYear: monthStart.getFullYear(),
      maxMonth: monthStart.getMonth() + 1,
    });

    const exceptionsByClient = new Map(
      recurringClientIdsArray.map((clientId) => [
        clientId,
        billingExceptions.filter((exception) => exception.clientId === clientId),
      ])
    );

    const recurringClientIds = new Set(recurringClients.map(c => c.id));

    const currentMonthInvoices = allInvoices.filter((invoice) => {
      const generatedAt = new Date(invoice.generatedAt);
      return generatedAt >= monthStart && generatedAt <= monthEnd;
    });

    const currentMonthTransactions = allTransactions.filter((transaction) => {
      const createdAt = new Date(transaction.createdAt);
      return createdAt >= monthStart && createdAt <= monthEnd;
    });

    const recurringTransactions = recurringClients.flatMap((client) => {
      const paymentDay = client.paymentDay ?? null;

      if (!paymentDay || client.monthlyRate <= 0) {
        return [];
      }

      const paidFromInvoices = allInvoices
        .filter((invoice) => invoice.clientId === client.id && invoice.status === "PAID")
        .reduce((sum, invoice) => sum + invoice.amount, 0);

      const paidFromTransactions = allTransactions
        .filter((transaction) => {
          const relatedClientId = transaction.relatedClientId ?? transaction.clientId ?? null;
          return relatedClientId === client.id && transaction.status === "PAID";
        })
        .reduce((sum, transaction) => sum + transaction.amount, 0);

      const totalPaid = paidFromInvoices + paidFromTransactions;
      const billingReferenceDate = new Date(client.billingStartDate ?? client.createdAt);
      const startMonth = getRecurringStartMonth(billingReferenceDate, paymentDay);
      const clientExceptions = exceptionsByClient.get(client.id) ?? [];

      if (startMonth.getTime() > monthStart.getTime()) {
        return [];
      }

      const paidAmountsByPeriod = new Map<string, number>();

      allInvoices
        .filter((invoice) => invoice.clientId === client.id && invoice.status === "PAID")
        .forEach((invoice) => {
          const d = new Date(invoice.generatedAt);
          const key = getPeriodKey(d.getFullYear(), d.getMonth() + 1);
          paidAmountsByPeriod.set(key, (paidAmountsByPeriod.get(key) ?? 0) + invoice.amount);
        });

      allTransactions
        .filter((transaction) => {
          const relatedClientId = transaction.relatedClientId ?? transaction.clientId ?? null;
          return relatedClientId === client.id && transaction.status === "PAID";
        })
        .forEach((transaction) => {
          const d = new Date(transaction.createdAt);
          const key = getPeriodKey(d.getFullYear(), d.getMonth() + 1);
          paidAmountsByPeriod.set(key, (paidAmountsByPeriod.get(key) ?? 0) + transaction.amount);
        });

      return buildRecurringPeriods({
        startMonth,
        endMonth: monthStart,
        paymentDay,
        monthlyRate: client.monthlyRate,
        today,
        clientId: client.id,
        clientName: client.name || "Cliente sin nombre",
        clientLogo: client.logo ?? undefined,
        totalPaid,
        exceptions: clientExceptions,
        paidAmountsByPeriod,
      });
    });

    const pendingInvoicesNonRecurring = allInvoices
      .filter(inv => {
        if (inv.clientId && recurringClientIds.has(inv.clientId)) return false;
        return inv.status === "PENDING" || inv.status === "OVERDUE";
      })
      .map(inv => {
        const invoiceDate = new Date(inv.generatedAt);
        const daysDiff = Math.floor((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: inv.id,
          clientName: inv.client?.name || "Cliente sin nombre",
          clientLogo: inv.client?.logo || undefined,
          description: `Factura - ${inv.client?.name || "Cliente"}`,
          amount: inv.amount,
          date: invoiceDate,
          daysOverdue: daysDiff,
          status: "PENDING" as const,
          sourceType: "INVOICE" as const,
        };
      });

    const pendingTransactionsNonRecurring = allTransactions
      .filter(t => {
        const relatedClientId = t.relatedClientId ?? t.clientId ?? null;
        if (relatedClientId && recurringClientIds.has(relatedClientId)) return false;
        return t.status === "PENDING";
      })
      .map(t => {
        const transactionDate = new Date(t.createdAt);
        const daysDiff = Math.floor((today.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: t.id,
          clientName: t.relatedClient?.name || "Sin cliente asignado",
          clientLogo: t.relatedClient?.logo || undefined,
          description: t.description || "Transacción",
          amount: t.amount,
          date: transactionDate,
          daysOverdue: daysDiff,
          status: "PENDING" as const,
          sourceType: "TRANSACTION" as const,
        };
      });

    const totalReceivable =
      pendingInvoicesNonRecurring.reduce((sum, inv) => sum + inv.amount, 0) +
      pendingTransactionsNonRecurring.reduce((sum, t) => sum + t.amount, 0) +
      recurringTransactions.reduce((sum, rt) => sum + rt.amount, 0);

    const clientsWithDebtSet = new Set<string>();
    pendingInvoicesNonRecurring.forEach(inv => {
      const originalInv = allInvoices.find(i => i.id === inv.id);
      if (originalInv?.clientId) clientsWithDebtSet.add(originalInv.clientId);
    });
    pendingTransactionsNonRecurring.forEach(t => {
      const originalT = allTransactions.find(tr => tr.id === t.id);
      const relatedClientId = originalT?.relatedClientId ?? originalT?.clientId ?? null;
      if (relatedClientId) clientsWithDebtSet.add(relatedClientId);
    });
    recurringTransactions.forEach(rt => {
      const clientId = rt.id.split("-").slice(1, -2).join("-");
      clientsWithDebtSet.add(clientId);
    });
    const clientsWithDebt = clientsWithDebtSet.size;

    const monthProjection =
      recurringClients.reduce((sum, client) => {
        const currentMonthException = (exceptionsByClient.get(client.id) ?? []).find(
          (exception) => exception.year === monthStart.getFullYear() && exception.month === monthStart.getMonth() + 1
        );

        if (currentMonthException?.type === "SKIP" || currentMonthException?.type === "MARK_AS_PAID") {
          return sum;
        }

        if (currentMonthException?.type === "OVERRIDE_AMOUNT") {
          return sum + (currentMonthException.overrideAmount ?? 0);
        }

        return sum + client.monthlyRate;
      }, 0) +
      currentMonthInvoices
        .filter(inv => !inv.clientId || !recurringClientIds.has(inv.clientId))
        .reduce((sum, inv) => sum + inv.amount, 0) +
      currentMonthTransactions
        .filter(t => {
          const relatedClientId = t.relatedClientId ?? t.clientId ?? null;
          return !relatedClientId || !recurringClientIds.has(relatedClientId);
        })
        .reduce((sum, t) => sum + t.amount, 0);

    const pendingList = [
      ...pendingInvoicesNonRecurring,
      ...pendingTransactionsNonRecurring,
      ...recurringTransactions,
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      success: true,
      data: {
        totalReceivable,
        clientsWithDebt,
        monthProjection,
        pendingTransactions: pendingList,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener cuentas por cobrar",
    };
  }
}
