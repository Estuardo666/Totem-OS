"use server";

import type { ApiResponse } from "@/types";

// Módulo de generador desactivado y removido.
export type PlanType = "STANDARD" | "PLAN_2";

export async function generateMonthlyPlan(
  _clientIds: string[],
  _targetDate: Date,
  _planType: PlanType
): Promise<ApiResponse<{ tasksCreated: number; clientsProcessed: number }>> {
  return { success: false, error: "El generador ha sido eliminado" };
}
