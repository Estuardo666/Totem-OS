import { Video } from "lucide-react";
import { auth } from "@/auth";
import { getClients } from "@/actions/client-actions";
import { getShootings } from "@/actions/shooting-actions";
import { ShootsView } from "@/components/features/shoots/shoots-view";
import { Card, CardContent } from "@/components/ui/card";

export default async function ShootsPage() {
  const session = await auth();

  if (!session) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <Card>
          <CardContent className="py-12">
            <p className="text-destructive text-center">No autenticado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Obtener datos
  const [clientsResult, shootingsResult] = await Promise.all([
    getClients(),
    getShootings(), // Obtener todos los rodajes (sin filtro por mes inicialmente)
  ]);

  const clients = clientsResult.success ? clientsResult.data ?? [] : [];
  const shootings = shootingsResult.success ? shootingsResult.data ?? [] : [];

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Video className="h-8 w-8" />
            Plan de Rodaje
          </h1>
          <p className="text-muted-foreground mt-2">
            Gestiona y visualiza todos los rodajes programados
          </p>
        </div>
      </div>

      <ShootsView shootings={shootings} clients={clients} />
    </div>
  );
}

