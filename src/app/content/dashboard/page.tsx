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
import { Video } from "lucide-react";

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
      <div className="min-h-screen bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="rounded-xl border bg-card p-8">
            <p className="text-destructive text-center font-medium">
              {dashboardResult.error || "Error al cargar los datos del dashboard"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { radar, semaphore, nextShoots, warRoom, calendar } = dashboardResult.data;
  const clients = clientsResult.success ? (clientsResult.data ?? []) : [];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header iOS-style con sticky */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                <Video className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Content Factory</h1>
                <p className="text-xs text-muted-foreground">
                  Vista general de producción y estado
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DashboardRefresh />
              <QuickActions clients={clients} />
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Radar de Producción */}
        <ProductionRadar radar={radar} />

        {/* Grid Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Columna Izquierda: Calendario */}
          <div className="lg:col-span-3">
            <HybridCalendar shoots={calendar.shoots} tasks={calendar.tasks} />
          </div>

          {/* Columna Derecha: Stack vertical */}
          <div className="space-y-6 lg:col-span-1">
            <NextShootWidget shoots={nextShoots} />
            <ClientHealthList semaphore={semaphore} />
            <WarRoom warRoom={warRoom} />
          </div>
        </div>
      </div>
    </div>
  );
}

