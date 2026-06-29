"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";
import type {
  RequestEmergencyWithdrawalInput,
  EmergencyFundMovementWithUser,
} from "@/schemas/emergency-fund";
import {
  calcFundBalanceAfterContribution,
  calcFundBalanceAfterWithdrawal,
  calcFundCoverageMonths,
  getMonthName,
} from "@/lib/finance-funds-logic";

// ---------------------------------------------------------------------------
// Get current fund balance
// ---------------------------------------------------------------------------

export async function getEmergencyFundBalance(): Promise<
  ApiResponse<{
    balance: number;
    lastMovementDate: Date | null;
    coverageMonths: number | null;
  }>
> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const lastMovement = await db.emergencyFundMovement.findFirst({
      orderBy: { createdAt: "desc" },
      select: { balanceAfter: true, createdAt: true },
    });

    const balance = lastMovement?.balanceAfter ?? 0;

    // Average monthly expenses (last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentExpenses = await db.transaction.aggregate({
      where: {
        type: "EXPENSE",
        status: "PAID",
        createdAt: { gte: threeMonthsAgo },
      },
      _sum: { amount: true },
    });

    const totalExpenses3m = recentExpenses._sum.amount ?? 0;
    const avgMonthlyExpenses = totalExpenses3m / 3;
    const coverageMonths = calcFundCoverageMonths(balance, avgMonthlyExpenses);

    return {
      success: true,
      data: {
        balance,
        lastMovementDate: lastMovement?.createdAt ?? null,
        coverageMonths,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener saldo del fondo",
    };
  }
}

// ---------------------------------------------------------------------------
// List movements
// ---------------------------------------------------------------------------

export async function getEmergencyFundMovements(
  filters?: { year?: number; type?: string }
): Promise<ApiResponse<EmergencyFundMovementWithUser[]>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const where: Record<string, unknown> = {};
    if (filters?.year) where.year = filters.year;
    if (filters?.type) where.type = filters.type;

    const movements = await db.emergencyFundMovement.findMany({
      where,
      include: {
        authorizedBy: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: movements as EmergencyFundMovementWithUser[] };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener movimientos del fondo",
    };
  }
}

// ---------------------------------------------------------------------------
// Record a contribution (called from profit distribution or monthly close)
// ---------------------------------------------------------------------------

export async function recordContribution(input: {
  amount: number;
  year: number;
  month: number;
  reason?: string;
  authorizedByUserId?: string;
}): Promise<ApiResponse<{ id: string; newBalance: number }>> {
  try {
    if (input.amount <= 0) {
      return { success: false, error: "El monto debe ser mayor a 0" };
    }

    // Get current balance
    const lastMovement = await db.emergencyFundMovement.findFirst({
      orderBy: { createdAt: "desc" },
      select: { balanceAfter: true },
    });
    const currentBalance = lastMovement?.balanceAfter ?? 0;
    const newBalance = calcFundBalanceAfterContribution(currentBalance, input.amount);

    const movement = await db.emergencyFundMovement.create({
      data: {
        type: "CONTRIBUTION",
        amount: input.amount,
        balanceAfter: newBalance,
        year: input.year,
        month: input.month,
        reason:
          input.reason ??
          `Aporte automático - ${getMonthName(input.month)} ${input.year}`,
        authorizedByUserId: input.authorizedByUserId,
      },
    });

    return { success: true, data: { id: movement.id, newBalance } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al registrar aporte al fondo",
    };
  }
}

// ---------------------------------------------------------------------------
// Request withdrawal
// ---------------------------------------------------------------------------

export async function requestWithdrawal(
  input: RequestEmergencyWithdrawalInput
): Promise<ApiResponse<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    // Check sufficient balance
    const lastMovement = await db.emergencyFundMovement.findFirst({
      orderBy: { createdAt: "desc" },
      select: { balanceAfter: true },
    });
    const currentBalance = lastMovement?.balanceAfter ?? 0;

    const { valid } = calcFundBalanceAfterWithdrawal(currentBalance, input.amount);
    if (!valid) {
      return {
        success: false,
        error: `Saldo insuficiente. Saldo actual: $${currentBalance.toFixed(2)}`,
      };
    }

    const newBalance = currentBalance - input.amount;

    // Create withdrawal movement (pending authorization if required)
    const movement = await db.emergencyFundMovement.create({
      data: {
        type: "WITHDRAWAL",
        amount: input.amount,
        balanceAfter: newBalance,
        year: input.year,
        month: input.month,
        reason: input.reason,
        authorizedByUserId: session.user.id,
      },
    });

    return { success: true, data: { id: movement.id } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al solicitar retiro del fondo",
    };
  }
}

// ---------------------------------------------------------------------------
// Execute withdrawal (creates Transaction EXPENSE with category EMERGENCY_FUND)
// ---------------------------------------------------------------------------

export async function executeWithdrawal(
  movementId: string
): Promise<ApiResponse<{ transactionId: string }>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const movement = await db.emergencyFundMovement.findUnique({
      where: { id: movementId },
    });

    if (!movement) {
      return { success: false, error: "Movimiento no encontrado" };
    }
    if (movement.type !== "WITHDRAWAL") {
      return { success: false, error: "Solo se pueden ejecutar retiros" };
    }
    if (movement.relatedTransactionId) {
      return { success: false, error: "Este retiro ya fue ejecutado" };
    }

    // Create the expense transaction
    const result = await db.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          amount: movement.amount,
          type: "EXPENSE",
          status: "PAID",
          category: "OTROS",
          description: `Retiro fondo de emergencia - ${movement.reason ?? getMonthName(movement.month) + " " + movement.year}`,
        },
      });

      await tx.emergencyFundMovement.update({
        where: { id: movementId },
        data: { relatedTransactionId: transaction.id },
      });

      return transaction;
    });

    return { success: true, data: { transactionId: result.id } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al ejecutar retiro del fondo",
    };
  }
}

// ---------------------------------------------------------------------------
// Auto-contribute from monthly close (called by cron or monthly close hook)
// ---------------------------------------------------------------------------

export async function autoContributeFromClose(
  year: number,
  month: number,
  netProfit: number,
  authorizedByUserId?: string
): Promise<ApiResponse<{ contribution: number; skipped: boolean }>> {
  try {
    const { getFinanceSettingsWithFallback } = await import(
      "@/actions/finance-settings-actions"
    );
    const settings = await getFinanceSettingsWithFallback();
    const ef = settings.emergencyFund;

    if (!ef.enabled || !ef.autoContributeOnClose) {
      return { success: true, data: { contribution: 0, skipped: true } };
    }

    if (netProfit <= 0) {
      return { success: true, data: { contribution: 0, skipped: true } };
    }

    // Check if already contributed for this month
    const existing = await db.emergencyFundMovement.findFirst({
      where: { year, month, type: "CONTRIBUTION" },
    });
    if (existing) {
      return { success: true, data: { contribution: 0, skipped: true } };
    }

    const lastMovement = await db.emergencyFundMovement.findFirst({
      orderBy: { createdAt: "desc" },
      select: { balanceAfter: true },
    });
    const currentBalance = lastMovement?.balanceAfter ?? 0;

    const { calcEmergencyContribution } = await import(
      "@/lib/finance-funds-logic"
    );
    const contribution = calcEmergencyContribution(
      netProfit,
      ef.monthlyContributionPct,
      currentBalance,
      ef.minBalance,
      ef.enabled
    );

    if (contribution <= 0) {
      return { success: true, data: { contribution: 0, skipped: true } };
    }

    await recordContribution({
      amount: contribution,
      year,
      month,
      reason: `Aporte automático cierre mensual - ${getMonthName(month)} ${year}`,
      authorizedByUserId,
    });

    return { success: true, data: { contribution, skipped: false } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error en aporte automático al fondo",
    };
  }
}
