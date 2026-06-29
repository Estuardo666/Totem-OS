import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getEmergencyFundBalance, getEmergencyFundMovements } from "@/actions/finance-funds-actions";
import { EmergencyFundDashboard } from "@/components/features/finance/emergency-fund-dashboard";
import { CardSkeleton } from "@/components/ui/skeletons-composite";
import { PageHeader } from "@/components/shared";

export default async function EmergencyFundPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (session.user.role !== "ADMIN") redirect("/finance/personal");

  const [balanceResult, movementsResult] = await Promise.all([
    getEmergencyFundBalance(),
    getEmergencyFundMovements(),
  ]);

  return (
    <div className="container mx-auto p-3">
      <PageHeader
        title="Fondo de Emergencia"
        description="Reserva acumulada de la empresa para imprevistos"
      />
      <Suspense fallback={<CardSkeleton />}>
        <EmergencyFundDashboard
          balance={balanceResult.success && balanceResult.data ? balanceResult.data : null}
          movements={movementsResult.success ? movementsResult.data ?? [] : []}
          userRole={session.user.role}
        />
      </Suspense>
    </div>
  );
}
