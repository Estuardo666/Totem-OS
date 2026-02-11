import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { getClients } from "@/actions/client-actions";
import { ClientList } from "@/components/features/clients/client-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/auth";

export default async function ClientsPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const canEditClient = isAdmin || session?.user?.role === "EDITOR" || session?.user?.role === "COMMUNITY";
  
  const result = await getClients();

  // Si hay error, mostrar mensaje (en producción podrías redirigir o mostrar error boundary)
  if (!result.success || !result.data) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Card className="rounded-xl">
            <CardContent className="py-12">
              <p className="text-destructive text-center">
                {result.error || "Error al cargar los clientes"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header iOS-style con sticky */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
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
              <Button asChild className="rounded-lg shadow-sm">
                <Link href="/clients/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Cliente
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-6">
        <ClientList clients={result.data} isAdmin={isAdmin} canEditClient={canEditClient} />
      </div>
    </div>
  );
}

