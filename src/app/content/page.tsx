import Link from "next/link";
import { Plus, Video, Layout } from "lucide-react";
import { Suspense } from "react";
import { auth } from "@/auth";
import { getTasks } from "@/actions/content-actions";
import { getClients } from "@/actions/client-actions";
import { getUsers } from "@/actions/user.actions";
import { Button } from "@/components/ui/button";
import { ContentFactoryWrapper } from "@/components/features/content/content-factory-wrapper";
import { BulkTaskDialog } from "@/components/features/content/bulk-task-dialog";
import { CardSkeleton } from "@/components/ui/skeletons-composite";

// Streamed: renders BulkTaskDialog in the header once clients load
async function BulkTaskDialogServer({ shouldOpenBulkDialog }: { shouldOpenBulkDialog: boolean }) {
  const clientsResult = await getClients();
  const clients = clientsResult.success ? (clientsResult.data ?? []) : [];
  return (
    <BulkTaskDialog
      clients={clients}
      defaultOpen={shouldOpenBulkDialog}
      label="Crear en lote"
      buttonVariant="outline"
      buttonSize="sm"
      className="rounded-full border-primary text-primary px-2 sm:px-4"
    />
  );
}

// Streamed: fetches all board data and renders the full kanban
async function ContentBody() {
  const [tasksResult, clientsResult, usersResult] = await Promise.all([
    getTasks(),
    getClients(),
    getUsers(),
  ]);

  if (!tasksResult.success || !tasksResult.data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-xl border bg-card p-8">
          <p className="text-destructive text-center font-medium">
            {tasksResult.error || "Error al cargar las tareas"}
          </p>
        </div>
      </div>
    );
  }

  const tasks = tasksResult.data;
  const clients = clientsResult.success ? (clientsResult.data ?? []) : [];
  const users = usersResult.success ? (usersResult.data ?? []) : [];

  return <ContentFactoryWrapper tasks={tasks} clients={clients} users={users} />;
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ bulk?: string | string[] }>;
}) {
  const [resolvedSearchParams] = await Promise.all([searchParams]);

  const bulkParam = Array.isArray(resolvedSearchParams?.bulk)
    ? resolvedSearchParams?.bulk[0]
    : resolvedSearchParams?.bulk;
  const shouldOpenBulkDialog = bulkParam === "1" || bulkParam === "true";

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header renders immediately — h1 is the LCP element */}
      <div data-content-page-header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b">
        <div className="w-full px-0">
          <div className="flex items-center justify-between py-2 sm:py-4 px-4 sm:px-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                <Layout className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold">Content Factory</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Visualiza y gestiona todas tus tareas de contenido
                </p>
              </div>
            </div>
            <div className="flex gap-1 sm:gap-2 items-center">
              <Button asChild variant="outline" size="sm" className="rounded-full px-2 sm:px-4">
                <Link href="/content/shoots">
                  <Video className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Plan de Rodaje</span>
                  <span className="sm:hidden text-xs">Rodajes</span>
                </Link>
              </Button>
              {/* BulkTaskDialog streams in after getClients() resolves */}
              <Suspense fallback={<div className="h-8 w-24 rounded-full bg-muted/50 animate-pulse sm:w-28" />}>
                <BulkTaskDialogServer shouldOpenBulkDialog={shouldOpenBulkDialog} />
              </Suspense>
              <Button asChild size="sm" className="rounded-full px-2 sm:px-4">
                <Link href="/content/new">
                  <Plus className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Nueva Tarea</span>
                  <span className="sm:hidden text-xs">Nueva</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Board streams in after all DB queries complete */}
      <div className="w-full">
        <Suspense fallback={<div className="p-6"><CardSkeleton /></div>}>
          <ContentBody />
        </Suspense>
      </div>
    </div>
  );
}
