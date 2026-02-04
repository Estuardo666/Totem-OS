import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, FileText, Plus, Video } from "lucide-react";
import { TodayScheduledTasks } from "@/components/features/content/today-scheduled-tasks";
import { WorkloadPanel } from "@/components/features/content/workload-panel";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";
import { VoiceNotesWidget } from "@/components/features/dashboard/voice-notes-widget";
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
    <div className="container mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Hola, {firstName} 👋
            </h1>
            <p className="text-muted-foreground mt-2">
              Aquí tienes el estado de tu agencia hoy.
            </p>
          </div>
          <div className="mt-1">
            <DashboardRefresh />
          </div>
        </div>
      </div>

      {/* Acciones Rápidas - Solo para ADMIN */}
      {isAdmin && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              ⚡ Acciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Button asChild variant="outline" className="justify-start">
                <Link href="/content">
                  <FileText className="mr-2 h-4 w-4" />
                  Ver tareas
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/content?bulk=1">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear tareas en lote
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/content/shoots?new=1">
                  <Video className="mr-2 h-4 w-4" />
                  Crear rodaje
                </Link>
              </Button>
              <TransactionDialog />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen Rápido - Grid de Tarjetas con Suspense */}
      <div className={`grid grid-cols-1 gap-4 mb-8 ${isEditor ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
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

      {/* Bloque de tres tarjetas (30% c/u en desktop): Mis Ideas, Tareas Prioritarias, Últimas Transacciones */}
      <div className="grid grid-cols-1 gap-4 mb-8 lg:grid-cols-3">
        <div className="w-full">
          <VoiceNotesWidget />
        </div>
        <Suspense fallback={<CardSkeleton />}>
          <PriorityTasks />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <RecentTransactions />
        </Suspense>
      </div>

      {/* Widget: Hoy en Redes */}
      <Suspense fallback={<CardSkeleton />}>
        <TodayScheduledTasksWrapper />
      </Suspense>
      
      {/* Mi Billetera (Solo para ADMIN) */}
      <Suspense fallback={null}>
        <AdminWallet />
      </Suspense>

      {/* Panel de Carga de Trabajo */}
      {filteredWorkloads.length > 0 && <WorkloadPanel workloads={filteredWorkloads} />}

      {/* Alertas de Feedback de Clientes */}
      <Suspense fallback={null}>
        <PendingFeedbacks />
      </Suspense>
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
