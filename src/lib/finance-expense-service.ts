/**
 * Finance Expense Service
 * Gestión de gastos (CRUD + reembolsos)
 */

import { db } from "@/lib/db";
import type { Expense } from "@prisma/client";
import type { ExpenseAllocationInput, ExpenseSplitMode } from "@/schemas/finance";

export interface CreateExpenseInput {
  description: string;
  amount: number;
  category: string;
  date?: Date;
  receiptUrl?: string;
  clientId?: string;
  paidByUserId?: string;
  paidByUserIds?: string[];
  splitMode?: ExpenseSplitMode;
  allocations?: ExpenseAllocationInput[];
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

  let paidByUserIds = input.paidByUserIds || [];
  if (isEditor) {
    paidByUserIds = [createdByUserId];
  } else if (paidByUserIds.length === 0 && input.paidByUserId) {
    paidByUserIds = [input.paidByUserId];
  }

  let expenses: Expense[] = [];

  const allocations =
    paidByUserIds.length > 0
      ? resolveExpenseAllocations({
          allocations: input.allocations,
          paidByUserIds,
          totalAmount: input.amount,
        })
      : [];

  const isSharedExpense = allocations.length > 1;

  for (const allocation of allocations) {
    const expense = await db.expense.create({
      data: {
        description: isSharedExpense
          ? `${input.description} (Compartido - ${allocations.length} personas)`
          : input.description,
        amount: allocation.amount,
        category: input.category,
        date: input.date ?? new Date(),
        receiptUrl: input.receiptUrl ?? null,
        clientId: input.clientId ?? null,
        paidByUserId: allocation.userId,
        reimbursed: input.reimbursed ?? false,
        payrollId: input.payrollId ?? null,
      },
    });
    expenses.push(expense);
  }

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
  }

  return expenses[0];
}

function resolveExpenseAllocations({
  allocations,
  paidByUserIds,
  totalAmount,
}: {
  allocations?: ExpenseAllocationInput[];
  paidByUserIds: string[];
  totalAmount: number;
}): ExpenseAllocationInput[] {
  if (allocations && allocations.length > 0) {
    const filteredAllocations = allocations.filter((allocation) =>
      paidByUserIds.includes(allocation.userId)
    );

    if (filteredAllocations.length > 0) {
      return normalizeAllocationsTotal(filteredAllocations, totalAmount);
    }
  }

  const equalAmount = roundCurrency(totalAmount / paidByUserIds.length);

  return paidByUserIds.map((userId, index) => ({
    userId,
    amount:
      index === paidByUserIds.length - 1
        ? roundCurrency(totalAmount - equalAmount * (paidByUserIds.length - 1))
        : equalAmount,
  }));
}

function normalizeAllocationsTotal(
  allocations: ExpenseAllocationInput[],
  totalAmount: number
): ExpenseAllocationInput[] {
  const normalizedAllocations = allocations.map((allocation) => ({
    ...allocation,
    amount: roundCurrency(allocation.amount),
  }));
  const currentTotal = normalizedAllocations.reduce(
    (sum, allocation) => sum + allocation.amount,
    0
  );
  const diff = roundCurrency(totalAmount - currentTotal);

  if (Math.abs(diff) <= 0.01 && normalizedAllocations.length > 0) {
    const lastAllocation = normalizedAllocations[normalizedAllocations.length - 1];
    normalizedAllocations[normalizedAllocations.length - 1] = {
      ...lastAllocation,
      amount: roundCurrency(lastAllocation.amount + diff),
    };
  }

  return normalizedAllocations;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
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
