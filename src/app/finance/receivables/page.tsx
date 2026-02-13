import { getReceivables } from "@/actions/finance-actions";
import { ReceivablesSummary } from "@/components/features/finance/receivables-summary";
import { ReceivablesTable } from "@/components/features/finance/receivables-table";
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

  // Ensure all required fields exist with defaults
  const {
    totalReceivable = 0,
    clientsWithDebt = 0,
    monthProjection = 0,
    pendingTransactions = [],
  } = result.data;

  return (
    <div className="container mx-auto p-3">
      <PageHeader
        title="Cuentas por Cobrar"
        description="Gestiona la cartera de clientes y seguimiento de pagos pendientes"
      />

      {/* Resumen de métricas (KPIs) */}
      <div className="mb-8">
        <ReceivablesSummary
          totalReceivable={totalReceivable}
          clientsWithDebt={clientsWithDebt}
          monthProjection={monthProjection}
        />
      </div>

      {/* Tabla de seguimiento */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Transacciones Pendientes</h2>
        <ReceivablesTable transactions={pendingTransactions} />
      </div>
    </div>
  );
}

