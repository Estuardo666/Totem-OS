import { getReceivables } from "@/actions/finance-actions";
import { ReceivablesOfflineView } from "@/components/features/finance/receivables-offline-view";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared";

export default async function ReceivablesPage() {
  const result = await getReceivables();

  if (!result.success || !result.data) {
    return (
      <div className="container mx-auto p-3">
        <PageHeader title="Cuentas por Cobrar" />
        <Card>
          <CardContent className="py-12">
            <p className="text-destructive text-center">
              {result.error || "Error al cargar las cuentas por cobrar"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3">
      <PageHeader
        title="Cuentas por Cobrar"
        description="Gestiona la cartera de clientes y seguimiento de pagos pendientes"
      />

      <ReceivablesOfflineView snapshot={result.data} />
    </div>
  );
}

