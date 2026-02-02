import Link from "next/link";
import { Plus } from "lucide-react";
import { getClients } from "@/actions/client-actions";
import { ClientList } from "@/components/features/clients/client-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/auth";

export default async function ClientsPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  
  const result = await getClients();

  // Si hay error, mostrar mensaje (en producción podrías redirigir o mostrar error boundary)
  if (!result.success || !result.data) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
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
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground mt-2">
            {isAdmin 
              ? "Gestiona todos tus clientes desde aquí"
              : "Visualiza el dashboard general de clientes"
            }
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Cliente
            </Link>
          </Button>
        )}
      </div>

      <ClientList clients={result.data} />
    </div>
  );
}

