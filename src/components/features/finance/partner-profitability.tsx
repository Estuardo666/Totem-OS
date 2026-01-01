"use client";

import { Users } from "lucide-react";
import type { GlobalProfitabilityStats } from "@/actions/finance-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PartnerProfitabilityProps {
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

export function PartnerProfitability({ stats }: PartnerProfitabilityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          Resumen de Rentabilidad por Socio
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Stuart */}
            <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Stuart Pérez
                </span>
                <span className="text-xs text-muted-foreground">50%</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(stats.partnerDistribution.stuart)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Participación en utilidad neta
              </p>
            </div>

            {/* Paty */}
            <div className="rounded-lg border p-4 bg-purple-50 dark:bg-purple-950/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                  Paty
                </span>
                <span className="text-xs text-muted-foreground">50%</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(stats.partnerDistribution.paty)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Participación en utilidad neta
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Distribuido</span>
              <span className="text-lg font-bold text-blue-600">
                {formatCurrency(
                  stats.partnerDistribution.stuart + stats.partnerDistribution.paty
                )}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Distribución equitativa basada en estructura de trabajo actual
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

