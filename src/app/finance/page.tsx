import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getFinancialStats, getGlobalProfitabilityStats, getStrategicClientPlans } from "@/actions/finance-actions";
import { StrategicFinanceDashboard } from "@/components/features/finance/strategic-finance-dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared";

export default async function FinancePage() {
  const session = await auth();
  if (!session) {
    redirect("/sign-in");
  }
  const userRole = session?.user?.role;
  if (userRole !== "ADMIN") {
    redirect("/finance/personal");
  }
  const [result, profitabilityResult, clientPlansResult] = await Promise.all([
    getFinancialStats(),
    // Solo ADMIN ve rentabilidad global
    getGlobalProfitabilityStats(),
    getStrategicClientPlans(),
  ]);

  // Si hay error, mostrar mensaje
  if (!result.success || !result.data) {
    return (
      <div className="container mx-auto p-3">
        <PageHeader title="Finanzas Totem" />
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
    <div className="container mx-auto p-3">
      <StrategicFinanceDashboard
        stats={result.data}
        profitability={profitabilityResult.success ? profitabilityResult.data : null}
        clientPlans={clientPlansResult.success ? clientPlansResult.data ?? [] : []}
        userRole={userRole}
      />
    </div>
  );
}

