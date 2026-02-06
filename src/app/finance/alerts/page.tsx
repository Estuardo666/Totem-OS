import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getFinanceAlerts, getFinanceAlertRules } from "@/actions/finance-alerts-actions";
import { FinanceAlertsDashboard } from "@/components/features/finance/finance-alerts-dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared";

export default async function FinanceAlertsPage() {
  const session = await auth();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.user.role !== "ADMIN") {
    return (
      <div className="container mx-auto p-3">
        <PageHeader
          title="Alertas Financieras"
          description="Monitorea riesgos, desviaciones y oportunidades con reglas predictivas."
        />
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
      <div className="container mx-auto p-3">
        <PageHeader
          title="Alertas Financieras"
          description="Monitorea riesgos, desviaciones y oportunidades con reglas predictivas."
        />
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
    <div className="container mx-auto p-3 space-y-6">
      <PageHeader
        title="Alertas Financieras"
        description="Monitorea riesgos, desviaciones y oportunidades con reglas predictivas."
      />
      <FinanceAlertsDashboard
        initialAlerts={alertsResult.data}
        initialRules={rulesResult.data}
      />
    </div>
  );
}
