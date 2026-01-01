import { getReceivables } from "@/actions/finance-actions";
import { ReceivablesSummary } from "@/components/features/finance/receivables-summary";
import { ReceivablesTable } from "@/components/features/finance/receivables-table";
import { Card, CardContent } from "@/components/ui/card";

export default async function ReceivablesPage() {
  const result = await getReceivables();

  if (!result.success || !result.data) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Cuentas por Cobrar</h1>
        </div>
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
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Cuentas por Cobrar</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona la cartera de clientes y seguimiento de pagos pendientes
        </p>
      </div>

      {/* Resumen de métricas (KPIs) */}
      <div className="mb-8">
        <ReceivablesSummary
          totalReceivable={result.data.totalReceivable}
          clientsWithDebt={result.data.clientsWithDebt}
          monthProjection={result.data.monthProjection}
        />
      </div>

      {/* Tabla de seguimiento */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Transacciones Pendientes</h2>
        <ReceivablesTable transactions={result.data.pendingTransactions} />
      </div>
    </div>
  );
}

