"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, DollarSign } from "lucide-react";

interface ExpensesSummaryProps {
  totalExpensesThisMonth: number;
  pendingReimbursement: number;
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
}: ExpensesSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            Suma de gastos del mes actual
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
            Gastos pendientes de reembolso asignados a usuarios
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

