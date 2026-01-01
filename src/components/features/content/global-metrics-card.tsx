"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Eye, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlobalMetricsCardProps {
  totalViews: number;
  totalReach: number;
  averageEngagementRate: number;
  totalTasks: number;
  previousMonthViews?: number;
  previousMonthReach?: number;
  previousMonthEngagement?: number;
}

export function GlobalMetricsCard({
  totalViews,
  totalReach,
  averageEngagementRate,
  totalTasks,
  previousMonthViews = 0,
  previousMonthReach = 0,
  previousMonthEngagement = 0,
}: GlobalMetricsCardProps) {
  // Calcular crecimiento porcentual
  const viewsGrowth =
    previousMonthViews > 0
      ? ((totalViews - previousMonthViews) / previousMonthViews) * 100
      : 0;
  const reachGrowth =
    previousMonthReach > 0
      ? ((totalReach - previousMonthReach) / previousMonthReach) * 100
      : 0;
  const engagementGrowth =
    previousMonthEngagement > 0
      ? ((averageEngagementRate - previousMonthEngagement) / previousMonthEngagement) * 100
      : 0;

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Impacto Total del Mes
        </CardTitle>
        <CardDescription>
          Métricas agregadas de todos los contenidos publicados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total de Vistas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  Vistas Totales
                </span>
              </div>
              {previousMonthViews > 0 && (
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs",
                    viewsGrowth >= 0 ? "text-green-600" : "text-red-600"
                  )}
                >
                  {viewsGrowth >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(viewsGrowth).toFixed(1)}%
                </div>
              )}
            </div>
            <p className="text-2xl font-bold">{formatNumber(totalViews)}</p>
            <p className="text-xs text-muted-foreground">
              {totalTasks} {totalTasks === 1 ? "contenido" : "contenidos"} publicado{totalTasks === 1 ? "" : "s"}
            </p>
          </div>

          {/* Alcance Total */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  Alcance Total
                </span>
              </div>
              {previousMonthReach > 0 && (
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs",
                    reachGrowth >= 0 ? "text-green-600" : "text-red-600"
                  )}
                >
                  {reachGrowth >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(reachGrowth).toFixed(1)}%
                </div>
              )}
            </div>
            <p className="text-2xl font-bold">{formatNumber(totalReach)}</p>
            <p className="text-xs text-muted-foreground">
              Cuentas alcanzadas
            </p>
          </div>

          {/* Engagement Promedio */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  Engagement Promedio
                </span>
              </div>
              {previousMonthEngagement > 0 && (
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs",
                    engagementGrowth >= 0 ? "text-green-600" : "text-red-600"
                  )}
                >
                  {engagementGrowth >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(engagementGrowth).toFixed(1)}%
                </div>
              )}
            </div>
            <p className="text-2xl font-bold">
              {averageEngagementRate.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground">
              Tasa de engagement promedio
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

