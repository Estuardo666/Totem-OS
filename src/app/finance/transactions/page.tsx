import { auth } from "@/auth";
import { getFinancialStats } from "@/actions/finance-actions";
import { TransactionList } from "@/components/features/finance/transaction-list";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";
import { Button } from "@/components/ui/button";
import { Plus, DollarSign, FileText } from "lucide-react";
import { PageHeader } from "@/components/shared";
import Link from "next/link";

export default async function TransactionsPage() {
  const session = await auth();
  const userRole = session?.user?.role;
  const isAdmin = userRole === "ADMIN";

  const result = await getFinancialStats();

  if (!result.success || !result.data) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
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
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-foreground" />
              <div>
                <h1 className="text-xl font-bold">Transacciones</h1>
                <p className="text-xs text-muted-foreground">
                  {isAdmin
                    ? "Gestiona todas las transacciones financieras del sistema"
                    : "Gestiona tus transacciones financieras"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <TransactionDialog>
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
                    <Link href="/finance/invoices">
                      <FileText className="h-4 w-4" />
                      <span className="hidden sm:inline">Facturas</span>
                      <span className="sm:hidden">Facturas</span>
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-lg font-semibold">Historial de Transacciones</h2>
          </div>
          <div className="p-4">
            <TransactionList transactions={result.data.recentTransactions} />
          </div>
        </div>
      </div>
    </div>
  );
}
