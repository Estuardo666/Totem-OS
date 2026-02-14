"use strict";

import { db } from "@/lib/db";
import { createTransactionSchema, updateTransactionSchema } from "@/schemas/finance";
import { sendNotification } from "@/actions/notification-actions";
import { revalidatePath } from "next/cache";
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
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Obtener TODAS las facturas del mes (PENDING + PAID)
    const allInvoicesThisMonth = await db.invoice.findMany({
      where: {
        generatedAt: {
          gte: monthStart,
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

    // Obtener TODAS las transacciones INCOME del mes (PENDING + PAID)
    const allTransactionsThisMonth = await db.transaction.findMany({
      where: {
        type: "INCOME",
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
        OR: [
          { assignedToId: userId },
          { assignedToId: null }, // Transacciones sin asignar
        ],
      },
      include: {
        relatedClient: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Obtener clientes con tarifas mensuales recurrentes (excluyendo inactivos)
    const recurringClients = await db.client.findMany({
      where: {
        monthlyRate: { gt: 0 },
        paymentDay: { not: null },
        status: { not: "INACTIVE" },
      },
      orderBy: {
        name: "asc",
      },
    });

    // Set de IDs de clientes recurrentes para excluirlos de otras listas
    const recurringClientIds = new Set(recurringClients.map(c => c.id));

    // Calcular el saldo restante de cada cliente recurrente
    const recurringClientBalances = recurringClients
      .filter(client => client.paymentDay && client.monthlyRate > 0)
      .map(client => {
        // Sumar todos los pagos (PAID) de este cliente en este mes
        const paidFromInvoices = allInvoicesThisMonth
          .filter(inv => inv.clientId === client.id && inv.status === "PAID")
          .reduce((sum, inv) => sum + inv.amount, 0);

        const paidFromTransactions = allTransactionsThisMonth
          .filter(t => t.relatedClientId === client.id && t.status === "PAID")
          .reduce((sum, t) => sum + t.amount, 0);

        const totalPaid = paidFromInvoices + paidFromTransactions;
        const remaining = client.monthlyRate - totalPaid;

        const paymentDayThisMonth = new Date(
          now.getFullYear(),
          now.getMonth(),
          client.paymentDay!
        );
        const daysDiff = Math.floor(
          (today.getTime() - paymentDayThisMonth.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          client,
          totalPaid,
          remaining: Math.max(0, remaining), // No puede ser negativo
          paymentDayThisMonth,
          daysDiff,
          isFullyPaid: remaining <= 0,
        };
      });

    // Crear transacciones recurrentes SOLO para clientes con saldo pendiente
    const recurringTransactions = recurringClientBalances
      .filter(cb => !cb.isFullyPaid) // Solo mostrar si no está completamente pagado
      .map(cb => ({
        id: `recurring-${cb.client.id}`,
        clientName: cb.client.name || "Cliente sin nombre",
        clientLogo: cb.client.logo || undefined,
        description: cb.totalPaid > 0 
          ? `Saldo pendiente - ${cb.client.name || "Cliente"} (Pagó $${cb.totalPaid.toFixed(2)})`
          : `Tarifa mensual - ${cb.client.name || "Cliente"}`,
        amount: cb.remaining,
        date: cb.paymentDayThisMonth,
        daysOverdue: cb.daysDiff,
        status: "PENDING" as const,
        sourceType: "RECURRING" as const,
      }));

    // Facturas PENDING de clientes NO recurrentes (los recurrentes ya están contabilizados arriba)
    const pendingInvoicesNonRecurring = allInvoicesThisMonth
      .filter(inv => {
        // Excluir facturas de clientes recurrentes (ya contabilizadas en recurringTransactions)
        if (inv.clientId && recurringClientIds.has(inv.clientId)) return false;
        // Solo mostrar PENDING
        return inv.status === "PENDING";
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

    // Transacciones PENDING de clientes NO recurrentes
    const pendingTransactionsNonRecurring = allTransactionsThisMonth
      .filter(t => {
        // Excluir transacciones de clientes recurrentes
        if (t.relatedClientId && recurringClientIds.has(t.relatedClientId)) return false;
        // Solo mostrar PENDING
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

    // Calcular métricas - Solo lo PENDIENTE cuenta como "por cobrar"
    const totalReceivable =
      pendingInvoicesNonRecurring.reduce((sum, inv) => sum + inv.amount, 0) +
      pendingTransactionsNonRecurring.reduce((sum, t) => sum + t.amount, 0) +
      recurringTransactions.reduce((sum, rt) => sum + rt.amount, 0);

    // Clientes con deuda
    const clientsWithDebtSet = new Set<string>();
    pendingInvoicesNonRecurring.forEach(inv => {
      // El clientId se puede obtener del id original
      const originalInv = allInvoicesThisMonth.find(i => i.id === inv.id);
      if (originalInv?.clientId) clientsWithDebtSet.add(originalInv.clientId);
    });
    pendingTransactionsNonRecurring.forEach(t => {
      const originalT = allTransactionsThisMonth.find(tr => tr.id === t.id);
      if (originalT?.relatedClientId) clientsWithDebtSet.add(originalT.relatedClientId);
    });
    recurringTransactions.forEach(rt => {
      const clientId = rt.id.replace("recurring-", "");
      clientsWithDebtSet.add(clientId);
    });
    const clientsWithDebt = clientsWithDebtSet.size;

    // Proyección del mes: total esperado de clientes recurrentes + facturas/transacciones no recurrentes
    const monthProjection =
      recurringClients.reduce((sum, c) => sum + c.monthlyRate, 0) +
      allInvoicesThisMonth
        .filter(inv => !inv.clientId || !recurringClientIds.has(inv.clientId))
        .reduce((sum, inv) => sum + inv.amount, 0) +
      allTransactionsThisMonth
        .filter(t => !t.relatedClientId || !recurringClientIds.has(t.relatedClientId))
        .reduce((sum, t) => sum + t.amount, 0);

    // Lista final: solo items PENDING (proyectados + atrasados)
    const pendingList = [
      ...pendingInvoicesNonRecurring,
      ...pendingTransactionsNonRecurring,
      ...recurringTransactions,
    ].sort((a, b) => a.daysOverdue - b.daysOverdue); // Ordenar: próximos primero, atrasados después

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
