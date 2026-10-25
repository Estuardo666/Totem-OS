import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getFinancialStats, getStrategicClientAnalyticsPlans } from "@/actions/finance-actions";
import { FinanceAiAnalyticsDashboard } from "@/components/features/finance/finance-ai-analytics-dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { AppPageHeader } from "@/components/shared/app-page-header";

export default async function FinanceAiAnalyticsPage() {
  const session = await auth();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/finance");
  }

  const [statsResult, clientPlansResult] = await Promise.all([
    getFinancialStats(),
    getStrategicClientAnalyticsPlans(),
  ]);

  if (!statsResult.success || !statsResult.data) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AppPageHeader title="Analíticas IA" />
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Card className="rounded-3xl">
            <CardContent className="py-12">
              <p className="text-center text-destructive">
                {statsResult.error ?? "No se pudo cargar la información financiera para Analíticas IA."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppPageHeader title="Analíticas IA" description="Qué está pasando, qué va a pasar y qué debería hacer Paty." />

      <div className="mx-auto max-w-7xl px-4 py-8 md:py-10">
        <FinanceAiAnalyticsDashboard
          stats={statsResult.data}
          clientPlans={(clientPlansResult.success ? clientPlansResult.data : []) ?? []}
        />
      </div>
    </div>
  );
}
