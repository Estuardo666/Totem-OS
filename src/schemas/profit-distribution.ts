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
  .pick({ year: true, month: true, notes: true });

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
