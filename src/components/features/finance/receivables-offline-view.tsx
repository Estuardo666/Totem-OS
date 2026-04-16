"use client";

import { useEffect, useMemo, useState } from "react";
import { FinanceOfflineNotice } from "@/components/features/finance/finance-offline-notice";
import { ReceivablesSummary } from "@/components/features/finance/receivables-summary";
import { ReceivablesTable } from "@/components/features/finance/receivables-table";
import { useFinanceOfflineState } from "@/components/features/finance/use-finance-offline-state";
import { projectReceivablesSnapshot } from "@/lib/finance-offline-projections";
import {
  cacheReceivablesSnapshot,
  getCachedFinanceClients,
  getCachedReceivablesSnapshot,
} from "@/lib/finance-offline-store";
import type { ReceivablesSnapshot } from "@/lib/finance-offline-types";

interface ReceivablesOfflineViewProps {
  snapshot: ReceivablesSnapshot;
}

export function ReceivablesOfflineView({
  snapshot,
}: ReceivablesOfflineViewProps) {
  const { queue } = useFinanceOfflineState();
  const [baseSnapshot, setBaseSnapshot] = useState(snapshot);

  useEffect(() => {
    if (
      snapshot.pendingTransactions.length > 0 ||
      snapshot.totalReceivable > 0 ||
      snapshot.monthProjection > 0
    ) {
      setBaseSnapshot(snapshot);
      cacheReceivablesSnapshot(snapshot);
      return;
    }

    const cachedSnapshot = getCachedReceivablesSnapshot();
    if (
      cachedSnapshot.pendingTransactions.length > 0 ||
      cachedSnapshot.totalReceivable > 0 ||
      cachedSnapshot.monthProjection > 0
    ) {
      setBaseSnapshot(cachedSnapshot);
    }
  }, [snapshot]);

  const projectedSnapshot = useMemo(
    () =>
      projectReceivablesSnapshot(
        baseSnapshot,
        queue,
        getCachedFinanceClients()
      ),
    [baseSnapshot, queue]
  );

  return (
    <>
      <FinanceOfflineNotice />
      <div className="mb-8">
        <ReceivablesSummary
          totalReceivable={projectedSnapshot.totalReceivable}
          clientsWithDebt={projectedSnapshot.clientsWithDebt}
          monthProjection={projectedSnapshot.monthProjection}
        />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Transacciones Pendientes</h2>
        <ReceivablesTable transactions={projectedSnapshot.pendingTransactions} />
      </div>
    </>
  );
}