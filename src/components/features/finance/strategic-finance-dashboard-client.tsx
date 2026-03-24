"use client";

import dynamic from "next/dynamic";
import { CardSkeleton } from "@/components/ui/skeletons-composite";
import type { FinancialStatsWithProjections, StrategicClientPlan, GlobalProfitabilityStats } from "@/actions/finance-actions";

// Recharts (~400KB) is deferred until component mounts — only loaded on client
const StrategicFinanceDashboard = dynamic(
  () => import("./strategic-finance-dashboard").then(m => ({ default: m.StrategicFinanceDashboard })),
  { ssr: false, loading: () => <CardSkeleton /> }
);

interface StrategicFinanceDashboardClientProps {
  stats: FinancialStatsWithProjections;
  profitability: GlobalProfitabilityStats | null;
  clientPlans: StrategicClientPlan[];
  userRole: string;
}

export function StrategicFinanceDashboardClient({
  stats,
  profitability,
  clientPlans,
  userRole,
}: StrategicFinanceDashboardClientProps) {
  return (
    <StrategicFinanceDashboard
      stats={stats}
      profitability={profitability}
      clientPlans={clientPlans}
      userRole={userRole}
    />
  );
}
