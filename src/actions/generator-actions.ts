"use server";

// Módulo de generador desactivado y removido.
export type PlanType = "STANDARD" | "PLAN_2";

export async function generateMonthlyPlan(): Promise<{ success: false; error: string }> {
  return { success: false, error: "El generador ha sido eliminado" };
}
