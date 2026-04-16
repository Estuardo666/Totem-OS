import type {
  ExpensesSnapshot,
  FinanceOfflineQueueItem,
  OfflineClientOption,
  OfflineUserOption,
  ReceivablesSnapshot,
  TransactionsSnapshot,
} from "@/lib/finance-offline-types";

const QUEUE_KEY = "totem_finance_offline_queue";
const CLIENTS_KEY = "totem_finance_clients_cache";
const USERS_KEY = "totem_finance_users_cache";
const TRANSACTIONS_KEY = "totem_finance_transactions_cache";
const RECEIVABLES_KEY = "totem_finance_receivables_cache";
const EXPENSES_KEY = "totem_finance_expenses_cache";

export const FINANCE_OFFLINE_CHANGE_EVENT = "totem:finance-offline-change";

const isBrowser = () => typeof window !== "undefined";

function emitFinanceOfflineChange() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(FINANCE_OFFLINE_CHANGE_EVENT));
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }

  emitFinanceOfflineChange();
}

function withDate<T extends string | Date | undefined>(value: T) {
  if (!value) return undefined;
  return new Date(value);
}

function rehydrateQueueItem(item: FinanceOfflineQueueItem): FinanceOfflineQueueItem {
  if (item.kind === "CREATE_INVOICE") {
    return {
      ...item,
      payload: {
        ...item.payload,
        dueDate: withDate(item.payload.dueDate),
        generatedAt: withDate(item.payload.generatedAt),
      },
    };
  }

  if (item.kind === "CREATE_EXPENSE") {
    return {
      ...item,
      payload: {
        ...item.payload,
        date: withDate(item.payload.date) ?? new Date(item.createdAt),
      },
    };
  }

  return item;
}

export function buildFinanceOfflineQueueId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function subscribeFinanceOffline(listener: () => void) {
  if (!isBrowser()) return () => undefined;

  const handleChange = () => listener();
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === QUEUE_KEY ||
      event.key === CLIENTS_KEY ||
      event.key === USERS_KEY ||
      event.key === TRANSACTIONS_KEY ||
      event.key === RECEIVABLES_KEY ||
      event.key === EXPENSES_KEY
    ) {
      listener();
    }
  };

  window.addEventListener(FINANCE_OFFLINE_CHANGE_EVENT, handleChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(FINANCE_OFFLINE_CHANGE_EVENT, handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function readFinanceQueue() {
  const stored = readJson<FinanceOfflineQueueItem[]>(QUEUE_KEY, []);
  return stored.map(rehydrateQueueItem);
}

export function enqueueFinanceAction(item: FinanceOfflineQueueItem) {
  const queue = readFinanceQueue();
  writeJson(QUEUE_KEY, [...queue, item]);
}

export function removeFinanceAction(queueItemId: string) {
  const queue = readFinanceQueue().filter((item) => item.id !== queueItemId);
  writeJson(QUEUE_KEY, queue);
}

export function cacheFinanceClients(clients: OfflineClientOption[]) {
  const minimalClients = clients.map((client) => ({
    id: client.id,
    name: client.name,
    logo: client.logo ?? null,
    monthlyRate: client.monthlyRate ?? 0,
  }));
  writeJson(CLIENTS_KEY, minimalClients);
}

export function getCachedFinanceClients() {
  return readJson<OfflineClientOption[]>(CLIENTS_KEY, []);
}

export function cacheFinanceUsers(users: OfflineUserOption[]) {
  const minimalUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    image: user.image ?? null,
  }));
  writeJson(USERS_KEY, minimalUsers);
}

export function getCachedFinanceUsers() {
  return readJson<OfflineUserOption[]>(USERS_KEY, []);
}

export function cacheTransactionsSnapshot(transactions: TransactionsSnapshot) {
  writeJson(TRANSACTIONS_KEY, transactions);
}

export function getCachedTransactionsSnapshot() {
  const stored = readJson<Array<Omit<TransactionsSnapshot[number], "date"> & { date: string }>>(
    TRANSACTIONS_KEY,
    []
  );

  return stored.map((transaction) => ({
    ...transaction,
    date: new Date(transaction.date),
  }));
}

export function cacheReceivablesSnapshot(snapshot: ReceivablesSnapshot) {
  writeJson(RECEIVABLES_KEY, snapshot);
}

export function getCachedReceivablesSnapshot() {
  const stored = readJson<
    Omit<ReceivablesSnapshot, "pendingTransactions"> & {
      pendingTransactions: Array<
        Omit<ReceivablesSnapshot["pendingTransactions"][number], "date"> & {
          date: string;
        }
      >;
    }
  >(RECEIVABLES_KEY, {
    totalReceivable: 0,
    clientsWithDebt: 0,
    monthProjection: 0,
    pendingTransactions: [],
  });

  return {
    ...stored,
    pendingTransactions: stored.pendingTransactions.map((transaction) => ({
      ...transaction,
      date: new Date(transaction.date),
    })),
  };
}

export function cacheExpensesSnapshot(snapshot: ExpensesSnapshot) {
  writeJson(EXPENSES_KEY, snapshot);
}

export function getCachedExpensesSnapshot() {
  const stored = readJson<
    Omit<ExpensesSnapshot, "expenses"> & {
      expenses: Array<
        Omit<ExpensesSnapshot["expenses"][number], "date"> & {
          date: string;
        }
      >;
    }
  >(EXPENSES_KEY, {
    totalExpensesThisMonth: 0,
    pendingReimbursement: 0,
    expenses: [],
    categoryDistribution: [],
    clientDistribution: [],
  });

  return {
    ...stored,
    expenses: stored.expenses.map((expense) => ({
      ...expense,
      date: new Date(expense.date),
    })),
  };
}