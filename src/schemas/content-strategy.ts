import { z } from "zod";

export const upsertClientMonthlyStrategySchema = z
  .object({
    clientId: z.string().cuid("Cliente inválido"),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000),
    prepared: z.boolean(),
    sentAt: z.date().nullable(),
    approved: z.boolean(),
  })
  .transform((input) => ({
    ...input,
    sentAt: input.prepared ? input.sentAt : null,
    approved: input.prepared ? input.approved : false,
  }));

export type UpsertClientMonthlyStrategyInput = z.infer<typeof upsertClientMonthlyStrategySchema>;