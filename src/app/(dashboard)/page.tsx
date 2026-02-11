import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Zap, FileText, Plus, Video, Home as HomeIcon, DollarSign } from "lucide-react";
import { TodayScheduledTasks } from "@/components/features/content/today-scheduled-tasks";
import { WorkloadPanel } from "@/components/features/content/workload-panel";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";
import { DashboardRefresh } from "@/components/features/content/dashboard-refresh";
import { KPICards } from "@/components/features/dashboard/kpi-cards";
import { PriorityTasks } from "@/components/features/dashboard/priority-tasks";
import { RecentTransactions } from "@/components/features/dashboard/recent-transactions";
import { PendingFeedbacks } from "@/components/features/dashboard/pending-feedbacks";
import { AdminWallet } from "@/components/features/dashboard/admin-wallet";
import { getUserWorkloads } from "@/actions/workload-actions";
import Link from "next/link";
import { Suspense } from "react";
import { MetricSkeleton, CardSkeleton } from "@/components/ui/skeletons-composite";

export default async function Home() {
  // Obtener sesión del usuario autenticado
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] || "Usuario";
  const userRole = session?.user?.role;
  const userId = session?.user?.id;
  const isAdmin = userRole === "ADMIN";
  const isEditor = userRole === "EDITOR";

  // Data fetching para WorkloadPanel (se mantiene aquí porque es condicional y rápido)
  const workloadsResult = await getUserWorkloads();
  const workloads = workloadsResult.success ? workloadsResult.data ?? [] : [];

  // Filtrar workloads para EDITOR: solo mostrar su propio workload
  const filteredWorkloads = isEditor && userId
    ? workloads.filter((workload) => workload.userId === userId)
    : workloads;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header iOS-style con sticky */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <HomeIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Hola, {firstName} 👋</h1>
                <p className="text-xs text-muted-foreground">
                  Aquí tienes el estado de tu agencia hoy
                </p>
              </div>
            </div>
            <DashboardRefresh />
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        
        {/* Acciones Rápidas - Solo para ADMIN */}
        {isAdmin && (
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <h2 className="font-semibold">Acciones Rápidas</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Button asChild variant="outline" className="h-auto py-3 rounded-xl justify-start hover:shadow-md transition-shadow">
                <Link href="/content" className="flex flex-col items-start gap-1">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Ver tareas</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto py-3 rounded-xl justify-start hover:shadow-md transition-shadow">
                <Link href="/content?bulk=1" className="flex flex-col items-start gap-1">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Tareas en lote</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto py-3 rounded-xl justify-start hover:shadow-md transition-shadow">
                <Link href="/content/shoots?new=1" className="flex flex-col items-start gap-1">
                  <Video className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Crear rodaje</span>
                </Link>
              </Button>
              <TransactionDialog>
                <Button variant="outline" className="h-auto py-3 rounded-xl justify-start hover:shadow-md transition-shadow w-full">
                  <div className="flex flex-col items-start gap-1">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Transacción</span>
                  </div>
                </Button>
              </TransactionDialog>
            </div>
          </div>
        )}

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 items-stretch">
          <Suspense fallback={
            <>
              {isAdmin && <MetricSkeleton />}
              <MetricSkeleton />
              <MetricSkeleton />
            </>
          }>
            <KPICards />
          </Suspense>
        </div>

        {/* Grid de dos columnas: Tareas Prioritarias y Transacciones */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Suspense fallback={<CardSkeleton />}>
            <PriorityTasks />
          </Suspense>
          <Suspense fallback={<CardSkeleton />}>
            <RecentTransactions />
          </Suspense>
        </div>

        {/* Grid: Hoy en Redes y Carga de Trabajo */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Suspense fallback={<CardSkeleton />}>
            <TodayScheduledTasksWrapper />
          </Suspense>
          {filteredWorkloads.length > 0 && <WorkloadPanel workloads={filteredWorkloads} />}
        </div>
        
        {/* Mi Billetera (Solo para ADMIN) */}
        <Suspense fallback={null}>
          <AdminWallet />
        </Suspense>

        {/* Alertas de Feedback de Clientes */}
        <Suspense fallback={null}>
          <PendingFeedbacks />
        </Suspense>
      </div>
    </div>
  );
}

// Wrapper para TodayScheduledTasks que necesita las tareas
async function TodayScheduledTasksWrapper() {
  const { getTasks } = await import("@/actions/content-actions");
  const tasksResult = await getTasks();
  const allTasks = tasksResult.success ? tasksResult.data ?? [] : [];
  return <TodayScheduledTasks tasks={allTasks} />;
}
