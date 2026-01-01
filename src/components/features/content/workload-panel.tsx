"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, AlertCircle } from "lucide-react";
import type { UserWorkload } from "@/actions/workload-actions";

interface WorkloadPanelProps {
  workloads: UserWorkload[];
}

export function WorkloadPanel({ workloads }: WorkloadPanelProps) {
  // Calcular porcentaje de carga
  const getWorkloadPercentage = (count: number, capacity: number): number => {
    return Math.min((count / capacity) * 100, 100);
  };

  // Obtener color según la carga
  const getWorkloadColor = (percentage: number): string => {
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 80) return "bg-orange-500";
    if (percentage >= 60) return "bg-yellow-500";
    return "bg-green-500";
  };

  // Obtener color del texto según la carga
  const getWorkloadTextColor = (percentage: number): string => {
    if (percentage >= 100) return "text-red-600";
    if (percentage >= 80) return "text-orange-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-green-600";
  };

  // Obtener badge de rol
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <Badge variant="default" className="bg-purple-600">Admin</Badge>;
      case "EDITOR":
        return <Badge variant="default" className="bg-blue-600">Editor</Badge>;
      case "VIEWER":
        return <Badge variant="outline">Viewer</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Carga de Trabajo por Socio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {workloads.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay usuarios en el equipo
          </p>
        ) : (
          workloads.map((workload) => {
            const percentage = getWorkloadPercentage(
              workload.pendingTasksCount,
              workload.weeklyCapacity
            );
            const isOverCapacity = workload.pendingTasksCount >= workload.weeklyCapacity;

            return (
              <div key={workload.userId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{workload.userName}</span>
                    {getRoleBadge(workload.userRole)}
                  </div>
                  <div className="flex items-center gap-2">
                    {isOverCapacity && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span
                      className={`text-sm font-semibold ${getWorkloadTextColor(
                        percentage
                      )}`}
                    >
                      {workload.pendingTasksCount} / {workload.weeklyCapacity}
                    </span>
                  </div>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full transition-all ${getWorkloadColor(percentage)}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                {isOverCapacity && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Capacidad semanal excedida
                  </p>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

