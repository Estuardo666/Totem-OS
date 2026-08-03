import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getFinanceDashboardPeriodSnapshots, getFinancialStats, getGlobalProfitabilityStats, getReceivables, getStrategicClientPlans } from "@/actions/finance-actions";
import { StrategicFinanceDashboardClient } from "@/components/features/finance/strategic-finance-dashboard-client";
import { PageHeader } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeletons-composite";

// Streamed: fetches finance data, then renders the dashboard
async function FinanceBody({ userRole }: { userRole: string }) {
  const now = new Date();
  const monthValues = Array.from({ length: now.getMonth() + 1 }, (_, index) =>
    `${now.getFullYear()}-${String(index + 1).padStart(2, "0")}`
  );

  const [result, profitabilityResult, clientPlansResult, receivablesResult, periodSnapshotsResult] = await Promise.all([
    getFinancialStats(),
    getGlobalProfitabilityStats(),
    getStrategicClientPlans(),
    getReceivables(),
    getFinanceDashboardPeriodSnapshots(monthValues),
  ]);

  if (!result.success || !result.data) {
    return (
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-6">
        <Card>
          <CardContent className="py-12">
            <p className="text-destructive text-center">
              {result.error || "Error al cargar las estadísticas financieras"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-2 pb-6 sm:px-6">
      <PageHeader
        title="Finanzas"
        description="Visibilidad ejecutiva sobre caja, rentabilidad y cartera de clientes"
      />
      <StrategicFinanceDashboardClient
        stats={result.data}
        profitability={profitabilityResult.success ? profitabilityResult.data : null}
        clientPlans={clientPlansResult.success ? clientPlansResult.data ?? [] : []}
        receivables={receivablesResult.success ? receivablesResult.data ?? null : null}
        periodSnapshots={periodSnapshotsResult.success ? periodSnapshotsResult.data ?? [] : []}
        userRole={userRole}
      />
    </div>
  );
}

export default async function FinancePage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const userRole = session?.user?.role;
  if (userRole !== "ADMIN") redirect("/finance/personal");

  return (
    <div className="min-h-screen bg-transparent">
      <Suspense fallback={<div className="mx-auto max-w-[1440px] px-4 py-6"><CardSkeleton /></div>}>
        <FinanceBody userRole={userRole} />
      </Suspense>
    </div>
  );
}

