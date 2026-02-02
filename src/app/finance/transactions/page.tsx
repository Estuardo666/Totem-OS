import { auth } from "@/auth";
import { getFinancialStats } from "@/actions/finance-actions";
import { TransactionList } from "@/components/features/finance/transaction-list";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, DollarSign, FileText } from "lucide-react";
import Link from "next/link";

export default async function TransactionsPage() {
  const session = await auth();
  const userRole = session?.user?.role;
  const isAdmin = userRole === "ADMIN";

  const result = await getFinancialStats();

  if (!result.success || !result.data) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Transacciones</h1>
          <p className="text-muted-foreground">
            Gestiona todas las transacciones financieras
          </p>
        </div>
        <Card>
          <CardContent className="py-12">
            <p className="text-destructive text-center">
              {result.error || "Error al cargar las transacciones"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transacciones</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Gestiona todas las transacciones financieras del sistema" : "Gestiona tus transacciones financieras"}
          </p>
        </div>
        
        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <TransactionDialog>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Crear nueva transacción
            </Button>
          </TransactionDialog>
          
          {isAdmin && (
            <>
              <Button variant="outline" asChild className="gap-2">
                <Link href="/finance/settlement">
                  <DollarSign className="h-4 w-4" />
                  Liquidación interna
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="gap-2">
                <Link href="/finance/invoices">
                  <FileText className="h-4 w-4" />
                  Facturas
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Transaction List */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Transacciones</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionList transactions={result.data.recentTransactions} />
        </CardContent>
      </Card>
    </div>
  );
}
