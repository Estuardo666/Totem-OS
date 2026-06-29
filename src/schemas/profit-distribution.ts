import { z } from "zod";

export const profitDistributionItemSchema = z.object({
  userId: z.string().cuid(),
  percent: z.number().min(0).max(100),
  amount: z.number().min(0),
  paidTransactionId: z.string().optional().nullable(),
});

export const profitDistributionSchema = z.object({
  id: z.string().cuid().optional(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  status: z.enum(["DRAFT", "APPROVED", "PAID"]).default("DRAFT"),
  totalProfit: z.number(),
  fundContribution: z.number().min(0).default(0),
  distributableAmount: z.number().min(0).default(0),
  notes: z.string().max(1000).optional().nullable(),
});

export const createProfitDistributionSchema = profitDistributionSchema
  .omit({ id: true, status: true })
  .extend({
    items: z.array(profitDistributionItemSchema).min(1, "Agrega al menos un socio"),
  })
  .superRefine((data, ctx) => {
    const totalPercent = data.items.reduce((sum, item) => sum + item.percent, 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `La suma de porcentajes debe ser 100% (actual: ${totalPercent.toFixed(1)}%)`,
        path: ["items"],
      });
    }
    if (data.distributableAmount > data.totalProfit - data.fundContribution + 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El monto distribuible no puede superar la utilidad neta menos el aporte al fondo",
        path: ["distributableAmount"],
      });
    }
  });

export const approveProfitDistributionSchema = z.object({
  id: z.string().cuid(),
  notes: z.string().max(1000).optional(),
});

export const payProfitDistributionSchema = z.object({
  id: z.string().cuid(),
});

export type ProfitDistributionItemInput = z.infer<typeof profitDistributionItemSchema>;
export type CreateProfitDistributionInput = z.infer<typeof createProfitDistributionSchema>;
export type ApproveProfitDistributionInput = z.infer<typeof approveProfitDistributionSchema>;
export type PayProfitDistributionInput = z.infer<typeof payProfitDistributionSchema>;

export interface ProfitDistributionWithItems {
  id: string;
  year: number;
  month: number;
  status: string;
  totalProfit: number;
  fundContribution: number;
  distributableAmount: number;
  notes: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    distributionId: string;
    userId: string;
    percent: number;
    amount: number;
    paidTransactionId: string | null;
    createdAt: Date;
    user: {
      id: string;
      name: string;
      image: string | null;
      profitSharePercent: number | null;
    };
  }>;
}
