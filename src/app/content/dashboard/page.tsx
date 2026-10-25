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
import { CurrentMonthTaskSummary } from "@/components/features/dashboard/current-month-task-summary";
import { CardSkeleton } from "@/components/ui/skeletons-composite";
import { Suspense } from "react";
import { resolveRoleCode } from "@/lib/roles";
import { AppPageHeader } from "@/components/shared/app-page-header";

export default async function ContentDashboardPage() {
  const session = await auth();
  const isAdmin = resolveRoleCode(session?.user) === "ADMIN";

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
          <div className="rounded-2xl border bg-card p-8">
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
      <AppPageHeader
        title="Content Factory"
        description="Vista general de producción y estado"
        actions={
          <>
            <DashboardRefresh />
              <QuickActions clients={clients} />
          </>
        }
      />

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {isAdmin && (
          <Suspense fallback={<CardSkeleton />}>
            <CurrentMonthTaskSummary />
          </Suspense>
        )}

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

