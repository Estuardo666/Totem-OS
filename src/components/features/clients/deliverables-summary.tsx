"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DeliverablesSummaryProps {
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

function getTypeLabel(type: string): string {
  switch (type) {
    case "REEL":
      return "Reel";
    case "FLYER":
      return "Flyer";
    case "STORY":
      return "Story";
    default:
      return type;
  }
}

export function DeliverablesSummary({
  deliverables,
  month,
  year,
}: DeliverablesSummaryProps) {
  const reelsPercentage = deliverables.reelsContracted > 0
    ? Math.round((deliverables.reelsCompleted / deliverables.reelsContracted) * 100)
    : 0;
  
  const flyersPercentage = deliverables.flyersContracted > 0
    ? Math.round((deliverables.flyersCompleted / deliverables.flyersContracted) * 100)
    : 0;

  return (
    <Card className="print:border-gray-300 print:shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Resumen de Entregables - {month} {year}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comparativa Pactado vs Realizado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 bg-green-50 dark:bg-green-950/20 print:bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Reels</span>
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
            <div className="text-2xl font-bold text-green-700">
              {deliverables.reelsCompleted} / {deliverables.reelsContracted}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Entregados / Contratados
            </p>
          </div>

          <div className="rounded-lg border p-4 bg-blue-50 dark:bg-card print:bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Flyers</span>
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
            <div className="text-2xl font-bold text-blue-700">
              {deliverables.flyersCompleted} / {deliverables.flyersContracted}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Entregados / Contratados
            </p>
          </div>
        </div>

        {/* Lista de Tareas Completadas */}
        {deliverables.completedTasks.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Contenido Publicado</h3>
            <div className="space-y-2">
              {deliverables.completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white print:border-gray-300"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {getTypeLabel(task.type)}
                    </Badge>
                    <span className="font-medium">{task.title}</span>
                  </div>
                  {task.publishedAt && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(task.publishedAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {deliverables.completedTasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No hay contenido publicado en este mes.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

