import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getClientMonthlyClosures } from "@/actions/finance-actions";
import { MonthlyClosePageClient } from "@/components/features/finance/monthly-close-page-client";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared";

interface MonthlyClosePageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function MonthlyClosePage({ searchParams }: MonthlyClosePageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/finance/personal");
  }

  const params = await searchParams;
  const now = new Date();
  const requestedMonth = params.month ? Number(params.month) : now.getMonth() + 1;
  const requestedYear = params.year ? Number(params.year) : now.getFullYear();
  const month = requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : now.getMonth() + 1;
  const year = requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : now.getFullYear();

  const result = await getClientMonthlyClosures(month, year);

  if (!result.success || !result.data) {
    return (
      <div className="container mx-auto p-3">
        <PageHeader
          title="Cierre del mes"
          description="Cuánto se le cobra a cada cliente este mes"
        />
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-destructive">
              {result.error || "No fue posible cargar el cierre mensual por cliente."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3">
      <PageHeader
        title="Cierre del mes"
        description="Cuánto se le cobra a cada cliente este mes"
      />
      <MonthlyClosePageClient data={result.data} userRole={session.user.role} />
    </div>
  );
}