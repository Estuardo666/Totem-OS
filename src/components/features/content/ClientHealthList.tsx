"use client";

import { Progress } from "@/components/ui/progress";

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

export function ClientHealthList({ semaphore }: ClientHealthListProps) {
  if (semaphore.length === 0) {
    return (
      <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-6">
        <h2 className="text-lg font-bold mb-3">Salud de Clientes</h2>
        <p className="text-sm text-muted-foreground">No hay clientes activos</p>
      </div>
    );
  }

  const getStatusBadge = (progress: number) => {
    if (progress >= 80) {
      return {
        label: "Saludable",
        bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
        dotColor: "bg-emerald-500",
        textColor: "text-emerald-600 dark:text-emerald-400",
      };
    } else if (progress >= 50) {
      return {
        label: "Riesgo",
        bgColor: "bg-amber-50 dark:bg-amber-950/30",
        dotColor: "bg-amber-500",
        textColor: "text-amber-600 dark:text-amber-400",
      };
    } else {
      return {
        label: "Crítico",
        bgColor: "bg-red-50 dark:bg-red-950/30",
        dotColor: "bg-red-500",
        textColor: "text-red-600 dark:text-red-400",
      };
    }
  };

  return (
    <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow p-6 space-y-4">
      <h2 className="text-lg font-bold">Salud de Clientes</h2>
      <div className="space-y-3">
        {semaphore.map((item) => {
          const progress =
            item.totalTasks > 0
              ? Math.round((item.completedTasks / item.totalTasks) * 100)
              : 100;
          const statusConfig = getStatusBadge(progress);

          return (
            <div key={item.clientId} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{item.clientName}</span>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${statusConfig.bgColor} border border-border/50`}>
                  <div className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
                  <span className={`text-xs font-medium ${statusConfig.textColor}`}>
                    {statusConfig.label}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {item.completedTasks} / {item.totalTasks} completadas
                  </span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${statusConfig.dotColor} transition-all duration-300`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

