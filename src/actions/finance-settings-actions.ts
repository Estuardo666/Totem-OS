"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  financeSettingsSchema,
  updateFinanceSettingsSchema,
  type FinanceSettings,
  type UpdateFinanceSettingsInput,
} from "@/schemas/finance-settings";
import type { ApiResponse } from "@/types";

const FINANCE_SETTINGS_KEY = "financeSettings";

const DEFAULT_FINANCE_SETTINGS: FinanceSettings = financeSettingsSchema.parse({
  budgetControlEnabled: true,
  globalBudgetPercentage: 10,
  budgetBase: "COLLECTED_INCOME",
  adminBudgetEnabled: true,
  adminBudgetMode: "PERCENTAGE",
  adminBudgetDefaultValue: 5,
  allowAdminBudgetOverrides: false,
  adminBudgetOverrides: [],
  trackedCategories: ["COMIDA", "TRANSPORTE", "INVITACIONES"],
  warningThresholdPercent: 80,
  alertThresholdPercent: 100,
  approvalRequiredOnExceed: true,
  approverMode: "ANY_ADMIN",
  approverUserIds: [],
  personalAnalyticsEnabled: false,
  showPersonalAnalyticsInDashboard: false,
  personalAnalyticsAdminsOnly: true,
});

function ensureAdmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "ADMIN";
}

export async function getFinanceSettings(): Promise<ApiResponse<FinanceSettings>> {
  try {
    const session = await auth();

    if (!ensureAdmin(session)) {
      return { success: false, error: "No autorizado" };
    }

    const config = await db.globalConfig.findUnique({
      where: { key: FINANCE_SETTINGS_KEY },
    });

    if (!config?.value) {
      return { success: true, data: DEFAULT_FINANCE_SETTINGS };
    }

    const parsed = financeSettingsSchema.parse(JSON.parse(config.value));
    return { success: true, data: parsed };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al cargar configuración financiera",
    };
  }
}

export async function updateFinanceSettings(
  input: unknown
): Promise<ApiResponse<FinanceSettings>> {
  try {
    const session = await auth();

    if (!ensureAdmin(session)) {
      return { success: false, error: "No autorizado" };
    }

    const validatedData: UpdateFinanceSettingsInput = updateFinanceSettingsSchema.parse(input);

    await db.globalConfig.upsert({
      where: { key: FINANCE_SETTINGS_KEY },
      update: {
        value: JSON.stringify(validatedData),
      },
      create: {
        key: FINANCE_SETTINGS_KEY,
        value: JSON.stringify(validatedData),
      },
    });

    revalidatePath("/finance");
    revalidatePath("/finance/settings");
    revalidatePath("/finance/alerts");

    return { success: true, data: validatedData };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al guardar configuración financiera",
    };
  }
}

export async function getFinanceSettingsWithFallback(): Promise<FinanceSettings> {
  const config = await db.globalConfig.findUnique({
    where: { key: FINANCE_SETTINGS_KEY },
  });

  if (!config?.value) {
    return DEFAULT_FINANCE_SETTINGS;
  }

  try {
    return financeSettingsSchema.parse(JSON.parse(config.value));
  } catch {
    return DEFAULT_FINANCE_SETTINGS;
  }
}
