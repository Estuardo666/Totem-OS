import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getMonthlyFinancialSummary, getStrategicClientPlans } from "@/actions/finance-actions";
import { FinanceHeaderActions } from "@/components/features/finance/finance-header-actions";
import { MonthlySummaryDashboard } from "@/components/features/finance/monthly-summary-dashboard";
import { PageHeader } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";

export default async function MonthlySummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const monthParam = Array.isArray(resolvedSearchParams?.month)
    ? resolvedSearchParams.month[0]
    : resolvedSearchParams?.month;

  const session = await auth();
  if (!session) {
    redirect("/sign-in");
  }

  const userRole = session.user?.role;
  if (userRole !== "ADMIN") {
    redirect("/finance/personal");
  }

  const [summaryResult, clientPlansResult] = await Promise.all([
    getMonthlyFinancialSummary(monthParam),
    getStrategicClientPlans(),
  ]);

  if (!summaryResult.success || !summaryResult.data) {
    return (
      <div className="container mx-auto p-3">
        <PageHeader
          title="Resumen Financiero del Mes"
          description="Lectura contable, caja y cartera del período actual para dirección financiera."
          actions={<FinanceHeaderActions clientPlans={clientPlansResult.success ? clientPlansResult.data ?? [] : []} />}
        />
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-destructive">
              {summaryResult.error || "No fue posible generar el resumen financiero del mes."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3">
      <PageHeader
        title="Resumen Financiero del Mes"
        description="Una lectura separada de resultado, caja, cartera y contribución por cliente para decidir mejor."
        actions={<FinanceHeaderActions clientPlans={clientPlansResult.success ? clientPlansResult.data ?? [] : []} />}
      />
      <MonthlySummaryDashboard summary={summaryResult.data} userRole={userRole} />
    </div>
  );
}
