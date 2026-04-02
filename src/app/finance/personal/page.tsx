import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getFinancialStats } from "@/actions/finance-actions";
import { PersonalFinanceDashboard } from "@/components/features/finance/personal-finance-dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet } from "lucide-react";

export default async function PersonalFinancePage() {
  const session = await auth();

  if (!session) {
    redirect("/sign-in");
  }

  const result = await getFinancialStats();

  if (!result.success || !result.data) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Wallet className="h-6 w-6 text-foreground flex-shrink-0" />
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-foreground dark:text-white line-clamp-1">
                  Dashboard Personal
                </h1>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  Visualiza tu desempeño financiero personal
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pt-6 pb-6">
          <Card>
            <CardContent className="py-12">
              <p className="text-destructive text-center">
                {result.error || "Error al cargar las estadísticas financieras"}
              </p>
            </CardContent>
          </Card>

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Wallet className="h-6 w-6 text-foreground flex-shrink-0" />
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-foreground dark:text-white line-clamp-1">
                Dashboard Personal
              </h1>
              <p className="text-xs text-muted-foreground line-clamp-1">
                Visualiza tu desempeño financiero personal
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-6">
        <PersonalFinanceDashboard
          stats={result.data}
          userId={session.user.id}
        />
      </div>
    </div>
  );
}
