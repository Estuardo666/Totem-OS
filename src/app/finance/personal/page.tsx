import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getFinancialStats } from "@/actions/finance-actions";
import { PersonalFinanceDashboard } from "@/components/features/finance/personal-finance-dashboard";
import { Card, CardContent } from "@/components/ui/card";

export default async function PersonalFinancePage() {
  const session = await auth();

  if (!session) {
    redirect("/sign-in");
  }

  const result = await getFinancialStats();

  if (!result.success || !result.data) {
    return (
      <div className="container mx-auto p-6">
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
    <PersonalFinanceDashboard
      stats={result.data}
      userId={session.user.id}
    />
  );
}
