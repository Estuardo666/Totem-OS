import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getFinanceDashboardPeriodSnapshots, getFinancialStats, getGlobalProfitabilityStats, getReceivables, getStrategicClientPlans } from "@/actions/finance-actions";
import { StrategicFinanceDashboardClient } from "@/components/features/finance/strategic-finance-dashboard-client";
import { FinanceMonthOverview } from "@/components/features/finance/finance-month-overview";
import { FinanceViewToggle } from "@/components/features/finance/finance-view-toggle";
import { FinanceSectionNav } from "@/components/features/finance/finance-section-nav";
import { MonthlySummaryPeriodSelector } from "@/components/features/finance/monthly-summary-period-selector";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";
import { Button } from "@/components/ui/button";
import { resolveRoleCode } from "@/lib/roles";
import { PageHeader } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeletons-composite";

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12">
        <p className="text-destructive text-center">{message}</p>
      </CardContent>
    </Card>
  );
}

// Vista simple: el mes elegido + 5 meses previos para la tendencia
async function SimpleBody({ month }: { month?: string }) {
  const now = new Date();
  const current = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month <= monthValue(now) ? month : monthValue(now);
  const [year, m] = current.split("-").map(Number);
  const months = Array.from({ length: 6 }, (_, i) => monthValue(new Date(year, m - 6 + i, 1)));

  const result = await getFinanceDashboardPeriodSnapshots(months);
  if (!result.success || !result.data?.length) {
    return <ErrorCard message={result.error || "Error al cargar el resumen financiero"} />;
  }

  const snapshots = [...result.data].sort((a, b) => a.period.value.localeCompare(b.period.value));
  const currentSnapshot = snapshots.find((s) => s.period.value === current) ?? snapshots.at(-1)!;
  const previousSnapshot = snapshots.find((s) => s.period.value === months[4]) ?? null;

  return (
    <>
      <MonthlySummaryPeriodSelector monthValue={current} isCurrentMonth={current === monthValue(now)} className="mb-4" />
      <FinanceMonthOverview current={currentSnapshot} previous={previousSnapshot} trend={snapshots} />
    </>
  );
}

async function AdvancedBody({ userRole }: { userRole: string }) {
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
    return <ErrorCard message={result.error || "Error al cargar las estadísticas financieras"} />;
  }

  return (
    <StrategicFinanceDashboardClient
      stats={result.data}
      profitability={profitabilityResult.success ? profitabilityResult.data : null}
      clientPlans={clientPlansResult.success ? clientPlansResult.data ?? [] : []}
      receivables={receivablesResult.success ? receivablesResult.data ?? null : null}
      periodSnapshots={periodSnapshotsResult.success ? periodSnapshotsResult.data ?? [] : []}
      userRole={userRole}
    />
  );
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[]; view?: string | string[] }>;
}) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const userRole = resolveRoleCode(session?.user) ?? "USER";
  if (userRole !== "ADMIN") redirect("/finance/personal");

  const params = await searchParams;
  const month = Array.isArray(params.month) ? params.month[0] : params.month;
  const advanced = (Array.isArray(params.view) ? params.view[0] : params.view) === "advanced";

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-2 pb-6 sm:px-6">
      <PageHeader
        title="Finanzas"
        description={advanced ? "Vista avanzada con filtros por cliente y servicio" : "Resumen del mes"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FinanceViewToggle basePath="/finance" advanced={advanced} month={month} />
            {!advanced && (
              <TransactionDialog isAdminOverride>
                <Button className="gap-2"><Plus className="size-4" />Nueva transacción</Button>
              </TransactionDialog>
            )}
          </div>
        }
      />
      {!advanced && <FinanceSectionNav userRole={userRole} className="mb-4" />}
      <Suspense key={`${advanced}-${month ?? ""}`} fallback={<CardSkeleton />}>
        {advanced ? <AdvancedBody userRole={userRole} /> : <SimpleBody month={month} />}
      </Suspense>
    </div>
  );
}
