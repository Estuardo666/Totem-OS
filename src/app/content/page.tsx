import Link from "next/link";
import { Plus, Wand2, Video } from "lucide-react";
import { auth } from "@/auth";
import { getTasks } from "@/actions/content-actions";
import { getClients } from "@/actions/client-actions";
import { getUsers } from "@/actions/user.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContentFactoryWrapper } from "@/components/features/content/content-factory-wrapper";

export default async function ContentPage() {
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
  const clients = clientsResult.success ? clientsResult.data ?? [] : [];
  const users = usersResult.success ? usersResult.data ?? [] : [];

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content Factory</h1>
          <p className="text-muted-foreground mt-2">
            Visualiza y gestiona todas tus tareas de contenido
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/content/shoots">
              <Video className="mr-2 h-4 w-4" />
              Plan de Rodaje
            </Link>
          </Button>
          {isAdmin && (
            <Button asChild variant="outline">
              <Link href="/content/generator">
                <Wand2 className="mr-2 h-4 w-4" />
                Generador de Estrategias
              </Link>
            </Button>
          )}
          <Button asChild>
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

