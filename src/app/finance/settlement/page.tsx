import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSettlementReport } from "@/actions/finance-actions";
import { getUsers } from "@/actions/user.actions";
import { SettlementPageClient } from "@/components/features/finance/settlement-page-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/shared";

interface SettlementPageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function SettlementPage({ searchParams }: SettlementPageProps) {
  const session = await auth();
  
  // Verificar autenticación
  if (!session?.user) {
    redirect("/sign-in");
  }

  // Verificar rol desde la base de datos como fallback
  let userRole = session.user.role;
  if (session.user.id) {
    try {
      const dbUser = await db.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      if (dbUser) {
        userRole = dbUser.role;
      }
    } catch (error) {
      console.error("Error al obtener rol desde DB:", error);
    }
  }

  // Solo ADMIN y EDITOR pueden acceder
  if (userRole !== "ADMIN" && userRole !== "EDITOR") {
    return (
      <div className="container mx-auto p-3">
        <PageHeader
          title="Liquidación Mensual"
          description="Gestión de salarios y honorarios del equipo"
        />
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              Acceso Restringido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-red-800">
              Esta página solo está disponible para usuarios con rol <strong>ADMIN</strong> o <strong>EDITOR</strong>.
            </p>
            <p className="text-sm text-red-800">
              Tu rol actual es: <strong className="font-mono">{userRole || "No definido"}</strong>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Obtener mes y año de los search params o usar el mes actual
  const params = await searchParams;
  const now = new Date();
  const currentMonth = params.month ? Number(params.month) : now.getMonth() + 1;
  const currentYear = params.year ? Number(params.year) : now.getFullYear();

  // Validar mes y año
  const month = currentMonth >= 1 && currentMonth <= 12 ? currentMonth : now.getMonth() + 1;
  const year = currentYear >= 2000 && currentYear <= 2100 ? currentYear : now.getFullYear();

  // Obtener datos
  const [reportsResult, usersResult] = await Promise.all([
    getSettlementReport(month, year),
    getUsers(),
  ]);

  const reports = reportsResult.success ? reportsResult.data ?? [] : [];
  const users = usersResult.success ? usersResult.data ?? [] : [];

  const isAdmin = userRole === "ADMIN";

  return (
    <div className="container mx-auto p-3">
      <SettlementPageClient
        initialMonth={month}
        initialYear={year}
        initialReports={reports}
        initialUsers={users}
        currentUserId={session.user.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}
