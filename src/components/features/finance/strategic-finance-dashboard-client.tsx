"use client";

import dynamic from "next/dynamic";
import { CardSkeleton } from "@/components/ui/skeletons-composite";
import type { FinanceDashboardPeriodSnapshot, FinancialStats, StrategicClientPlan, GlobalProfitabilityStats } from "@/actions/finance-actions";

type ReceivablesData = {
  totalReceivable: number;
  clientsWithDebt: number;
  monthProjection: number;
  pendingTransactions: Array<{
    id: string;
    clientName?: string;
    clientLogo?: string | null;
    description: string;
    amount: number;
    date: Date;
    daysOverdue: number;
    status: "PENDING" | "PAID";
    sourceType: "INVOICE" | "TRANSACTION" | "RECURRING";
  }>;
};

// Recharts (~400KB) is deferred until component mounts — only loaded on client
const StrategicFinanceDashboard = dynamic(
  () => import("./strategic-finance-dashboard").then(m => ({ default: m.StrategicFinanceDashboard })),
  { ssr: false, loading: () => <CardSkeleton /> }
);

interface StrategicFinanceDashboardClientProps {
  stats: FinancialStats;
  profitability: GlobalProfitabilityStats | null;
  clientPlans: StrategicClientPlan[];
  receivables: ReceivablesData | null;
  periodSnapshots: FinanceDashboardPeriodSnapshot[];
  userRole: string;
}

export function StrategicFinanceDashboardClient({
  stats,
  profitability,
  clientPlans,
  receivables,
  periodSnapshots,
  userRole,
}: StrategicFinanceDashboardClientProps) {
  return (
    <StrategicFinanceDashboard
      stats={stats}
      profitability={profitability}
      clientPlans={clientPlans}
      receivables={receivables}
      periodSnapshots={periodSnapshots}
      userRole={userRole}
    />
  );
}
