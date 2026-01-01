"use client";

import { TrendingUp, TrendingDown, Wallet, Clock, DollarSign } from "lucide-react";
import type { FinancialStats } from "@/actions/finance-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatsCardsProps {
  stats: FinancialStats;
  userRole?: string;
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

export function StatsCards({ stats, userRole }: StatsCardsProps) {
  const isEditor = userRole === "EDITOR";

  // Si es EDITOR, mostrar cards específicos
  if (isEditor) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Mis Gastos por Reembolsar */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mis Gastos por Reembolsar</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(stats.pendingReimbursements || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Gastos pendientes de reembolso
            </p>
          </CardContent>
        </Card>

        {/* Honorarios Recibidos (Mes) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Honorarios Recibidos (Mes)</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.honorariosReceived || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Honorarios pagados este mes
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Cards para ADMIN
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Ingresos Totales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(stats.totalIncome)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Facturas pagadas
          </p>
        </CardContent>
      </Card>

      {/* Gastos Totales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gastos Totales</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(stats.totalExpenses)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Todos los gastos registrados
          </p>
        </CardContent>
      </Card>

      {/* Balance Neto */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Balance Neto</CardTitle>
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
            Ingresos Pagados - Gastos Pagados
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

