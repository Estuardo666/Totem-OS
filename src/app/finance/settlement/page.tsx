import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCajaDelMes, getSettlementReport } from "@/actions/finance-actions";
import { getUsers } from "@/actions/user.actions";
import { SettlementPageClient } from "@/components/features/finance/settlement-page-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/shared";
import { resolveRoleCode } from "@/lib/roles";

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
  let userRole = resolveRoleCode(session.user) ?? "USER";
  if (session.user.id) {
    try {
      const dbUser = await db.user.findUnique({
        where: { id: session.user.id },
        select: { roleCode: true, roleLegacy: true },
      });
      if (dbUser) {
        userRole = resolveRoleCode(dbUser) ?? "USER";
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
  const [reportsResult, usersResult, cajaResult] = await Promise.all([
    getSettlementReport(month, year),
    getUsers(),
    getCajaDelMes(month, year),
  ]);

  const caja = cajaResult.success ? cajaResult.data : null;

  const reports = reportsResult.success ? reportsResult.data ?? [] : [];
  const users = usersResult.success ? usersResult.data ?? [] : [];

  const isAdmin = userRole === "ADMIN";

  return (
    <div className="container mx-auto p-3">
      {isAdmin && caja && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Queda en caja este mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${caja.caja.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              ${caja.ingresos.toLocaleString("en-US", { minimumFractionDigits: 2 })} de ingresos
              {" − "}${caja.gastos.toLocaleString("en-US", { minimumFractionDigits: 2 })} de gastos
              {" − "}${caja.honorarios.toLocaleString("en-US", { minimumFractionDigits: 2 })} de honorarios
              {caja.aUtilidades !== 0 && (
                <>
                  {" − "}${caja.aUtilidades.toLocaleString("en-US", { minimumFractionDigits: 2 })} pasado a utilidades
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Dinero sin destino todavía: puede salir como honorarios, cubrir gastos del día a día o pasar a Utilidades.
            </p>
          </CardContent>
        </Card>
      )}
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
