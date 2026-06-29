"use client";

import { TrendingDown, DollarSign, Receipt, Percent, UserX, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ExpensesSummaryProps {
  totalExpensesThisMonth: number;
  pendingReimbursement: number;
  expenseCount: number;
  previousMonthTotal: number;
  reimbursedAmount: number;
  expensesWithoutClient: { count: number; amount: number };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ExpensesSummary({
  totalExpensesThisMonth,
  pendingReimbursement,
  expenseCount,
  previousMonthTotal,
  reimbursedAmount,
  expensesWithoutClient,
}: ExpensesSummaryProps) {
  const ticketMedio = expenseCount > 0 ? totalExpensesThisMonth / expenseCount : 0;

  const totalAssigned = reimbursedAmount + pendingReimbursement;
  const pctReimbursed = totalAssigned > 0 ? (reimbursedAmount / totalAssigned) * 100 : 0;

  const delta = totalExpensesThisMonth - previousMonthTotal;
  const deltaPct = previousMonthTotal > 0 ? (delta / previousMonthTotal) * 100 : 0;
  const isSignificant = Math.abs(deltaPct) > 10;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gastos del Mes</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalExpensesThisMonth)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {expenseCount} gasto{expenseCount !== 1 ? "s" : ""} registrado{expenseCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendiente de Reembolso</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${pendingReimbursement > 0 ? "text-orange-600" : "text-green-600"}`}>
              {formatCurrency(pendingReimbursement)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Gastos asignados pendientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket medio</CardTitle>
            <Receipt className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(ticketMedio)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Promedio por gasto
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">% Reembolsado</CardTitle>
            <Percent className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${pctReimbursed >= 100 ? "text-green-600" : "text-orange-600"}`}>
              {pctReimbursed.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sobre gastos asignados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin cliente</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${expensesWithoutClient.count > 0 ? "text-amber-600" : "text-green-600"}`}>
              {expensesWithoutClient.count}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {expensesWithoutClient.count > 0
                ? `${formatCurrency(expensesWithoutClient.amount)} sin imputar`
                : "Todo imputado"}
            </p>
          </CardContent>
        </Card>
      </div>

      {previousMonthTotal > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {deltaPct > 10 ? (
                  <ArrowUp className="h-5 w-5 text-red-600" />
                ) : deltaPct < -10 ? (
                  <ArrowDown className="h-5 w-5 text-green-600" />
                ) : (
                  <Minus className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">Comparativa vs. mes anterior</p>
                  <p className="text-xs text-muted-foreground">
                    Mes anterior: {formatCurrency(previousMonthTotal)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${
                  isSignificant
                    ? deltaPct > 0 ? "text-red-600" : "text-green-600"
                    : "text-muted-foreground"
                }`}>
                  {deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {delta > 0 ? "+" : ""}{formatCurrency(delta)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
