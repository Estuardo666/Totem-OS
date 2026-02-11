import Link from "next/link";
import { Plus, Video, Layout } from "lucide-react";
import { auth } from "@/auth";
import { getTasks } from "@/actions/content-actions";
import { getClients } from "@/actions/client-actions";
import { getUsers } from "@/actions/user.actions";
import { Button } from "@/components/ui/button";
import { ContentFactoryWrapper } from "@/components/features/content/content-factory-wrapper";
import { BulkTaskDialog } from "@/components/features/content/bulk-task-dialog";

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ bulk?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const [tasksResult, clientsResult, usersResult] = await Promise.all([
    getTasks(),
    getClients(),
    getUsers(),
  ]);

  // Si hay error, mostrar mensaje
  if (!tasksResult.success || !tasksResult.data) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="rounded-xl border bg-card p-8">
            <p className="text-destructive text-center font-medium">
              {tasksResult.error || "Error al cargar las tareas"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tasks = tasksResult.data;
  const clients = clientsResult.success ? (clientsResult.data ?? []) : [];
  const users = usersResult.success ? (usersResult.data ?? []) : [];

  const bulkParam = Array.isArray(resolvedSearchParams?.bulk)
    ? resolvedSearchParams?.bulk[0]
    : resolvedSearchParams?.bulk;
  const shouldOpenBulkDialog = bulkParam === "1" || bulkParam === "true";

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header iOS-style con sticky */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                <Layout className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Content Factory</h1>
                <p className="text-xs text-muted-foreground">
                  Visualiza y gestiona todas tus tareas de contenido
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href="/content/shoots">
                  <Video className="mr-1.5 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Plan de Rodaje</span>
                  <span className="sm:hidden">Rodajes</span>
                </Link>
              </Button>
              <BulkTaskDialog
                clients={clients}
                defaultOpen={shouldOpenBulkDialog}
                label="Crear en lote"
                buttonVariant="outline"
                buttonSize="sm"
                className="rounded-full border-primary text-primary"
              />
              <Button asChild size="sm" className="rounded-full">
                <Link href="/content/new">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Nueva Tarea</span>
                  <span className="sm:hidden">Nueva</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal - Kanban ocupará 98vw en mobile */}
      <div className="w-full">
        <ContentFactoryWrapper tasks={tasks} clients={clients} users={users} />
      </div>
    </div>
  );
}
