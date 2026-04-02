import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUsers } from "@/actions/admin/user-actions";
import { getSpecialties, syncLegacySpecialties } from "@/actions/admin/specialty-actions";
import { UsersDataTable } from "@/components/features/admin/users/users-data-table";
import { SpecialtyDataTable } from "@/components/features/admin/users/specialty-data-table";
import { UserSheet } from "@/components/features/admin/users/user-sheet";
import { SpecialtySheet } from "@/components/features/admin/users/specialty-sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Layers, Plus, RefreshCw } from "lucide-react";
import { SyncButton } from "@/components/features/admin/users/sync-button";
import { FixRolesButton } from "@/components/features/admin/users/fix-roles-button";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session || session.user.roleLegacy !== "ADMIN") redirect("/");

  // 1. Sincronizar legacy antes de cargar
  await syncLegacySpecialties();

  // 2. Cargar datos
  const [usersResult, specialtiesResult] = await Promise.all([
    getUsers(),
    getSpecialties(),
  ]);

  if (!usersResult.success) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Users className="h-6 w-6 text-foreground flex-shrink-0" />
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-foreground dark:text-white line-clamp-1">
                  Gestión de Usuarios
                </h1>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  Administra usuarios y especialidades del sistema
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pt-6 pb-6">
          <Card>
            <CardContent className="py-12">
              <p className="text-destructive text-center">{usersResult.error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  if (!specialtiesResult.success) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Users className="h-6 w-6 text-foreground flex-shrink-0" />
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-foreground dark:text-white line-clamp-1">
                  Gestión de Usuarios
                </h1>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  Administra usuarios y especialidades del sistema
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pt-6 pb-6">
          <Card>
            <CardContent className="py-12">
              <p className="text-destructive text-center">{specialtiesResult.error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const users = usersResult.data;
  const specialties = specialtiesResult.data;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Users className="h-6 w-6 text-foreground flex-shrink-0" />
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-foreground dark:text-white line-clamp-1">
                Gestión de Usuarios
              </h1>
              <p className="text-xs text-muted-foreground line-clamp-1">
                Administra usuarios y especialidades del sistema
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-6 pb-6">

      <Tabs defaultValue="usuarios" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-xl">
          <TabsTrigger value="usuarios">
            <Users className="h-4 w-4 mr-2" /> Usuarios
          </TabsTrigger>
          <TabsTrigger value="especialidades">
            <Layers className="h-4 w-4 mr-2" /> Especialidades
          </TabsTrigger>
        </TabsList>

        {/* Tab: Usuarios */}
        <TabsContent value="usuarios" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Lista de Usuarios</CardTitle>
                <CardDescription>
                  {users.length} {users.length === 1 ? "usuario" : "usuarios"} registrados
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <FixRolesButton />
                <UserSheet
                  mode="create"
                  trigger={<Button><Plus className="h-4 w-4 mr-2" />Nuevo Usuario</Button>}
                />
              </div>
            </CardHeader>
            <CardContent>
              <UsersDataTable users={users} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Especialidades */}
        <TabsContent value="especialidades" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestionar Especialidades</CardTitle>
                <CardDescription>
                  {specialties.length} {specialties.length === 1 ? "opción" : "opciones"} disponibles
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <SyncButton />
                <SpecialtySheet
                  trigger={<Button><Plus className="h-4 w-4 mr-2" />Nueva Especialidad</Button>}
                />
              </div>
            </CardHeader>
            <CardContent>
              <SpecialtyDataTable specialties={specialties} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}


