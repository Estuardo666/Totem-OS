"use server";

import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";
import type { User } from "@prisma/client";
import { auth } from "@/auth";
import { createTransactionSchema } from "@/schemas/finance";
import { revalidatePath } from "next/cache";

export interface MonthlySettlement {
  grossIncome: number; // Ingresos brutos (transacciones PAID del mes)
  productionExpenses: number; // Gastos de producción (gastos de clientes reembolsados)
  operationalExpenses: number; // Gastos operativos (salarios de EDITOR)
  netProfit: number; // Utilidad neta
  partnerFees: number; // Honorarios socios (50% de utilidad)
  month: number;
  year: number;
}

export interface UserSettlement {
  userId: string;
  userName: string;
  userRole: string;
  amount: number; // Salario fijo para EDITOR, honorarios para ADMIN
  type: "SALARIO" | "HONORARIOS";
  status: "PENDING" | "PAID";
  transferId?: string; // ID del InternalTransfer si existe
}

const WEEKLY_CAPACITY_ADMIN = 15;
const WEEKLY_CAPACITY_EDITOR = 10;
const WEEKLY_CAPACITY_VIEWER = 5;

/**
 * Calcula la liquidación mensual de la agencia
 */
export async function calculateMonthlySettlement(
  month?: number,
  year?: number
): Promise<ApiResponse<MonthlySettlement>> {
  try {
    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1; // Mes actual (1-12)
    const targetYear = year ?? now.getFullYear();

    const monthStart = new Date(targetYear, targetMonth - 1, 1);
    const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    // 1. Ingresos Brutos: Suma de transacciones PAID del mes (INCOME únicamente, no HONORARIOS)
    const paidIncomeTransactions = await db.transaction.findMany({
      where: {
        type: "INCOME",
        status: "PAID",
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });
    const grossIncome = paidIncomeTransactions.reduce(
      (sum, t) => sum + t.amount,
      0
    );

    // 2. Gastos de Producción: Gastos de clientes ya reembolsados
    const reimbursedExpenses = await db.expense.findMany({
      where: {
        reimbursed: true,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
        clientId: {
          not: null, // Solo gastos vinculados a clientes
        },
      },
    });
    const productionExpenses = reimbursedExpenses.reduce(
      (sum, e) => sum + e.amount,
      0
    );

    // 3. Gasto Operativo: Suma de salarios de usuarios EDITOR
    const editors = await db.user.findMany({
      where: {
        role: "EDITOR",
      },
      select: {
        baseSalary: true,
      },
    });
    const operationalExpenses = editors.reduce(
      (sum, e) => sum + e.baseSalary,
      0
    );

    // 4. Utilidad Neta
    const netProfit = grossIncome - productionExpenses - operationalExpenses;

    // 5. Honorarios Socios (50% de utilidad)
    const partnerFees = netProfit / 2;

    return {
      success: true,
      data: {
        grossIncome,
        productionExpenses,
        operationalExpenses,
        netProfit,
        partnerFees,
        month: targetMonth,
        year: targetYear,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al calcular liquidación mensual",
    };
  }
}

/**
 * Obtiene la liquidación por usuario para el mes actual
 */
export async function getUserSettlements(
  month?: number,
  year?: number
): Promise<ApiResponse<UserSettlement[]>> {
  try {
    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetYear = year ?? now.getFullYear();

    // Calcular liquidación mensual
    const settlementResult = await calculateMonthlySettlement(
      targetMonth,
      targetYear
    );
    if (!settlementResult.success || !settlementResult.data) {
      return {
        success: false,
        error: "Error al calcular liquidación",
      };
    }

    const settlement = settlementResult.data;

    // Obtener todos los usuarios
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        baseSalary: true,
      },
    });

    // Obtener transferencias existentes del mes
    const existingTransfers = await db.internalTransfer.findMany({
      where: {
        month: targetMonth,
        year: targetYear,
      },
    });

    // Construir liquidación por usuario
    const userSettlements: UserSettlement[] = await Promise.all(
      users.map(async (user) => {
        let amount = 0;
        let type: "SALARIO" | "HONORARIOS" = "SALARIO";
        let transferId: string | undefined;

        if (user.role === "EDITOR") {
          // Salario fijo para editores
          amount = user.baseSalary;
          type = "SALARIO";
        } else if (user.role === "ADMIN") {
          // Honorarios para socios (50% de utilidad cada uno)
          amount = settlement.partnerFees;
          type = "HONORARIOS";
        }

        // Buscar transferencia existente
        const existingTransfer = existingTransfers.find(
          (t) => t.userId === user.id && t.type === type
        );

        return {
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          amount,
          type,
          status: existingTransfer
            ? (existingTransfer.status as "PENDING" | "PAID")
            : "PENDING",
          transferId: existingTransfer?.id,
        };
      })
    );

    // Filtrar solo usuarios con monto > 0
    const filteredSettlements = userSettlements.filter((s) => s.amount > 0);

    return {
      success: true,
      data: filteredSettlements,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener liquidaciones de usuarios",
    };
  }
}

/**
 * Marca una transferencia como pagada
 */
export async function markTransferAsPaid(
  transferId: string
): Promise<ApiResponse<void>> {
  try {
    await db.internalTransfer.update({
      where: { id: transferId },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al marcar transferencia como pagada",
    };
  }
}

/**
 * Crea o actualiza una transferencia interna
 */
export async function createOrUpdateTransfer(
  userId: string,
  amount: number,
  type: "SALARIO" | "HONORARIOS",
  month: number,
  year: number,
  status: "PENDING" | "PAID" = "PENDING"
): Promise<ApiResponse<{ id: string }>> {
  try {
    const now = new Date();
    const transfer = await db.internalTransfer.upsert({
      where: {
        userId_month_year_type: {
          userId,
          month,
          year,
          type,
        },
      },
      update: {
        amount,
        status,
        paidAt: status === "PAID" ? new Date() : null,
      },
      create: {
        userId,
        amount,
        month,
        year,
        type,
        status,
        paidAt: status === "PAID" ? new Date() : null,
      },
    });

    return { success: true, data: { id: transfer.id } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al crear/actualizar transferencia",
    };
  }
}

/**
 * Registra un pago de honorarios creando una transacción HONORARIOS
 */
export async function registerHonorariosPayment(
  userId: string,
  amount: number,
  description?: string
): Promise<ApiResponse<{ transactionId: string }>> {
  try {
    // Verificar que el usuario sea ADMIN
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "No tienes permisos para realizar esta acción",
      };
    }

    // Validar datos
    const validatedData = createTransactionSchema.parse({
      amount,
      type: "HONORARIOS",
      status: "PAID",
      description: description || `Pago de honorarios`,
      userId,
    });

    // Crear la transacción
    const transaction = await db.transaction.create({
      data: {
        amount: validatedData.amount,
        type: "HONORARIOS",
        status: "PAID",
        description: validatedData.description,
        userId: validatedData.userId,
      },
    });

    // Actualizar la transferencia interna si existe
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    await db.internalTransfer.updateMany({
      where: {
        userId,
        month: currentMonth,
        year: currentYear,
        type: "HONORARIOS",
      },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    revalidatePath("/finance");
    revalidatePath("/finance/settlement");

    return {
      success: true,
      data: { transactionId: transaction.id },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al registrar pago de honorarios",
    };
  }
}

/**
 * Obtiene el monto pendiente de cobro para un usuario ADMIN en el mes actual
 */
export async function getPendingPartnerFee(
  userId: string,
  month?: number,
  year?: number
): Promise<ApiResponse<number>> {
  try {
    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetYear = year ?? now.getFullYear();

    // Calcular liquidación mensual
    const settlementResult = await calculateMonthlySettlement(
      targetMonth,
      targetYear
    );
    if (!settlementResult.success || !settlementResult.data) {
      return {
        success: false,
        error: "Error al calcular liquidación",
      };
    }

    const settlement = settlementResult.data;

    // Verificar si el usuario es ADMIN
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== "ADMIN") {
      return { success: true, data: 0 };
    }

    // Obtener transferencia existente
    const existingTransfer = await db.internalTransfer.findUnique({
      where: {
        userId_month_year_type: {
          userId,
          month: targetMonth,
          year: targetYear,
          type: "HONORARIOS",
        },
      },
    });

    // Si ya está pagada, retornar 0
    if (existingTransfer?.status === "PAID") {
      return { success: true, data: 0 };
    }

    // Retornar honorarios pendientes
    return { success: true, data: settlement.partnerFees };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener honorarios pendientes",
    };
  }
}
