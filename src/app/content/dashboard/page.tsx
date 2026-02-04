import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getContentDashboardData } from "@/actions/dashboard-actions";
import { getClients } from "@/actions/client-actions";
import { ProductionRadar } from "@/components/features/content/ProductionRadar";
import { ClientHealthList } from "@/components/features/content/ClientHealthList";
import { NextShootWidget } from "@/components/features/content/NextShootWidget";
import { WarRoom } from "@/components/features/content/WarRoom";
import { HybridCalendar } from "@/components/features/content/HybridCalendar";
import { QuickActions } from "@/components/features/content/QuickActions";
import { DashboardRefresh } from "@/components/features/content/dashboard-refresh";
import { Card, CardContent } from "@/components/ui/card";

export default async function ContentDashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [dashboardResult, clientsResult] = await Promise.all([
    getContentDashboardData(),
    getClients(),
  ]);

  if (!dashboardResult.success || !dashboardResult.data) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <Card>
          <CardContent className="py-12">
            <p className="text-destructive text-center">
              {dashboardResult.error || "Error al cargar los datos del dashboard"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { radar, semaphore, nextShoots, warRoom, calendar } = dashboardResult.data;
  const clients = clientsResult.success ? (clientsResult.data ?? []) : [];

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-6">
      {/* Header con QuickActions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-3xl font-bold">Dashboard Content Factory</h1>
              <p className="text-muted-foreground">
                Vista general de producción y estado de clientes
              </p>
            </div>
          </div>
          <div className="mt-2">
            <DashboardRefresh />
          </div>
        </div>
        <QuickActions clients={clients} />
      </div>

      {/* Radar de Producción (ancho completo) */}
      <ProductionRadar radar={radar} />

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Calendario (2/3 del ancho) */}
        <div className="lg:col-span-2">
          <HybridCalendar shoots={calendar.shoots} tasks={calendar.tasks} />
        </div>

        {/* Columna Derecha: Stack vertical (1/3 del ancho) */}
        <div className="space-y-6">
          <NextShootWidget shoots={nextShoots} />
          <ClientHealthList semaphore={semaphore} />
          <WarRoom warRoom={warRoom} />
        </div>
      </div>
    </div>
  );
}

