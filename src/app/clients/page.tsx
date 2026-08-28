import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { getClients } from "@/actions/client-actions";
import { getUsers } from "@/actions/user.actions";
import { ClientList } from "@/components/features/clients/client-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/auth";
import { resolveRoleCode } from "@/lib/roles";

export default async function ClientsPage() {
  const session = await auth();
  const userRole = resolveRoleCode(session?.user);
  const isAdmin = userRole === "ADMIN";
  const canEditClient = isAdmin || userRole === "EDITOR";
  
  const [clientsResult, usersResult] = await Promise.all([
    getClients(),
    getUsers(),
  ]);

  // Si hay error, mostrar mensaje (en producción podrías redirigir o mostrar error boundary)
  if (!clientsResult.success || !clientsResult.data) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Card className="rounded-xl">
            <CardContent className="py-12">
              <p className="text-destructive text-center">
                {clientsResult.error || "Error al cargar los clientes"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Obtener usuarios, por defecto array vacío si hay error
  const users = usersResult.success && usersResult.data ? usersResult.data : [];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header iOS-style con sticky */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-foreground" />
              <div>
                <h1 className="text-xl font-bold">Clientes</h1>
                <p className="text-xs text-muted-foreground">
                  {isAdmin 
                    ? "Gestiona todos tus clientes desde aquí"
                    : "Visualiza el dashboard general de clientes"}
                </p>
              </div>
            </div>
            {isAdmin && (
              <Button asChild className="rounded-full shadow-sm h-10 px-5" size="sm">
                <Link href="/clients/new">
                  <Plus className="h-4 w-4 mr-2" />
                  <span>Nuevo Cliente</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-6">
        <ClientList clients={clientsResult.data} isAdmin={isAdmin} canEditClient={canEditClient} users={users} />
      </div>
    </div>
  );
}

