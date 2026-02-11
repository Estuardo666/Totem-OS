import { getFinancialStats } from "@/actions/finance-actions";
import { format } from "date-fns";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";

// Función para formatear dinero como USD
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function RecentTransactions() {
  // Obtener estadísticas financieras
  const financialResult = await getFinancialStats();
  const financialStats = financialResult.success ? financialResult.data : null;
  
  // Últimas 3 transacciones
  const recentTransactions = financialStats?.recentTransactions.slice(0, 3) || [];

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="p-5 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">Últimas Transacciones</h3>
              <p className="text-xs text-muted-foreground">{recentTransactions.length} recientes</p>
            </div>
          </div>
          <Link
            href="/finance/transactions"
            className="text-sm text-primary hover:underline font-medium"
          >
            Ver todas
          </Link>
        </div>
      </div>
      <div className="divide-y">
        {recentTransactions.length > 0 ? (
          recentTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
            >
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                transaction.type === "INCOME" 
                  ? "bg-emerald-100 dark:bg-emerald-950/50" 
                  : "bg-rose-100 dark:bg-rose-950/50"
              }`}>
                {transaction.type === "INCOME" ? (
                  <ArrowDownLeft className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ArrowUpRight className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm leading-tight truncate">
                  {transaction.description}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(transaction.date), "dd/MM/yyyy")}
                </p>
              </div>
              <div
                className={`font-semibold text-sm ${
                  transaction.type === "INCOME"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {transaction.type === "INCOME" ? "+" : "-"}
                {formatCurrency(transaction.amount)}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 px-4">
            <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Wallet className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              No hay transacciones registradas
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
