"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface ClientHealthItem {
  clientId: string;
  clientName: string;
  totalTasks: number;
  completedTasks: number;
  status: "GREEN" | "YELLOW" | "RED";
}

interface ClientHealthListProps {
  semaphore: ClientHealthItem[];
}

const getStatusConfig = (progress: number) => {
  if (progress >= 80) {
    return {
      label: "Saludable",
      variant: "default" as const,
      progressColor: "bg-green-500",
      badgeClassName: "bg-green-500 text-white",
    };
  } else if (progress >= 50) {
    return {
      label: "Riesgo",
      variant: "secondary" as const,
      progressColor: "bg-yellow-500",
      badgeClassName: "bg-yellow-500 text-white",
    };
  } else {
    return {
      label: "Crítico",
      variant: "destructive" as const,
      progressColor: "bg-red-500",
      badgeClassName: "bg-red-500 text-white",
    };
  }
};

export function ClientHealthList({ semaphore }: ClientHealthListProps) {
  if (semaphore.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Salud de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No hay clientes activos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salud de Clientes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {semaphore.map((item) => {
            const progress =
              item.totalTasks > 0
                ? Math.round((item.completedTasks / item.totalTasks) * 100)
                : 100;
            const config = getStatusConfig(progress);

            return (
              <div key={item.clientId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.clientName}</span>
                  <Badge className={config.badgeClassName}>{config.label}</Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {item.completedTasks} / {item.totalTasks} completadas
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full ${config.progressColor} transition-all`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

