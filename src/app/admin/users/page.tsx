import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUsers } from "@/actions/user.actions";
import { UsersTable } from "@/components/features/users/users-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users } from "lucide-react";

export default async function AdminUsersPage() {
  // Verificar autenticación y rol
  const session = await auth();
  const userRole = session?.user?.role;

  // Si no está autenticado o no es ADMIN, redirigir al Dashboard
  if (!session || userRole !== "ADMIN") {
    redirect("/");
  }

  // Obtener usuarios
  const usersResult = await getUsers();

  if (!usersResult.success || !usersResult.data) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <Card>
          <CardContent className="py-12">
            <p className="text-destructive text-center">
              {usersResult.error || "Error al cargar los usuarios"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const users = usersResult.data;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Gestión de Usuarios
            </h1>
            <p className="text-muted-foreground mt-1">
              Administra los usuarios del sistema y sus permisos
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
          <CardDescription>
            {users.length} {users.length === 1 ? "usuario registrado" : "usuarios registrados"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable users={users} />
        </CardContent>
      </Card>
    </div>
  );
}

