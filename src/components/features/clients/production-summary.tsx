"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ProductionSummaryProps {
  deliverables: {
    reelsCompleted: number;
    flyersCompleted: number;
    reelsContracted: number;
    flyersContracted: number;
    completedTasks: Array<{
      id: string;
      title: string;
      type: string;
      publishedAt: Date | null;
    }>;
  };
  month: string;
  year: number;
}

export function ProductionSummary({
  deliverables,
  month,
  year,
}: ProductionSummaryProps) {
  const reelsPercentage = deliverables.reelsContracted > 0
    ? Math.round((deliverables.reelsCompleted / deliverables.reelsContracted) * 100)
    : 0;
  
  const flyersPercentage = deliverables.flyersContracted > 0
    ? Math.round((deliverables.flyersCompleted / deliverables.flyersContracted) * 100)
    : 0;

  // Calcular entregables faltantes
  const reelsFaltantes = Math.max(0, deliverables.reelsContracted - deliverables.reelsCompleted);
  const flyersFaltantes = Math.max(0, deliverables.flyersContracted - deliverables.flyersCompleted);

  return (
    <Card className="bg-white shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Resumen de Producción
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reels */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Reels</span>
            <Badge
              variant={reelsPercentage === 100 ? "default" : "secondary"}
              className={
                reelsPercentage === 100
                  ? "bg-green-600 text-white"
                  : "bg-yellow-500 text-white"
              }
            >
              {reelsPercentage}%
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-2xl font-bold">
              <span className="text-green-700">
                {deliverables.reelsCompleted}
              </span>
              <span className="text-gray-400">/</span>
              <span className="text-gray-600">
                {deliverables.reelsContracted}
              </span>
            </div>
            <Progress value={reelsPercentage} className="h-2" />
            {reelsFaltantes > 0 && (
              <p className="text-xs text-amber-600 mt-1 font-medium">
                {reelsFaltantes} {reelsFaltantes === 1 ? "entregable se pasa" : "entregables se pasan"} al siguiente mes
              </p>
            )}
          </div>
        </div>

        {/* Flyers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Flyers</span>
            <Badge
              variant={flyersPercentage === 100 ? "default" : "secondary"}
              className={
                flyersPercentage === 100
                  ? "bg-green-600 text-white"
                  : "bg-yellow-500 text-white"
              }
            >
              {flyersPercentage}%
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-2xl font-bold">
              <span className="text-blue-700">
                {deliverables.flyersCompleted}
              </span>
              <span className="text-gray-400">/</span>
              <span className="text-gray-600">
                {deliverables.flyersContracted}
              </span>
            </div>
            <Progress value={flyersPercentage} className="h-2" />
            {flyersFaltantes > 0 && (
              <p className="text-xs text-amber-600 mt-1 font-medium">
                {flyersFaltantes} {flyersFaltantes === 1 ? "entregable se pasa" : "entregables se pasan"} al siguiente mes
              </p>
            )}
          </div>
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Progreso del mes de {month} {year}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

