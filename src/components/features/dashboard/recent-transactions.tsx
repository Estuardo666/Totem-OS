import { getFinancialStats } from "@/actions/finance-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import Link from "next/link";

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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Últimas Transacciones</CardTitle>
          <Link
            href="/finance"
            className="text-sm text-primary hover:underline"
          >
            Ver todas
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {recentTransactions.length > 0 ? (
          <div className="space-y-3">
            {recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-tight">
                    {transaction.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(transaction.date), "dd/MM/yyyy")}
                  </p>
                </div>
                <div
                  className={`font-semibold ${
                    transaction.type === "INCOME"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {transaction.type === "INCOME" ? "+" : "-"}
                  {formatCurrency(transaction.amount)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No hay transacciones registradas
          </p>
        )}
      </CardContent>
    </Card>
  );
}
