import { getClients } from "@/actions/client-actions";
import { getUsers } from "@/actions/user.actions";
import { TaskForm } from "@/components/features/content/task-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewContentTaskPage() {
  // Obtener la lista de clientes y usuarios en el servidor
  const [clientsResult, usersResult] = await Promise.all([
    getClients(),
    getUsers(),
  ]);

  // Si hay error al obtener clientes, mostrar mensaje
  if (!clientsResult.success || !clientsResult.data) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardContent className="py-12">
            <p className="text-destructive text-center">
              {clientsResult.error || "Error al cargar los clientes"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeClients = clientsResult.data.filter((client) => client.status !== "INACTIVE");

  // Si no hay clientes, mostrar mensaje
  if (activeClients.length === 0) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardContent className="py-12">
            <p className="text-muted-foreground text-center">
              No hay clientes disponibles. Por favor, crea un cliente primero.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Nueva Pieza de Contenido
        </h1>
        <p className="text-muted-foreground mt-2">
          Completa el formulario para crear una nueva tarea de contenido.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información de la Tarea</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskForm
            clients={activeClients}
            users={usersResult.success ? usersResult.data ?? [] : []}
          />
        </CardContent>
      </Card>
    </div>
  );
}

