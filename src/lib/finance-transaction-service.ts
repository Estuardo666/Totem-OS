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
 * Incluye facturas pendientes y transacciones INCOME
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
      description: string;
      amount: number;
      date: Date;
      daysOverdue: number;
      sourceType: "INVOICE" | "TRANSACTION";
    }>;
  }>
> {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Obtener facturas pendientes
    const pendingInvoices = await db.invoice.findMany({
      where: {
        status: "PENDING",
      },
      include: {
        client: true,
      },
      orderBy: {
        generatedAt: "asc",
      },
    });

    // Obtener transacciones pendientes de tipo INCOME
    const pendingTransactions = await db.transaction.findMany({
      where: {
        type: "INCOME",
        status: "PENDING",
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

    // Facturas pagadas en el mes actual
    const paidInvoicesThisMonth = await db.invoice.findMany({
      where: {
        status: "PAID",
        generatedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    // Transacciones INCOME pagadas en el mes actual
    const paidTransactionsThisMonth = await db.transaction.findMany({
      where: {
        type: "INCOME",
        status: "PAID",
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
        OR: [
          { assignedToId: userId },
          { assignedToId: null },
        ],
      },
    });

    // Facturas pendientes en el mes actual
    const pendingInvoicesThisMonth = await db.invoice.findMany({
      where: {
        status: "PENDING",
        generatedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    // Transacciones INCOME pendientes en el mes actual
    const pendingTransactionsThisMonth = await db.transaction.findMany({
      where: {
        type: "INCOME",
        status: "PENDING",
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
        OR: [
          { assignedToId: userId },
          { assignedToId: null },
        ],
      },
    });

    // Calcular métricas
    const totalReceivable =
      pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0) +
      pendingTransactions.reduce((sum, t) => sum + t.amount, 0);

    const clientsWithDebtSet = new Set<string>();
    pendingInvoices.forEach((inv) => {
      if (inv.clientId) clientsWithDebtSet.add(inv.clientId);
    });
    pendingTransactions.forEach((t) => {
      if (t.relatedClientId) clientsWithDebtSet.add(t.relatedClientId);
    });
    const clientsWithDebt = clientsWithDebtSet.size;

    const monthProjection =
      paidInvoicesThisMonth.reduce((sum, inv) => sum + inv.amount, 0) +
      paidTransactionsThisMonth.reduce((sum, t) => sum + t.amount, 0) +
      pendingInvoicesThisMonth.reduce((sum, inv) => sum + inv.amount, 0) +
      pendingTransactionsThisMonth.reduce((sum, t) => sum + t.amount, 0);

    // Preparar lista de transacciones pendientes
    const pendingList = [
      ...pendingInvoices.map((inv) => {
        const invoiceDate = new Date(inv.generatedAt);
        const daysDiff = Math.floor((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: inv.id,
          clientName: inv.client.name,
          description: `Factura - ${inv.client.name}`,
          amount: inv.amount,
          date: invoiceDate,
          daysOverdue: daysDiff > 0 ? daysDiff : 0,
          sourceType: "INVOICE" as const,
        };
      }),
      ...pendingTransactions.map((t) => {
        const transactionDate = new Date(t.createdAt);
        const daysDiff = Math.floor((today.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: t.id,
          clientName: t.relatedClient?.name,
          description: t.description || "Transacción",
          amount: t.amount,
          date: transactionDate,
          daysOverdue: daysDiff > 0 ? daysDiff : 0,
          sourceType: "TRANSACTION" as const,
        };
      }),
    ].sort((a, b) => b.daysOverdue - a.daysOverdue);

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
