"use client";

import { useEffect, useMemo, useState } from "react";
import { TransactionList } from "@/components/features/finance/transaction-list";
import { FinanceOfflineNotice } from "@/components/features/finance/finance-offline-notice";
import { useFinanceOfflineState } from "@/components/features/finance/use-finance-offline-state";
import { projectTransactionsSnapshot } from "@/lib/finance-offline-projections";
import {
  cacheTransactionsSnapshot,
  getCachedFinanceClients,
  getCachedFinanceUsers,
  getCachedTransactionsSnapshot,
} from "@/lib/finance-offline-store";
import type { FinancialStats } from "@/lib/finance-reporting-service";

interface TransactionsOfflineViewProps {
  transactions: FinancialStats["recentTransactions"];
}

export function TransactionsOfflineView({
  transactions,
}: TransactionsOfflineViewProps) {
  const { queue } = useFinanceOfflineState();
  const [baseTransactions, setBaseTransactions] = useState(transactions);

  useEffect(() => {
    if (transactions.length > 0) {
      setBaseTransactions(transactions);
      cacheTransactionsSnapshot(transactions);
      return;
    }

    const cachedTransactions = getCachedTransactionsSnapshot();
    if (cachedTransactions.length > 0) {
      setBaseTransactions(cachedTransactions);
    }
  }, [transactions]);

  const projectedTransactions = useMemo(
    () =>
      projectTransactionsSnapshot(
        baseTransactions,
        queue,
        getCachedFinanceClients(),
        getCachedFinanceUsers()
      ),
    [baseTransactions, queue]
  );

  return (
    <>
      <FinanceOfflineNotice />
      <TransactionList transactions={projectedTransactions} />
    </>
  );
}