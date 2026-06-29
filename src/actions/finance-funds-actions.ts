"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import type { ApiResponse } from "@/types";
import {
  createProfitDistributionSchema,
  type CreateProfitDistributionInput,
  type ProfitDistributionWithItems,
} from "@/schemas/profit-distribution";
import {
  requestEmergencyWithdrawalSchema,
  type RequestEmergencyWithdrawalInput,
  type EmergencyFundMovementWithUser,
} from "@/schemas/emergency-fund";

import {
  getProfitPreview,
  getProfitDistributions as getProfitDistributionsFromService,
  getProfitDistributionById as getProfitDistributionByIdFromService,
  createDraftDistribution,
  approveDistribution as approveDistributionFromService,
  payDistribution as payDistributionFromService,
  deleteProfitDistribution,
} from "@/lib/finance-profit-service";

import {
  getEmergencyFundBalance as getEmergencyFundBalanceFromService,
  getEmergencyFundMovements as getEmergencyFundMovementsFromService,
  requestWithdrawal as requestWithdrawalFromService,
  executeWithdrawal as executeWithdrawalFromService,
} from "@/lib/finance-emergency-fund-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function revalidateFundsViews() {
  revalidatePath("/finance");
  revalidatePath("/finance/profits");
  revalidatePath("/finance/emergency-fund");
  revalidatePath("/finance/monthly-summary");
}

// ---------------------------------------------------------------------------
// Profit Distribution Actions
// ---------------------------------------------------------------------------

export async function getProfitPreviewAction(
  year: number,
  month: number
) {
  return getProfitPreview(year, month);
}

export async function getProfitDistributions(
  filters?: { year?: number; status?: string }
): Promise<ApiResponse<ProfitDistributionWithItems[]>> {
  return getProfitDistributionsFromService(filters);
}

export async function getProfitDistributionById(
  id: string
): Promise<ApiResponse<ProfitDistributionWithItems>> {
  return getProfitDistributionByIdFromService(id);
}

export async function createProfitDistribution(
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const validatedData: CreateProfitDistributionInput =
      createProfitDistributionSchema.parse(input);

    const result = await createDraftDistribution(validatedData);
    if (result.success) {
      revalidateFundsViews();
    }
    return result;
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

export async function approveProfitDistribution(
  id: string
): Promise<ApiResponse<{ id: string }>> {
  try {
    const result = await approveDistributionFromService(id);
    if (result.success) {
      revalidateFundsViews();
    }
    return result;
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

export async function payProfitDistribution(
  id: string
): Promise<ApiResponse<{ id: string; transactionsCreated: number }>> {
  try {
    const result = await payDistributionFromService(id);
    if (result.success) {
      revalidateFundsViews();
    }
    return result;
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

export async function deleteProfitDistributionAction(
  id: string
): Promise<ApiResponse<void>> {
  try {
    const result = await deleteProfitDistribution(id);
    if (result.success) {
      revalidateFundsViews();
    }
    return result;
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

// ---------------------------------------------------------------------------
// Emergency Fund Actions
// ---------------------------------------------------------------------------

export async function getEmergencyFundBalance() {
  return getEmergencyFundBalanceFromService();
}

export async function getEmergencyFundMovements(
  filters?: { year?: number; type?: string }
): Promise<ApiResponse<EmergencyFundMovementWithUser[]>> {
  return getEmergencyFundMovementsFromService(filters);
}

export async function requestEmergencyWithdrawal(
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }

    const validatedData: RequestEmergencyWithdrawalInput =
      requestEmergencyWithdrawalSchema.parse(input);

    const result = await requestWithdrawalFromService(validatedData);
    if (result.success) {
      revalidateFundsViews();
    }
    return result;
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

export async function executeEmergencyWithdrawal(
  movementId: string
): Promise<ApiResponse<{ transactionId: string }>> {
  try {
    const result = await executeWithdrawalFromService(movementId);
    if (result.success) {
      revalidateFundsViews();
    }
    return result;
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
