import Link from "next/link";
import { getClients } from "@/actions/client-actions";
import { getUsers } from "@/actions/user.actions";
import { ClientList } from "@/components/features/clients/client-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppPageHeader } from "@/components/shared/app-page-header";
import { auth } from "@/auth";
import { resolveRoleCode } from "@/lib/roles";

export default async function ClientsPage() {
  const session = await auth();
  const userRole = resolveRoleCode(session?.user);
  const isAdmin = userRole === "ADMIN";
  const canEditClient = isAdmin;
  
  const [clientsResult, usersResult] = await Promise.all([
    getClients(),
    getUsers(),
  ]);

  // Si hay error, mostrar mensaje (en producción podrías redirigir o mostrar error boundary)
  if (!clientsResult.success || !clientsResult.data) {
    return (
      <div className="min-h-screen">
        <AppPageHeader title="Clientes" />
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Card>
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

  const clients = clientsResult.data;
  const activeCount = clients.filter((client) => client.status === "ACTIVE").length;
  const debtCount = clients.filter((client) => client.status === "DEBT").length;
  const summary = [
    `${activeCount} ${activeCount === 1 ? "activo" : "activos"}`,
    debtCount > 0 ? `${debtCount} en deuda` : null,
    `${clients.length} en total`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen">
      <AppPageHeader
        title="Clientes"
        description={summary}
        actions={
          isAdmin && (
            <Button asChild>
              <Link href="/clients/new">Nuevo cliente</Link>
            </Button>
          )
        }
      />

      <div className="mx-auto max-w-7xl px-4 pb-6 pt-4">
        <ClientList clients={clients} isAdmin={isAdmin} canEditClient={canEditClient} users={users} />
      </div>
    </div>
  );
}

