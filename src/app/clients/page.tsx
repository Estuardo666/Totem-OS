import Link from "next/link";
import { Plus } from "lucide-react";
import { getClients } from "@/actions/client-actions";
import { ClientList } from "@/components/features/clients/client-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared";
import { auth } from "@/auth";

export default async function ClientsPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const canEditClient = isAdmin || session?.user?.role === "EDITOR" || session?.user?.role === "COMMUNITY";
  
  const result = await getClients();

  // Si hay error, mostrar mensaje (en producción podrías redirigir o mostrar error boundary)
  if (!result.success || !result.data) {
    return (
      <div className="container mx-auto py-3 px-2 md:px-3">
        <Card>
          <CardContent className="py-12">
            <p className="text-destructive text-center">
              {result.error || "Error al cargar los clientes"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3">
      <PageHeader
        title="Clientes"
        description={
          isAdmin 
            ? "Gestiona todos tus clientes desde aquí"
            : "Visualiza el dashboard general de clientes"
        }
        actions={
          isAdmin ? (
            <Button asChild>
              <Link href="/clients/new">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Cliente
              </Link>
            </Button>
          ) : undefined
        }
      />

      <ClientList clients={result.data} isAdmin={isAdmin} canEditClient={canEditClient} />
    </div>
  );
}

