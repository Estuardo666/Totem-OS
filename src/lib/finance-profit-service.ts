"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";
import type {
  CreateProfitDistributionInput,
  ProfitDistributionWithItems,
} from "@/schemas/profit-distribution";
import {
  calcProfit,
  getMonthName,
} from "@/lib/finance-funds-logic";
import { getFinanceSettingsWithFallback } from "@/actions/finance-settings-actions";
import { getEmergencyFundBalance } from "@/lib/finance-emergency-fund-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

// ---------------------------------------------------------------------------
// Get profit calculation preview for a given month
// ---------------------------------------------------------------------------

export async function getProfitPreview(
  year: number,
  month: number
): Promise<
  ApiResponse<{
    collectedCash: number;
    totalExpensesPaid: number;
    totalHonorariosPaid: number;
    netProfit: number;
    fundContribution: number;
    distributableAmount: number;
    canDistribute: boolean;
    reasonNoDistribution?: string;
    eligibleUsers: Array<{
      userId: string;
      userName: string;
      profitSharePercent: number;
    }>;
    existingDistribution: { id: string; status: string } | null;
  }>
> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const { start, end } = getMonthRange(year, month);

    // Collected cash: PAID invoices + PAID INCOME transactions in the month
    const [paidInvoices, paidIncomeTx, paidExpenseTx, paidHonorariosTx] =
      await Promise.all([
        db.invoice.findMany({
          where: { status: "PAID", generatedAt: { gte: start, lte: end } },
          select: { amount: true },
        }),
        db.transaction.findMany({
          where: {
            type: "INCOME",
            status: "PAID",
            createdAt: { gte: start, lte: end },
          },
          select: { amount: true },
        }),
        db.transaction.findMany({
          where: {
            type: "EXPENSE",
            status: "PAID",
            createdAt: { gte: start, lte: end },
          },
          select: { amount: true },
        }),
        db.transaction.findMany({
          where: {
            type: "HONORARIOS",
            status: "PAID",
            createdAt: { gte: start, lte: end },
          },
          select: { amount: true },
        }),
      ]);

    const collectedCash =
      paidInvoices.reduce((s, i) => s + i.amount, 0) +
      paidIncomeTx.reduce((s, t) => s + t.amount, 0);

    const totalExpensesPaid = paidExpenseTx.reduce((s, t) => s + t.amount, 0);
    const totalHonorariosPaid = paidHonorariosTx.reduce(
      (s, t) => s + t.amount,
      0
    );

    // Emergency fund state
    const fundBalanceResult = await getEmergencyFundBalance();
    const fundBalance = fundBalanceResult.success
      ? fundBalanceResult.data?.balance ?? 0
      : 0;

    const settings = await getFinanceSettingsWithFallback();
    const ef = settings.emergencyFund;

    const result = calcProfit({
      collectedCash,
      totalExpensesPaid,
      totalHonorariosPaid,
      emergencyFundEnabled: ef.enabled,
      emergencyFundContributionPct: ef.monthlyContributionPct,
      emergencyFundCurrentBalance: fundBalance,
      emergencyFundMinBalance: ef.minBalance,
      reserveBeforeDistribution: settings.reserveBeforeDistribution,
      profitDistributionEnabled: settings.profitDistributionEnabled,
    });

    // Eligible users (profitSharePercent > 0, emergencyFundEligible)
    const eligibleUsers = await db.user.findMany({
      where: {
        profitSharePercent: { gt: 0 },
        emergencyFundEligible: true,
      },
      select: { id: true, name: true, profitSharePercent: true },
    });

    // Check if distribution already exists for this month
    const existing = await db.profitDistribution.findUnique({
      where: { year_month: { year, month } },
      select: { id: true, status: true },
    });

    return {
      success: true,
      data: {
        collectedCash,
        totalExpensesPaid,
        totalHonorariosPaid,
        ...result,
        fundContribution: result.fundContribution,
        eligibleUsers: eligibleUsers.map((u) => ({
          userId: u.id,
          userName: u.name,
          profitSharePercent: u.profitSharePercent ?? 0,
        })),
        existingDistribution: existing,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al calcular vista previa de utilidades",
    };
  }
}

// ---------------------------------------------------------------------------
// List distributions
// ---------------------------------------------------------------------------

export async function getProfitDistributions(
  filters?: { year?: number; status?: string }
): Promise<ApiResponse<ProfitDistributionWithItems[]>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const where: Record<string, unknown> = {};
    if (filters?.year) where.year = filters.year;
    if (filters?.status) where.status = filters.status;

    const distributions = await db.profitDistribution.findMany({
      where,
      include: {
        items: {
          include: {
            user: {
              select: { id: true, name: true, image: true, profitSharePercent: true },
            },
          },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return { success: true, data: distributions as ProfitDistributionWithItems[] };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener distribuciones de utilidades",
    };
  }
}

// ---------------------------------------------------------------------------
// Get single distribution by ID
// ---------------------------------------------------------------------------

export async function getProfitDistributionById(
  id: string
): Promise<ApiResponse<ProfitDistributionWithItems>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const distribution = await db.profitDistribution.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                profitSharePercent: true,
              },
            },
          },
        },
      },
    });

    if (!distribution) {
      return { success: false, error: "Distribución no encontrada" };
    }

    return {
      success: true,
      data: distribution as ProfitDistributionWithItems,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener distribución",
    };
  }
}

// ---------------------------------------------------------------------------
// Create draft distribution
// ---------------------------------------------------------------------------

export async function createDraftDistribution(
  input: CreateProfitDistributionInput
): Promise<ApiResponse<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    // Prevent duplicate
    const existing = await db.profitDistribution.findUnique({
      where: { year_month: { year: input.year, month: input.month } },
    });
    if (existing) {
      return {
        success: false,
        error: `Ya existe una distribución para ${getMonthName(input.month)} ${input.year}`,
      };
    }

    const distribution = await db.profitDistribution.create({
      data: {
        year: input.year,
        month: input.month,
        status: "DRAFT",
        totalProfit: input.totalProfit,
        fundContribution: input.fundContribution,
        distributableAmount: input.distributableAmount,
        notes: input.notes,
        items: {
          create: input.items.map((item) => ({
            userId: item.userId,
            percent: item.percent,
            amount: item.amount,
          })),
        },
      },
    });

    return { success: true, data: { id: distribution.id } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al crear distribución de utilidades",
    };
  }
}

// ---------------------------------------------------------------------------
// Approve distribution (DRAFT → APPROVED)
// ---------------------------------------------------------------------------

export async function approveDistribution(
  id: string
): Promise<ApiResponse<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const distribution = await db.profitDistribution.findUnique({
      where: { id },
    });
    if (!distribution) {
      return { success: false, error: "Distribución no encontrada" };
    }
    if (distribution.status !== "DRAFT") {
      return {
        success: false,
        error: `No se puede aprobar una distribución en estado ${distribution.status}`,
      };
    }

    await db.profitDistribution.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
    });

    return { success: true, data: { id } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al aprobar distribución",
    };
  }
}

// ---------------------------------------------------------------------------
// Pay distribution (APPROVED → PAID, creates Transaction HONORARIOS per item)
// ---------------------------------------------------------------------------

export async function payDistribution(
  id: string
): Promise<ApiResponse<{ id: string; transactionsCreated: number }>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const distribution = await db.profitDistribution.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!distribution) {
      return { success: false, error: "Distribución no encontrada" };
    }
    if (distribution.status !== "APPROVED") {
      return {
        success: false,
        error: `No se puede pagar una distribución en estado ${distribution.status}`,
      };
    }

    // Create a Transaction HONORARIOS for each item inside a transaction
    const result = await db.$transaction(async (tx) => {
      const transactions: Array<{ id: string }> = [];

      for (const item of distribution.items) {
        const txCreated = await tx.transaction.create({
          data: {
            amount: item.amount,
            type: "HONORARIOS",
            status: "PAID",
            description: `Utilidad ${getMonthName(distribution.month)} ${distribution.year}`,
            userId: item.userId,
          },
        });

        await tx.profitDistributionItem.update({
          where: { id: item.id },
          data: { paidTransactionId: txCreated.id },
        });

        transactions.push({ id: txCreated.id });
      }

      await tx.profitDistribution.update({
        where: { id },
        data: { status: "PAID", paidAt: new Date() },
      });

      return transactions;
    });

    return { success: true, data: { id, transactionsCreated: result.length } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al pagar distribución",
    };
  }
}

// ---------------------------------------------------------------------------
// Delete distribution (only DRAFT)
// ---------------------------------------------------------------------------

export async function deleteProfitDistribution(
  id: string
): Promise<ApiResponse<void>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const distribution = await db.profitDistribution.findUnique({
      where: { id },
    });
    if (!distribution) {
      return { success: false, error: "Distribución no encontrada" };
    }
    if (distribution.status !== "DRAFT") {
      return {
        success: false,
        error: "Solo se pueden eliminar distribuciones en estado borrador",
      };
    }

    await db.profitDistribution.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al eliminar distribución",
    };
  }
}
