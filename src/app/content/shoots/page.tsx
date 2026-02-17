import { auth } from "@/auth";
import { getClients } from "@/actions/client-actions";
import { getShootings } from "@/actions/shooting-actions";
import { ShootsClient } from "@/components/features/shoots/shoots-client";
import { Card, CardContent } from "@/components/ui/card";

export default async function ShootsPage() {
  const session = await auth();

  if (!session) {
    return (
      <div className="container mx-auto py-3 px-2 md:px-3">
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

  return <ShootsClient shootings={shootings} clients={clients} />;
}

