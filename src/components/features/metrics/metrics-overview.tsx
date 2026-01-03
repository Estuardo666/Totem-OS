"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Heart, Users } from "lucide-react";

interface MetricsOverviewProps {
  impressions: number;
  engagements: number;
  fans: number;
}

/**
 * Componente que muestra un resumen de KPIs principales de Facebook
 */
export function MetricsOverview({ impressions, engagements, fans }: MetricsOverviewProps) {
  // Formatear números con separadores de miles (programación defensiva)
  const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null || isNaN(num)) {
      return "0";
    }
    return new Intl.NumberFormat("es-ES").format(Math.round(num));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Alcance/Impresiones */}
      <Card className="border shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Alcance / Impresiones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(impressions)}</div>
          <p className="text-xs text-muted-foreground mt-1">Total de visualizaciones</p>
        </CardContent>
      </Card>

      {/* Engagement */}
      <Card className="border shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Engagement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(engagements)}</div>
          <p className="text-xs text-muted-foreground mt-1">Interacciones totales</p>
        </CardContent>
      </Card>

      {/* Comunidad/Seguidores */}
      <Card className="border shadow-sm h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            Comunidad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(fans)}</div>
          <p className="text-xs text-muted-foreground mt-1">Total de seguidores</p>
        </CardContent>
      </Card>
    </div>
  );
}

