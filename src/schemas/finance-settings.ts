import { z } from "zod";

export const financeBudgetCategorySchema = z.enum([
  "COMIDA",
  "TRANSPORTE",
  "INVITACIONES",
  "SOFTWARE",
  "OFICINA",
  "EQUIPOS",
  "OTROS",
]);

export const financeBudgetBaseSchema = z.enum(["COLLECTED_INCOME", "PAID_INCOME"]);
export const financeAdminBudgetModeSchema = z.enum(["PERCENTAGE", "FIXED"]);

export const financeUserBudgetOverrideSchema = z.object({
  userId: z.string().cuid(),
  mode: financeAdminBudgetModeSchema,
  value: z.number().min(0),
});

export const financeSettingsSchema = z.object({
  budgetControlEnabled: z.boolean().default(true),
  globalBudgetPercentage: z.number().min(0).max(100).default(10),
  budgetBase: financeBudgetBaseSchema.default("COLLECTED_INCOME"),
  adminBudgetEnabled: z.boolean().default(true),
  adminBudgetMode: financeAdminBudgetModeSchema.default("PERCENTAGE"),
  adminBudgetDefaultValue: z.number().min(0).default(5),
  allowAdminBudgetOverrides: z.boolean().default(false),
  adminBudgetOverrides: z.array(financeUserBudgetOverrideSchema).default([]),
  trackedCategories: z.array(financeBudgetCategorySchema).min(1).default(["COMIDA", "TRANSPORTE", "INVITACIONES"]),
  warningThresholdPercent: z.number().min(0).max(100).default(80),
  alertThresholdPercent: z.number().min(0).max(100).default(100),
  approvalRequiredOnExceed: z.boolean().default(true),
  approverMode: z.enum(["ANY_ADMIN", "PRIMARY_ADMIN", "SELECTED_USERS"]).default("ANY_ADMIN"),
  approverUserIds: z.array(z.string().cuid()).default([]),
  personalAnalyticsEnabled: z.boolean().default(false),
  showPersonalAnalyticsInDashboard: z.boolean().default(false),
  personalAnalyticsAdminsOnly: z.boolean().default(true),
});

export const updateFinanceSettingsSchema = financeSettingsSchema.superRefine((data, ctx) => {
  if (data.alertThresholdPercent < data.warningThresholdPercent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El umbral de alerta no puede ser menor al de advertencia",
      path: ["alertThresholdPercent"],
    });
  }

  if (data.adminBudgetMode === "PERCENTAGE" && data.adminBudgetDefaultValue > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El cupo por ADMIN en porcentaje no puede ser mayor a 100",
      path: ["adminBudgetDefaultValue"],
    });
  }

  if (data.approverMode === "SELECTED_USERS" && data.approverUserIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debes seleccionar al menos un aprobador",
      path: ["approverUserIds"],
    });
  }
});

export type FinanceBudgetCategory = z.infer<typeof financeBudgetCategorySchema>;
export type FinanceBudgetBase = z.infer<typeof financeBudgetBaseSchema>;
export type FinanceAdminBudgetMode = z.infer<typeof financeAdminBudgetModeSchema>;
export type FinanceUserBudgetOverride = z.infer<typeof financeUserBudgetOverrideSchema>;
export type FinanceSettings = z.infer<typeof financeSettingsSchema>;
export type UpdateFinanceSettingsInput = z.infer<typeof updateFinanceSettingsSchema>;
