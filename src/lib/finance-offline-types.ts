import type { Client, User } from "@prisma/client";
import type {
  CreateExpenseInput,
  CreateInvoiceInput,
  CreateTransactionInput,
} from "@/schemas/finance";
import type {
  ExpensesStatsData,
  FinancialStats,
} from "@/lib/finance-reporting-service";
import type { FinanceSettingsMetrics } from "@/types";

export const FINANCE_OFFLINE_ROUTES = [
  "/finance/transactions",
  "/finance/receivables",
  "/finance/expenses",
] as const;

export type OfflineClientOption = Pick<
  Client,
  "id" | "name" | "logo" | "monthlyRate"
>;

export type OfflineUserOption = Pick<User, "id" | "name" | "image">;

export type TransactionSnapshotItem = FinancialStats["recentTransactions"][number];
export type TransactionsSnapshot = TransactionSnapshotItem[];

export type ReceivableSnapshotItem = {
  id: string;
  clientName?: string;
  clientLogo?: string | null;
  description: string;
  amount: number;
  date: Date;
  daysOverdue: number;
  status: "PENDING" | "PAID";
  sourceType: "INVOICE" | "TRANSACTION" | "RECURRING";
};

export interface ReceivablesSnapshot {
  totalReceivable: number;
  clientsWithDebt: number;
  monthProjection: number;
  pendingTransactions: ReceivableSnapshotItem[];
}

export type ExpenseSnapshotItem = ExpensesStatsData["expenses"][number] & {
  clientName?: string;
  clientId?: string;
  sourceType?: "EXPENSE" | "TRANSACTION";
};

export interface ExpensesSnapshot
  extends Omit<ExpensesStatsData, "expenses"> {
  expenses: ExpenseSnapshotItem[];
  financeSettingsMetrics?: FinanceSettingsMetrics;
  reimbursedAmount?: number;
  expensesWithoutClient?: { count: number; amount: number };
}

interface FinanceOfflineQueueBase {
  id: string;
  kind:
    | "CREATE_INVOICE"
    | "CREATE_EXPENSE"
    | "CREATE_TRANSACTION"
    | "MARK_INVOICE_PAID"
    | "MARK_TRANSACTION_PAID"
    | "MARK_RECURRING_PAID"
    | "MARK_EXPENSE_REIMBURSED";
  createdAt: string;
}

export interface CreateInvoiceQueueItem extends FinanceOfflineQueueBase {
  kind: "CREATE_INVOICE";
  payload: CreateInvoiceInput;
}

export interface CreateExpenseQueueItem extends FinanceOfflineQueueBase {
  kind: "CREATE_EXPENSE";
  payload: CreateExpenseInput;
}

export interface CreateTransactionQueueItem extends FinanceOfflineQueueBase {
  kind: "CREATE_TRANSACTION";
  payload: CreateTransactionInput;
}

export interface MarkInvoicePaidQueueItem extends FinanceOfflineQueueBase {
  kind: "MARK_INVOICE_PAID";
  payload: {
    invoiceId: string;
    amount?: number;
  };
}

export interface MarkTransactionPaidQueueItem extends FinanceOfflineQueueBase {
  kind: "MARK_TRANSACTION_PAID";
  payload: {
    transactionId: string;
    amount?: number;
  };
}

export interface MarkRecurringPaidQueueItem extends FinanceOfflineQueueBase {
  kind: "MARK_RECURRING_PAID";
  payload: {
    recurringId: string;
    amount: number;
  };
}

export interface MarkExpenseReimbursedQueueItem extends FinanceOfflineQueueBase {
  kind: "MARK_EXPENSE_REIMBURSED";
  payload: {
    expenseId: string;
    amount?: number;
  };
}

export type FinanceOfflineQueueItem =
  | CreateInvoiceQueueItem
  | CreateExpenseQueueItem
  | CreateTransactionQueueItem
  | MarkInvoicePaidQueueItem
  | MarkTransactionPaidQueueItem
  | MarkRecurringPaidQueueItem
  | MarkExpenseReimbursedQueueItem;