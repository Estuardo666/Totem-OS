"use client";

import { TrendingUp, TrendingDown, Wallet, Percent } from "lucide-react";
import type { GlobalProfitabilityStats } from "@/actions/finance-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GlobalProfitabilityCardsProps {
  stats: GlobalProfitabilityStats;
}

// Función para formatear dinero como USD
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Función para formatear porcentaje
function formatPercent(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export function GlobalProfitabilityCards({ stats }: GlobalProfitabilityCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {/* Ingresos Totales Globales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ingresos Totales (Global)</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(stats.totalIncome)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Mes actual
          </p>
        </CardContent>
      </Card>

      {/* Egresos Totales Globales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Egresos Totales (Global)</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(stats.totalExpenses)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Mes actual
          </p>
        </CardContent>
      </Card>

      {/* Utilidad Neta */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Utilidad Neta</CardTitle>
          <Wallet className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              stats.netProfit >= 0 ? "text-blue-600" : "text-red-600"
            }`}
          >
            {formatCurrency(stats.netProfit)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ingresos - Egresos
          </p>
        </CardContent>
      </Card>

      {/* Margen de Utilidad */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Margen de Utilidad</CardTitle>
          <Percent className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              stats.profitMargin >= 0 ? "text-blue-600" : "text-red-600"
            }`}
          >
            {formatPercent(stats.profitMargin)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Porcentaje de ganancia
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

