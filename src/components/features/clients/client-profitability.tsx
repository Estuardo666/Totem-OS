"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ClientProfitabilityProps {
  income: number;
  expenses: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ClientProfitability({ income, expenses }: ClientProfitabilityProps) {
  const profitability = income - expenses;
  const margin = income > 0 ? (profitability / income) * 100 : 0;
  const isCritical = margin < 20 && margin > 0; // Margen crítico si es menor a 20%
  const isNegative = profitability < 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Rentabilidad Real</span>
          {isCritical && (
            <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Margen Crítico
            </Badge>
          )}
          {isNegative && (
            <Badge variant="destructive">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Pérdida
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Ingresos Pagados</span>
            <span className="font-semibold text-green-600 flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              {formatCurrency(income)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Gastos Vinculados</span>
            <span className="font-semibold text-red-600 flex items-center gap-1">
              <TrendingDown className="h-4 w-4" />
              {formatCurrency(expenses)}
            </span>
          </div>
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Rentabilidad</span>
              <span
                className={`text-2xl font-bold ${
                  profitability >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatCurrency(profitability)}
              </span>
            </div>
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">
                Margen: {margin.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

