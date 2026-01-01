"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Target } from "lucide-react";

interface ReceivablesSummaryProps {
  totalReceivable: number;
  clientsWithDebt: number;
  monthProjection: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ReceivablesSummary({
  totalReceivable,
  clientsWithDebt,
  monthProjection,
}: ReceivablesSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Saldo Pendiente Total</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalReceivable)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Suma de todas las transacciones de ingreso pendientes
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Clientes con Deuda</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{clientsWithDebt}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Número de clientes únicos con pagos pendientes
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Proyección del Mes</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(monthProjection)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Suma de lo pagado + lo pendiente del mes actual
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

