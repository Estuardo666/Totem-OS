/**
 * Finance Expense Service
 * Gestión de gastos (CRUD + reembolsos)
 */

import { db } from "@/lib/db";
import type { Expense } from "@prisma/client";

export interface CreateExpenseInput {
  description: string;
  amount: number;
  category: string;
  date?: Date;
  receiptUrl?: string;
  clientId?: string;
  paidByUserId?: string;
  paidByUserIds?: string[];
  reimbursed?: boolean;
  payrollId?: string;
}

export interface UpdateExpenseInput {
  id: string;
  description?: string;
  amount?: number;
  category?: string;
  date?: Date;
  receiptUrl?: string;
  clientId?: string;
}

/**
 * Crea uno o múltiples gastos (soporta gastos compartidos)
 */
export async function createExpenseInDb(
  data: CreateExpenseInput & { createdByUserId: string; isEditor: boolean }
): Promise<Expense> {
  const { createdByUserId, isEditor, ...input } = data;

  // Si es EDITOR, forzar paidByUserId a su userId
  let paidByUserIds = input.paidByUserIds || [];
  if (isEditor) {
    paidByUserIds = [createdByUserId];
  } else if (input.paidByUserId) {
    paidByUserIds = [input.paidByUserId];
  }

  const isSharedExpense = paidByUserIds.length > 1;
  const amountPerUser = isSharedExpense
    ? Math.round((input.amount / paidByUserIds.length) * 100) / 100
    : input.amount;

  // Si hay usuarios, crear gastos para cada uno
  let expenses: Expense[] = [];
  
  for (const userId of paidByUserIds) {
    const expense = await db.expense.create({
      data: {
        description: isSharedExpense
          ? `${input.description} (Compartido - ${paidByUserIds.length} personas)`
          : input.description,
        amount: amountPerUser,
        category: input.category,
        date: input.date ?? new Date(),
        receiptUrl: input.receiptUrl ?? null,
        clientId: input.clientId ?? null,
        paidByUserId: userId,
        reimbursed: input.reimbursed ?? false,
        payrollId: input.payrollId ?? null,
      },
    });
    expenses.push(expense);
  }

  // Si no hay usuarios asignados, crear un solo gasto sin asignar
  if (paidByUserIds.length === 0) {
    const expense = await db.expense.create({
      data: {
        description: input.description,
        amount: input.amount,
        category: input.category,
        date: input.date ?? new Date(),
        receiptUrl: input.receiptUrl ?? null,
        clientId: input.clientId ?? null,
        paidByUserId: null,
        reimbursed: input.reimbursed ?? false,
        payrollId: input.payrollId ?? null,
      },
    });
    expenses.push(expense);

    // Crear transacción asociada si hay cliente
    if (input.clientId) {
      await db.transaction.create({
        data: {
          amount: input.amount,
          type: "EXPENSE",
          status: input.reimbursed ? "PAID" : "PENDING",
          description: input.description,
          category: input.category,
          relatedClientId: input.clientId,
          clientId: input.clientId,
          assignedToId: null,
        },
      });
    }
  }

  return expenses[0];
}

/**
 * Obtiene un gasto por ID
 */
export async function getExpenseByIdFromDb(
  id: string
): Promise<Expense | null> {
  return db.expense.findUnique({ where: { id } });
}

/**
 * Actualiza un gasto
 */
export async function updateExpenseInDb(
  id: string,
  data: UpdateExpenseInput
): Promise<Expense> {
  return db.expense.update({
    where: { id },
    data: {
      ...(data.description && { description: data.description }),
      ...(data.amount && { amount: data.amount }),
      ...(data.category && { category: data.category }),
      ...(data.date && { date: data.date }),
      ...(data.receiptUrl !== undefined && { receiptUrl: data.receiptUrl || null }),
      ...(data.clientId !== undefined && { clientId: data.clientId || null }),
    },
  });
}

/**
 * Marca un gasto como reembolsado
 */
export async function markExpenseAsReimbursedInDb(
  id: string
): Promise<Expense> {
  return db.expense.update({
    where: { id },
    data: { reimbursed: true },
  });
}

/**
 * Obtiene gastos filtrados
 */
export async function getExpensesFromDb(options?: {
  userId?: string;
  category?: string;
  isReimbursed?: boolean;
  startDate?: Date;
  endDate?: Date;
}): Promise<Expense[]> {
  return db.expense.findMany({
    where: {
      ...(options?.userId && { paidByUserId: options.userId }),
      ...(options?.category && { category: options.category }),
      ...(options?.isReimbursed !== undefined && { reimbursed: options.isReimbursed }),
      ...(options?.startDate && options?.endDate && {
        date: {
          gte: options.startDate,
          lte: options.endDate,
        },
      }),
    },
    orderBy: { date: "desc" },
  });
}

/**
 * Obtiene suma de gastos para un período
 */
export async function getExpensesSumFromDb(options?: {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<number> {
  const expenses = await getExpensesFromDb(options);
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

/**
 * Elimina un gasto
 */
export async function deleteExpenseFromDb(id: string): Promise<void> {
  await db.expense.delete({ where: { id } });
}

/**
 * Liquida reembolsos (crea transacción de pago)
 */
export async function liquidateExpenseReimbursements(
  expenseIds: string[]
): Promise<{ transactionId: string }> {
  const expenses = await db.expense.findMany({
    where: { id: { in: expenseIds }, reimbursed: false },
  });

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  const transaction = await db.transaction.create({
    data: {
      amount: totalAmount,
      type: "EXPENSE",
      status: "PAID",
      description: `Liquidación de ${expenses.length} reembolso(s)`,
      category: "REIMBURSEMENT",
    },
  });

  // Marcar todos como reembolsados
  await db.expense.updateMany({
    where: { id: { in: expenseIds } },
    data: { reimbursed: true },
  });

  return { transactionId: transaction.id };
}
