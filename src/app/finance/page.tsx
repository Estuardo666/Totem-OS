import Link from "next/link";
import { auth } from "@/auth";
import { getFinancialStats, getGlobalProfitabilityStats } from "@/actions/finance-actions";
import { StatsCards } from "@/components/features/finance/stats-cards";
import { GlobalProfitabilityCards } from "@/components/features/finance/global-profitability-cards";
import { ProfitabilityAreaChart } from "@/components/features/finance/profitability-area-chart";
import { PartnerProfitability } from "@/components/features/finance/partner-profitability";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";
import { TransactionList } from "@/components/features/finance/transaction-list";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Receipt, TrendingDown } from "lucide-react";

export default async function FinancePage() {
  const session = await auth();
  const userRole = session?.user?.role;
  const isEditor = userRole === "EDITOR";

  const [result, profitabilityResult] = await Promise.all([
    getFinancialStats(),
    // Solo ADMIN ve rentabilidad global
    isEditor ? Promise.resolve({ success: false, error: "No autorizado" } as const) : getGlobalProfitabilityStats(),
  ]);

  // Si hay error, mostrar mensaje
  if (!result.success || !result.data) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Finanzas Totem</h1>
        </div>
        <Card>
          <CardContent className="py-12">
            <p className="text-destructive text-center">
              {result.error || "Error al cargar las estadísticas financieras"}
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
          <h1 className="text-3xl font-bold tracking-tight">Finanzas Totem</h1>
          <p className="text-muted-foreground mt-2">
            Visualiza los ingresos, gastos y beneficios de la agencia
          </p>
        </div>
        <div className="flex gap-2">
          {userRole === "ADMIN" && (
            <Button variant="outline" asChild>
              <Link href="/finance/receivables">
                <Receipt className="mr-2 h-4 w-4" />
                Cuentas por Cobrar
              </Link>
            </Button>
          )}
          {!isEditor && (
            <Button variant="outline" asChild>
              <Link href="/finance/expenses">
                <TrendingDown className="mr-2 h-4 w-4" />
                Gastos y Egresos
              </Link>
            </Button>
          )}
          {userRole === "ADMIN" && (
            <Button variant="outline" asChild>
              <Link href="/finance/settlement">
                <Receipt className="mr-2 h-4 w-4" />
                Liquidación Interna
              </Link>
            </Button>
          )}
          <TransactionDialog />
        </div>
      </div>

      {/* Sección de Rentabilidad Global (Solo ADMIN) */}
      {userRole === "ADMIN" && profitabilityResult.success && profitabilityResult.data && (
        <div className="mb-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">Rentabilidad Global</h2>
            <p className="text-muted-foreground">
              Análisis completo de ingresos, egresos y utilidad neta
            </p>
          </div>

          {/* Métricas Globales */}
          <div className="mb-6">
            <GlobalProfitabilityCards stats={profitabilityResult.data} />
          </div>

          {/* Gráfico de Área */}
          <div className="mb-6">
            <ProfitabilityAreaChart stats={profitabilityResult.data} />
          </div>

          {/* Resumen por Socio */}
          <div>
            <PartnerProfitability stats={profitabilityResult.data} />
          </div>
        </div>
      )}

      {/* Tarjetas de estadísticas */}
      <div className="mb-8">
        <StatsCards stats={result.data} userRole={userRole} />
      </div>

      {/* Tabla de transacciones */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Transacciones Recientes</h2>
        <TransactionList transactions={result.data.recentTransactions} />
      </div>
    </div>
  );
}

