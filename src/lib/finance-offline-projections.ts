import { isSameMonth } from "date-fns";
import type {
  ExpensesSnapshot,
  FinanceOfflineQueueItem,
  OfflineClientOption,
  OfflineUserOption,
  ReceivablesSnapshot,
  TransactionSnapshotItem,
  TransactionsSnapshot,
} from "@/lib/finance-offline-types";

function appendPendingLabel(value: string | undefined, fallback: string) {
  const resolved = value?.trim() || fallback;
  return resolved.includes("Sin sincronizar")
    ? resolved
    : `${resolved} (Sin sincronizar)`;
}

function getClient(clientId: string | undefined, clients: OfflineClientOption[]) {
  if (!clientId) return undefined;
  return clients.find((client) => client.id === clientId);
}

function getUserNames(userIds: string[], users: OfflineUserOption[]) {
  const names = userIds
    .map((userId) => users.find((user) => user.id === userId)?.name?.trim())
    .filter((name): name is string => Boolean(name));

  if (names.length === 0) return undefined;
  if (names.length === 1) return names[0];
  return `${names[0]} + ${names.length - 1}`;
}

function sortTransactions(transactions: TransactionsSnapshot) {
  return [...transactions].sort(
    (left, right) => right.date.getTime() - left.date.getTime()
  );
}

function parseRecurringClientId(recurringId: string) {
  const match = recurringId.match(/^recurring-(.+)-\d{4}-\d{1,2}$/);
  return match?.[1];
}

export function projectTransactionsSnapshot(
  snapshot: TransactionsSnapshot,
  queue: FinanceOfflineQueueItem[],
  clients: OfflineClientOption[],
  users: OfflineUserOption[]
) {
  const transactions = new Map(snapshot.map((item) => [item.id, item]));

  for (const queueItem of queue) {
    if (queueItem.kind === "CREATE_INVOICE") {
      const client = getClient(queueItem.payload.clientId, clients);
      transactions.set(queueItem.id, {
        id: queueItem.id,
        type: "INCOME",
        amount: queueItem.payload.amount,
        description: appendPendingLabel(
          undefined,
          `Factura - ${client?.name || "Cliente"}`
        ),
        date: queueItem.payload.generatedAt ?? new Date(queueItem.createdAt),
        clientName: client?.name,
        clientLogo: client?.logo ?? null,
        status: queueItem.payload.status,
        sourceType: "INVOICE",
      });
      continue;
    }

    if (queueItem.kind === "CREATE_EXPENSE") {
      const userIds = queueItem.payload.paidByUserIds ?? [];
      const client = getClient(queueItem.payload.clientId, clients);
      transactions.set(queueItem.id, {
        id: queueItem.id,
        type: "EXPENSE",
        amount: queueItem.payload.amount,
        description: appendPendingLabel(queueItem.payload.description, "Gasto"),
        date: queueItem.payload.date ?? new Date(queueItem.createdAt),
        clientName: client?.name,
        clientLogo: client?.logo ?? null,
        status: queueItem.payload.reimbursed ? "PAID" : "PENDING",
        category: queueItem.payload.category,
        sourceType: "EXPENSE",
        assignedToName: getUserNames(userIds, users),
        assignedToId: userIds[0],
      });
      continue;
    }

    if (queueItem.kind === "CREATE_TRANSACTION") {
      const client = getClient(
        queueItem.payload.relatedClientId ?? queueItem.payload.clientId,
        clients
      );
      transactions.set(queueItem.id, {
        id: queueItem.id,
        type: queueItem.payload.type,
        amount: queueItem.payload.amount,
        description: appendPendingLabel(
          queueItem.payload.description,
          queueItem.payload.type === "HONORARIOS"
            ? "Honorarios"
            : queueItem.payload.type === "EXPENSE"
              ? "Gasto"
              : "Transacción"
        ),
        date: new Date(queueItem.createdAt),
        clientName: client?.name,
        clientLogo: client?.logo ?? null,
        status: queueItem.payload.status,
        category: queueItem.payload.category,
        sourceType: "TRANSACTION",
        assignedToName: queueItem.payload.userId
          ? getUserNames([queueItem.payload.userId], users)
          : undefined,
        assignedToId: queueItem.payload.userId,
        userId: queueItem.payload.userId,
      });
      continue;
    }

    if (queueItem.kind === "MARK_INVOICE_PAID") {
      const current = transactions.get(queueItem.payload.invoiceId);
      if (current) {
        transactions.set(queueItem.payload.invoiceId, {
          ...current,
          status: "PAID",
        });
      }
      continue;
    }

    if (queueItem.kind === "MARK_TRANSACTION_PAID") {
      const current = transactions.get(queueItem.payload.transactionId);
      if (current) {
        transactions.set(queueItem.payload.transactionId, {
          ...current,
          status: "PAID",
        });
      }
      continue;
    }

    if (queueItem.kind === "MARK_EXPENSE_REIMBURSED") {
      const current = transactions.get(queueItem.payload.expenseId);
      if (current) {
        transactions.set(queueItem.payload.expenseId, {
          ...current,
          status: "PAID",
        });
      }
      continue;
    }

    if (queueItem.kind === "MARK_RECURRING_PAID") {
      const client = getClient(
        parseRecurringClientId(queueItem.payload.recurringId),
        clients
      );

      transactions.set(queueItem.id, {
        id: queueItem.id,
        type: "INCOME",
        amount: queueItem.payload.amount,
        description: appendPendingLabel(
          undefined,
          `Cobro recurrente - ${client?.name || "Cliente"}`
        ),
        date: new Date(queueItem.createdAt),
        clientName: client?.name,
        clientLogo: client?.logo ?? null,
        status: "PAID",
        sourceType: "INVOICE",
      });
    }
  }

  return sortTransactions(Array.from(transactions.values()));
}

function computeDaysOverdue(date: Date) {
  const today = new Date();
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(
    (localToday.getTime() - localDate.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function projectReceivablesSnapshot(
  snapshot: ReceivablesSnapshot,
  queue: FinanceOfflineQueueItem[],
  clients: OfflineClientOption[]
) {
  const receivables = new Map(
    snapshot.pendingTransactions.map((item) => [item.id, item])
  );

  for (const queueItem of queue) {
    if (
      queueItem.kind === "CREATE_INVOICE" &&
      queueItem.payload.status !== "PAID"
    ) {
      const client = getClient(queueItem.payload.clientId, clients);
      const date =
        queueItem.payload.dueDate ??
        queueItem.payload.generatedAt ??
        new Date(queueItem.createdAt);

      receivables.set(queueItem.id, {
        id: queueItem.id,
        clientName: client?.name,
        clientLogo: client?.logo ?? null,
        description: appendPendingLabel(undefined, `Factura - ${client?.name || "Cliente"}`),
        amount: queueItem.payload.amount,
        date,
        daysOverdue: computeDaysOverdue(date),
        status: "PENDING",
        sourceType: "INVOICE",
      });
      continue;
    }

    if (
      queueItem.kind === "CREATE_TRANSACTION" &&
      queueItem.payload.type === "INCOME" &&
      queueItem.payload.status !== "PAID"
    ) {
      const client = getClient(
        queueItem.payload.relatedClientId ?? queueItem.payload.clientId,
        clients
      );
      const date = new Date(queueItem.createdAt);

      receivables.set(queueItem.id, {
        id: queueItem.id,
        clientName: client?.name,
        clientLogo: client?.logo ?? null,
        description: appendPendingLabel(
          queueItem.payload.description,
          "Ingreso pendiente"
        ),
        amount: queueItem.payload.amount,
        date,
        daysOverdue: computeDaysOverdue(date),
        status: "PENDING",
        sourceType: "TRANSACTION",
      });
      continue;
    }

    if (queueItem.kind === "MARK_INVOICE_PAID") {
      receivables.delete(queueItem.payload.invoiceId);
      continue;
    }

    if (queueItem.kind === "MARK_TRANSACTION_PAID") {
      receivables.delete(queueItem.payload.transactionId);
      continue;
    }

    if (queueItem.kind === "MARK_RECURRING_PAID") {
      receivables.delete(queueItem.payload.recurringId);
    }
  }

  const pendingTransactions = [...receivables.values()].sort(
    (left, right) => right.date.getTime() - left.date.getTime()
  );

  const totalReceivable = pendingTransactions.reduce(
    (sum, transaction) => sum + transaction.amount,
    0
  );

  return {
    totalReceivable,
    clientsWithDebt: new Set(
      pendingTransactions.map((transaction) => transaction.clientName || transaction.id)
    ).size,
    monthProjection:
      snapshot.monthProjection +
      queue
        .filter(
          (item) =>
            item.kind === "CREATE_INVOICE" &&
            item.payload.status !== "PAID" &&
            isSameMonth(
              item.payload.generatedAt ?? new Date(item.createdAt),
              new Date()
            )
        )
        .reduce((sum, item) => sum + item.payload.amount, 0),
    pendingTransactions,
  };
}

export function projectExpensesSnapshot(
  snapshot: ExpensesSnapshot,
  queue: FinanceOfflineQueueItem[],
  users: OfflineUserOption[],
  clients: OfflineClientOption[]
) {
  const expenses = new Map(snapshot.expenses.map((item) => [item.id, item]));

  for (const queueItem of queue) {
    if (queueItem.kind === "CREATE_EXPENSE") {
      const userIds = queueItem.payload.paidByUserIds ?? [];
      const client = getClient(queueItem.payload.clientId, clients);

      expenses.set(queueItem.id, {
        id: queueItem.id,
        description: appendPendingLabel(queueItem.payload.description, "Gasto"),
        amount: queueItem.payload.amount,
        category: queueItem.payload.category,
        date: queueItem.payload.date ?? new Date(queueItem.createdAt),
        status: queueItem.payload.reimbursed ? "REIMBURSED" : "PENDING",
        assignedToName: getUserNames(userIds, users),
        assignedToId: userIds[0],
        reimbursed: queueItem.payload.reimbursed ?? false,
        clientId: queueItem.payload.clientId,
        clientName: client?.name,
        sourceType: "EXPENSE",
      });
      continue;
    }

    if (
      queueItem.kind === "CREATE_TRANSACTION" &&
      queueItem.payload.type === "EXPENSE"
    ) {
      const client = getClient(
        queueItem.payload.relatedClientId ?? queueItem.payload.clientId,
        clients
      );

      expenses.set(queueItem.id, {
        id: queueItem.id,
        description: appendPendingLabel(queueItem.payload.description, "Gasto"),
        amount: queueItem.payload.amount,
        category: queueItem.payload.category || "OTROS",
        date: new Date(queueItem.createdAt),
        status: queueItem.payload.status,
        assignedToName: queueItem.payload.assignedToId
          ? getUserNames([queueItem.payload.assignedToId], users)
          : undefined,
        assignedToId: queueItem.payload.assignedToId,
        reimbursed: queueItem.payload.status === "PAID",
        clientId: queueItem.payload.relatedClientId ?? queueItem.payload.clientId,
        clientName: client?.name,
        sourceType: "TRANSACTION",
      });
      continue;
    }

    if (queueItem.kind === "MARK_EXPENSE_REIMBURSED") {
      const current = expenses.get(queueItem.payload.expenseId);
      if (current) {
        expenses.set(queueItem.payload.expenseId, {
          ...current,
          status: "REIMBURSED",
          reimbursed: true,
        });
      }
      continue;
    }

    if (queueItem.kind === "MARK_TRANSACTION_PAID") {
      const current = expenses.get(queueItem.payload.transactionId);
      if (current) {
        expenses.set(queueItem.payload.transactionId, {
          ...current,
          status: "PAID",
          reimbursed: true,
        });
      }
    }
  }

  const projectedExpenses = [...expenses.values()].sort(
    (left, right) => right.date.getTime() - left.date.getTime()
  );

  const categoryMap = new Map<string, number>();
  const clientMap = new Map<string, number>();

  projectedExpenses.forEach((expense) => {
    categoryMap.set(
      expense.category,
      (categoryMap.get(expense.category) || 0) + expense.amount
    );

    if (expense.clientName) {
      clientMap.set(
        expense.clientName,
        (clientMap.get(expense.clientName) || 0) + expense.amount
      );
    }
  });

  return {
    ...snapshot,
    totalExpensesThisMonth: projectedExpenses
      .filter((expense) => isSameMonth(expense.date, new Date()))
      .reduce((sum, expense) => sum + expense.amount, 0),
    pendingReimbursement: projectedExpenses
      .filter(
        (expense) =>
          Boolean(expense.assignedToId) &&
          !expense.reimbursed &&
          expense.status !== "PAID" &&
          expense.status !== "REIMBURSED"
      )
      .reduce((sum, expense) => sum + expense.amount, 0),
    expenses: projectedExpenses,
    categoryDistribution: [...categoryMap.entries()].map(([category, amount]) => ({
      category,
      amount,
    })),
    clientDistribution: [...clientMap.entries()].map(([clientName, amount]) => ({
      clientName,
      amount,
    })),
  };
}