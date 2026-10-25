import { auth } from "@/auth";
import { getFinancialStats } from "@/actions/finance-actions";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";
import { TransactionsOfflineView } from "@/components/features/finance/transactions-offline-view";
import { Button } from "@/components/ui/button";
import { Plus, DollarSign, Receipt } from "lucide-react";
import Link from "next/link";
import { AppPageHeader } from "@/components/shared/app-page-header";

export default async function TransactionsPage() {
  const session = await auth();
  const userRole = session?.user?.role;
  const isAdmin = userRole === "ADMIN";

  const result = await getFinancialStats();

  if (!result.success || !result.data) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AppPageHeader title="Transacciones" />

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-card dark:bg-gray-900 p-8">
            <p className="text-destructive text-center font-medium">
              {result.error || "Error al cargar las transacciones"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header iOS-26 sticky */}
      <AppPageHeader
        title="Transacciones"
        description={<>{isAdmin ? "Gestiona todas las transacciones financieras del sistema" : "Gestiona tus transacciones financieras"}</>}
        actions={
          <>
            <TransactionDialog isAdminOverride={isAdmin}>
                <Button className="gap-2 rounded-full">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Crear nueva transacción</span>
                  <span className="sm:hidden">Crear</span>
                </Button>
              </TransactionDialog>

              {isAdmin && (
                <>
                  <Button variant="outline" asChild className="gap-2 rounded-full border-2">
                    <Link href="/finance/settlement">
                      <DollarSign className="h-4 w-4" />
                      <span className="hidden sm:inline">Liquidación interna</span>
                      <span className="sm:hidden">Liquidar</span>
                    </Link>
                  </Button>

                  <Button variant="outline" asChild className="gap-2 rounded-full border-2">
                    <Link href="/admin/facturacion">
                      <Receipt className="h-4 w-4" />
                      <span className="hidden sm:inline">Facturación Electrónica</span>
                      <span className="sm:hidden">Facturación</span>
                    </Link>
                  </Button>
                </>
              )}
          </>
        }
      />

      {/* Transaction List */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-center text-lg font-semibold">Historial de Transacciones</h2>
          </div>
          <div className="p-4">
            <TransactionsOfflineView transactions={result.data.recentTransactions} />
          </div>
        </div>
      </div>
    </div>
  );
}
