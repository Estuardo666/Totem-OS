import { z } from "zod";

 const expenseSplitModeSchema = z.enum(["EQUALLY", "AS_PARTS", "AS_AMOUNTS"]);

 const expenseAllocationSchema = z.object({
   userId: z.string().cuid(),
   amount: z.number().min(0),
   parts: z.number().min(0).optional(),
 });

export const expenseSchema = z.object({
  id: z.string().cuid().optional(),
  description: z.string().min(1, "La descripción es requerida"),
  amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
  category: z.enum(["COMIDA", "TRANSPORTE", "INVITACIONES", "SOFTWARE", "OFICINA", "EQUIPOS", "SALARY", "OTROS"]),
  date: z
    .union([z.date(), z.string()])
    .default(new Date())
    .transform((val) => {
      if (!val) return new Date();
      return typeof val === "string" ? new Date(val) : val;
    }),
  receiptUrl: z.string().url().optional(),
  clientId: z
    .union([z.string().cuid(), z.literal("none"), z.literal(""), z.undefined()])
    .optional()
    .transform((val) => (val === "none" || val === "" || !val ? undefined : val)),
  paidByUserId: z.string().cuid().optional(),
  paidByUserIds: z.array(z.string().cuid()).optional(), // Para gastos compartidos
  splitMode: expenseSplitModeSchema.optional(),
  allocations: z.array(expenseAllocationSchema).optional(),
  reimbursed: z.boolean().default(false),
  payrollId: z.string().cuid().optional(),
});

export const createExpenseSchema = expenseSchema.omit({ id: true });
export const updateExpenseSchema = expenseSchema.partial();

export const payrollSchema = z.object({
  id: z.string().cuid().optional(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
  baseSalary: z.number().min(0),
  reimbursements: z.number().min(0),
  advances: z.number().min(0),
  previousDebt: z.number().min(0),
  totalToPay: z.number().min(0),
  status: z.enum(["PENDING", "PAID"]),
  amountPaid: z.number().min(0).default(0),
  userId: z.string().cuid(),
});

export const createPayrollSchema = payrollSchema.omit({ id: true });
export const updatePayrollSchema = payrollSchema.partial();

export const invoiceSchema = z.object({
  id: z.string().cuid().optional(),
  amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
  status: z.enum(["PENDING", "SENT", "PAID"]),
  clientId: z.string().cuid(),
  dueDate: z.union([z.date(), z.string()]).optional().transform((val) => {
    if (!val) return undefined;
    return typeof val === "string" ? new Date(val) : val;
  }),
  generatedAt: z
    .union([z.date(), z.string()])
    .optional()
    .transform((val) => {
      if (!val) return new Date();
      return typeof val === "string" ? new Date(val) : val;
    }),
});

export const createInvoiceSchema = invoiceSchema.omit({ id: true });
export const updateInvoiceSchema = invoiceSchema.partial();

export type Expense = z.infer<typeof expenseSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
 export type ExpenseSplitMode = z.infer<typeof expenseSplitModeSchema>;
 export type ExpenseAllocationInput = z.infer<typeof expenseAllocationSchema>;
export type Payroll = z.infer<typeof payrollSchema>;
export type CreatePayrollInput = z.infer<typeof createPayrollSchema>;
export type UpdatePayrollInput = z.infer<typeof updatePayrollSchema>;
export const transactionSchema = z.object({
  id: z.string().cuid().optional(),
  amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
  type: z.enum(["INCOME", "EXPENSE", "HONORARIOS"]),
  status: z.enum(["PENDING", "PAID", "CANCELLED"]).default("PENDING"),
  description: z.string().optional(),
  category: z.enum(["COMIDA", "TRANSPORTE", "INVITACIONES", "SOFTWARE", "OFICINA", "EQUIPOS", "SALARY", "OTROS"]).optional(),
  relatedClientId: z.string().cuid().optional(),
  clientId: z.string().cuid().optional(),
  assignedToId: z.string().cuid().optional(), // Para gastos (reembolsos)
  userId: z.string().cuid().optional(), // Para honorarios/salarios (quién recibió el pago)
});

export const createTransactionSchema = transactionSchema.omit({ id: true });
export const updateTransactionSchema = transactionSchema.partial();

export type Invoice = z.infer<typeof invoiceSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

// Schema para actualizar configuración salarial de usuario
export const updateUserSalaryConfigSchema = z.object({
  salaryType: z.enum(["HOURLY", "MONTHLY", "PROFIT_SHARE"]).optional(),
  baseSalary: z.number().min(0).optional().nullable(),
  hourlyRate: z.number().min(0).optional(),
  profitSharePercent: z.number().min(0).max(100).optional().nullable(),
  bankAccountInfo: z.string().optional().nullable(),
});

export type UpdateUserSalaryConfigInput = z.infer<typeof updateUserSalaryConfigSchema>;

// Schema para procesar pago de salario/honorarios
export const processSalaryPaymentSchema = z.object({
  recipientUserId: z.string().cuid(),
  amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
  includeReimbursements: z.boolean().default(false),
  description: z.string().optional(),
});

export type ProcessSalaryPaymentInput = z.infer<typeof processSalaryPaymentSchema>;

export const clientMonthlyClosureSchema = z
  .object({
    clientId: z.string().cuid(),
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
    accrualStatus: z.enum(["FULL", "PARTIAL", "NONE"]),
    accruedAmount: z.number().min(0, "El monto devengado no puede ser negativo"),
    notes: z.string().max(1000, "Máximo 1000 caracteres").optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.accrualStatus === "NONE" && data.accruedAmount !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accruedAmount"],
        message: "Si el mes no se devenga, el monto debe ser 0",
      });
    }

    if (data.accrualStatus !== "NONE" && data.accruedAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accruedAmount"],
        message: "Indica un monto devengado mayor a 0",
      });
    }
  });

export type ClientMonthlyClosureInput = z.infer<typeof clientMonthlyClosureSchema>;

