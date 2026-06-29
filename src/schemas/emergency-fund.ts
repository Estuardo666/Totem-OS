import { z } from "zod";

export const emergencyFundMovementSchema = z.object({
  id: z.string().cuid().optional(),
  type: z.enum(["CONTRIBUTION", "WITHDRAWAL"]),
  amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
  balanceAfter: z.number(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  reason: z.string().max(500).optional().nullable(),
  authorizedByUserId: z.string().cuid().optional().nullable(),
  relatedTransactionId: z.string().cuid().optional().nullable(),
});

export const requestEmergencyWithdrawalSchema = z.object({
  amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
  reason: z.string().min(1, "Indica el motivo del retiro").max(500),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
}).superRefine((data, ctx) => {
  if (!data.reason.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El motivo no puede estar vacío",
      path: ["reason"],
    });
  }
});

export const approveEmergencyWithdrawalSchema = z.object({
  id: z.string().cuid(),
});

export const executeEmergencyWithdrawalSchema = z.object({
  id: z.string().cuid(),
});

export const emergencyFundSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  monthlyContributionPct: z.number().min(0).max(100).default(10),
  minBalance: z.number().min(0).default(0),
  maxBalance: z.number().min(0).optional(),
  approvalRequired: z.boolean().default(true),
  approverMode: z.enum(["ANY_ADMIN", "PRIMARY_ADMIN", "SELECTED_USERS"]).default("ANY_ADMIN"),
  approverUserIds: z.array(z.string().cuid()).default([]),
  autoContributeOnClose: z.boolean().default(true),
});

export type EmergencyFundMovementInput = z.infer<typeof emergencyFundMovementSchema>;
export type RequestEmergencyWithdrawalInput = z.infer<typeof requestEmergencyWithdrawalSchema>;
export type ApproveEmergencyWithdrawalInput = z.infer<typeof approveEmergencyWithdrawalSchema>;
export type ExecuteEmergencyWithdrawalInput = z.infer<typeof executeEmergencyWithdrawalSchema>;
export type EmergencyFundSettings = z.infer<typeof emergencyFundSettingsSchema>;

export interface EmergencyFundMovementWithUser {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  year: number;
  month: number;
  reason: string | null;
  authorizedByUserId: string | null;
  relatedTransactionId: string | null;
  createdAt: Date;
  authorizedBy: {
    id: string;
    name: string;
    image: string | null;
  } | null;
}
