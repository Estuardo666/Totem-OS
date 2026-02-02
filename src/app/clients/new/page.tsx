import { ClientForm } from "@/components/features/clients/client-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsers } from "@/actions/user.actions";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function NewClientPage() {
  const session = await auth();
  
  // Check if user is authenticated and is ADMIN
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <div className="flex flex-col items-center justify-center py-12">
          <h2 className="text-2xl font-bold mb-4">Acceso Restringido</h2>
          <p className="text-muted-foreground text-center mb-6">
            Solo los administradores pueden crear nuevos clientes.
          </p>
          <Button asChild>
            <Link href="/clients">
              Volver a Clientes
            </Link>
          </Button>
        </div>
      </div>
    );
  }
  
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

