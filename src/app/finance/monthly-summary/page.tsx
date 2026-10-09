import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getFinanceDashboardPeriodSnapshots, getMonthlyFinancialSummary, getStrategicClientPlans } from "@/actions/finance-actions";
import { FinanceHeaderActions } from "@/components/features/finance/finance-header-actions";
import { MonthlySummaryDashboard } from "@/components/features/finance/monthly-summary-dashboard";
import { FinanceMonthOverview } from "@/components/features/finance/finance-month-overview";
import { FinanceViewToggle } from "@/components/features/finance/finance-view-toggle";
import { FinanceSectionNav } from "@/components/features/finance/finance-section-nav";
import { MonthlySummaryPeriodSelector } from "@/components/features/finance/monthly-summary-period-selector";
import { PageHeader } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";

export default async function MonthlySummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[]; view?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const monthParam = Array.isArray(resolvedSearchParams?.month)
    ? resolvedSearchParams.month[0]
    : resolvedSearchParams?.month;
  const viewParam = resolvedSearchParams?.view;
  const advanced = (Array.isArray(viewParam) ? viewParam[0] : viewParam) === "advanced";

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

  const summary = summaryResult.data;
  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(summary.period.year, summary.period.month - 6 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const trendResult = advanced ? null : await getFinanceDashboardPeriodSnapshots(trendMonths);
  const trend = trendResult?.success ? [...(trendResult.data ?? [])].sort((a, b) => a.period.value.localeCompare(b.period.value)) : [];
  const previous = trend.find((s) => s.period.value === trendMonths[4]) ?? null;
  const clientPlans = clientPlansResult.success ? clientPlansResult.data ?? [] : [];

  return (
    <div className="container mx-auto p-3">
      <PageHeader
        title={`Resumen de ${summary.periodLabel}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FinanceViewToggle basePath="/finance/monthly-summary" advanced={advanced} month={monthParam} />
            <FinanceHeaderActions clientPlans={clientPlans} />
          </div>
        }
      />
      {advanced ? (
        <MonthlySummaryDashboard summary={summary} userRole={userRole} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <FinanceSectionNav userRole={userRole} />
            <MonthlySummaryPeriodSelector monthValue={summary.period.value} isCurrentMonth={summary.period.isCurrentMonth} />
          </div>
          <FinanceMonthOverview current={summary} previous={previous} trend={trend.length ? trend : [summary]} />
        </div>
      )}
    </div>
  );
}
