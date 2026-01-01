"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Calculator } from "lucide-react";
import type { MonthlySettlement } from "@/actions/settlement-actions";

interface SettlementSummaryProps {
  settlement: MonthlySettlement;
}

export function SettlementSummary({ settlement }: SettlementSummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ingresos Brutos</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(settlement.grossIncome)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Transacciones pagadas del mes
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gastos de Producción</CardTitle>
          <TrendingDown className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            {formatCurrency(settlement.productionExpenses)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Gastos de clientes reembolsados
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gastos Operativos</CardTitle>
          <Calculator className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(settlement.operationalExpenses)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Salarios de editores
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Utilidad Neta</CardTitle>
          <DollarSign className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            settlement.netProfit >= 0 ? "text-purple-600" : "text-red-600"
          }`}>
            {formatCurrency(settlement.netProfit)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ingresos - Gastos
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

