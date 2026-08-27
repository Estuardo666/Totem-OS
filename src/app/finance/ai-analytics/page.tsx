import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Brain } from "lucide-react";
import { getFinancialStats, getStrategicClientAnalyticsPlans } from "@/actions/finance-actions";
import { FinanceAiAnalyticsDashboard } from "@/components/features/finance/finance-ai-analytics-dashboard";
import { Card, CardContent } from "@/components/ui/card";

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
        <div className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
            <Brain className="h-6 w-6 text-foreground" />
          </div>
        </div>
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
      <div className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <Brain className="h-6 w-6 text-foreground" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Analíticas IA</h1>
            <p className="text-xs text-muted-foreground">Qué está pasando, qué va a pasar y qué debería hacer Paty.</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:py-10">
        <FinanceAiAnalyticsDashboard
          stats={statsResult.data}
          clientPlans={(clientPlansResult.success ? clientPlansResult.data : []) ?? []}
        />
      </div>
    </div>
  );
}
