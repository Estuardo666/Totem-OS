import { ClientForm } from "@/components/features/clients/client-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsers } from "@/actions/user.actions";

export default async function NewClientPage() {
  const usersResult = await getUsers();
  const users = usersResult.success ? usersResult.data ?? [] : [];

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Nuevo Cliente</h1>
        <p className="text-muted-foreground mt-2">
          Completa el formulario para crear un nuevo cliente en el sistema.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientForm users={users} />
        </CardContent>
      </Card>
    </div>
  );
}

