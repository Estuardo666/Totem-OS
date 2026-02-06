import Link from "next/link";
import { Plus, Video } from "lucide-react";
import { auth } from "@/auth";
import { getTasks } from "@/actions/content-actions";
import { getClients } from "@/actions/client-actions";
import { getUsers } from "@/actions/user.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContentFactoryWrapper } from "@/components/features/content/content-factory-wrapper";
import { BulkTaskDialog } from "@/components/features/content/bulk-task-dialog";
import { PageHeader } from "@/components/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
      <div className="container mx-auto py-3 px-2 md:px-3">
        <Card>
          <CardContent className="py-12">
            <p className="text-destructive text-center">
              {tasksResult.error || "Error al cargar las tareas"}
            </p>
          </CardContent>
        </Card>
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
    <div className="container mx-auto p-0 md:px-3 md:py-3">
      <PageHeader
        title="Content Factory"
        description="Visualiza y gestiona todas tus tareas de contenido"
        actions={
          <div className="flex flex-wrap gap-1.5 md:gap-2 items-center">
            <Button asChild variant="outline" size="sm" className="text-xs">
              <Link href="/content/shoots">
                <Video className="mr-1.5 h-3.5 w-3.5" />
                Plan de Rodaje
              </Link>
            </Button>
            <BulkTaskDialog
              clients={clients}
              defaultOpen={shouldOpenBulkDialog}
              label="Crear tareas en lote"
              buttonVariant="outline"
              buttonSize="sm"
              className="border-primary text-primary text-xs"
            />
            <Button asChild size="sm" className="text-xs">
              <Link href="/content/new">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nueva Tarea
              </Link>
            </Button>
          </div>
        }
      />

      <ContentFactoryWrapper tasks={tasks} clients={clients} users={users} />
    </div>
  );
}
