import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getClients } from "@/actions/client-actions";
import { GeneratorForm } from "@/components/features/admin/generator-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wand2 } from "lucide-react";

export default async function GeneratorPage() {
  // Verificar autenticación y rol
  const session = await auth();
  const userRole = session?.user?.role;

  // Si no está autenticado o no es ADMIN, redirigir al Dashboard
  if (!session || userRole !== "ADMIN") {
    redirect("/");
  }

  // Obtener clientes activos
  const clientsResult = await getClients();

  if (!clientsResult.success || !clientsResult.data) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <Card>
          <CardContent className="py-12">
            <p className="text-destructive text-center">
              {clientsResult.error || "Error al cargar los clientes"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filtrar solo clientes activos
  const activeClients = clientsResult.data.filter(
    (client) => client.status === "ACTIVE"
  );

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Wand2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Generador de Estrategias Mensuales
            </h1>
            <p className="text-muted-foreground mt-1">
              Genera planes mensuales de contenido para múltiples clientes
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Clientes</CardTitle>
          <CardDescription>
            Selecciona los clientes para los que deseas generar el plan mensual estándar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GeneratorForm clients={activeClients} />
        </CardContent>
      </Card>
    </div>
  );
}

