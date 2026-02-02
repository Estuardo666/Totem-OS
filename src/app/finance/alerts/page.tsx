import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getFinanceAlerts, getFinanceAlertRules } from "@/actions/finance-alerts-actions";
import { FinanceAlertsDashboard } from "@/components/features/finance/finance-alerts-dashboard";
import { Card, CardContent } from "@/components/ui/card";

export default async function FinanceAlertsPage() {
  const session = await auth();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.user.role !== "ADMIN") {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12">
            <p className="text-destructive text-center">
              No tienes permisos para ver alertas financieras.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [alertsResult, rulesResult] = await Promise.all([
    getFinanceAlerts(),
    getFinanceAlertRules(),
  ]);

  if (!alertsResult.success || !alertsResult.data || !rulesResult.success || !rulesResult.data) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12">
            <p className="text-destructive text-center">
              {alertsResult.error || rulesResult.error || "Error al cargar alertas"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alertas Financieras</h1>
        <p className="text-muted-foreground mt-2">
          Monitorea riesgos, desviaciones y oportunidades con reglas predictivas.
        </p>
      </div>
      <FinanceAlertsDashboard
        initialAlerts={alertsResult.data}
        initialRules={rulesResult.data}
      />
    </div>
  );
}
