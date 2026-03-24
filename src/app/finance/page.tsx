import { Suspense } from "react";
import { TrendingUp } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getFinancialStats, getGlobalProfitabilityStats, getStrategicClientPlans } from "@/actions/finance-actions";
import { StrategicFinanceDashboardClient } from "@/components/features/finance/strategic-finance-dashboard-client";
import { FinanceHeaderActions } from "@/components/features/finance/finance-header-actions";
import { Card, CardContent } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeletons-composite";

// Streamed: fetches finance data, then renders the dashboard
async function FinanceBody({ userRole }: { userRole: string }) {
  const [result, profitabilityResult, clientPlansResult] = await Promise.all([
    getFinancialStats(),
    getGlobalProfitabilityStats(),
    getStrategicClientPlans(),
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
    <div className="max-w-7xl mx-auto px-4 pt-6 pb-6">
      <StrategicFinanceDashboardClient
        stats={result.data}
        profitability={profitabilityResult.success ? profitabilityResult.data : null}
        clientPlans={clientPlansResult.success ? clientPlansResult.data ?? [] : []}
        userRole={userRole}
      />
    </div>
  );
}

// Streamed: fetches client plans for header actions
async function HeaderActionsServer() {
  const clientPlansResult = await getStrategicClientPlans();
  return (
    <FinanceHeaderActions
      clientPlans={clientPlansResult.success ? clientPlansResult.data ?? [] : []}
    />
  );
}

export default async function FinancePage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const userRole = session?.user?.role;
  if (userRole !== "ADMIN") redirect("/finance/personal");

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header renders immediately — this is the LCP element */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-foreground dark:text-white line-clamp-1">
                Finanzas Totem
              </h1>
              <p className="text-xs text-muted-foreground line-clamp-1">
                Gestiona y visualiza tu desempeño financiero
              </p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <Suspense fallback={<div className="h-8 w-20 rounded-full bg-muted/50 animate-pulse" />}>
              <HeaderActionsServer />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Dashboard streams in — recharts deferred to client */}
      <Suspense fallback={<div className="max-w-7xl mx-auto px-4 pt-6 pb-6"><CardSkeleton /></div>}>
        <FinanceBody userRole={userRole} />
      </Suspense>
    </div>
  );
}

