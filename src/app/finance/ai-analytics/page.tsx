import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Brain } from "lucide-react";
import { getFinancialStats, getStrategicClientPlans } from "@/actions/finance-actions";
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
    getStrategicClientPlans(),
  ]);

  if (!statsResult.success || !statsResult.data) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Analíticas IA</h1>
              <p className="text-xs text-muted-foreground">Lectura ejecutiva para entender, anticipar y actuar.</p>
            </div>
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
            <Brain className="h-5 w-5 text-white" />
          </div>
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
