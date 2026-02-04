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
  searchParams?: { bulk?: string | string[] };
}) {
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
      <div className="container mx-auto py-6 px-4 md:px-6">
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

  const bulkParam = Array.isArray(searchParams?.bulk)
    ? searchParams?.bulk[0]
    : searchParams?.bulk;
  const shouldOpenBulkDialog = bulkParam === "1" || bulkParam === "true";

  return (
    <div className="container mx-auto p-0 md:px-6 md:py-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content Factory</h1>
          <p className="text-muted-foreground mt-2">
            Visualiza y gestiona todas tus tareas de contenido
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button asChild variant="outline" className="w-full md:w-auto">
            <Link href="/content/shoots">
              <Video className="mr-2 h-4 w-4" />
              Plan de Rodaje
            </Link>
          </Button>
          <BulkTaskDialog
            clients={clients}
            defaultOpen={shouldOpenBulkDialog}
            label="Crear tareas en lote"
            buttonVariant="outline"
            className="w-full md:w-auto border-primary text-primary"
          />
          <Button asChild className="w-full md:w-auto">
            <Link href="/content/new">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Tarea
            </Link>
          </Button>
        </div>
      </div>

      <ContentFactoryWrapper tasks={tasks} clients={clients} users={users} />
    </div>
  );
}
