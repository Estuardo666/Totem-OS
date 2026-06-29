import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfitDistributions, getProfitPreviewAction } from "@/actions/finance-funds-actions";
import { ProfitDistributionDashboard } from "@/components/features/finance/profit-distribution-dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeletons-composite";
import { PageHeader } from "@/components/shared";
import { PiggyBank } from "lucide-react";

export default async function ProfitsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (session.user.role !== "ADMIN") redirect("/finance/personal");

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [distributionsResult, previewResult] = await Promise.all([
    getProfitDistributions(),
    getProfitPreviewAction(currentYear, currentMonth),
  ]);

  return (
    <div className="container mx-auto p-3">
      <PageHeader
        title="Distribución de Utilidades"
        description="Gestiona el reparto formal de ganancias entre los socios"
      />
      <Suspense fallback={<CardSkeleton />}>
        <ProfitDistributionDashboard
          distributions={distributionsResult.success ? distributionsResult.data ?? [] : []}
          preview={previewResult.success ? previewResult.data : null}
          currentYear={currentYear}
          currentMonth={currentMonth}
          userRole={session.user.role}
        />
      </Suspense>
    </div>
  );
}
