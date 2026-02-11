"use client";

import { Badge } from "@/components/ui/badge";
import { Users, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
        return <Badge variant="default" className="bg-purple-600 text-xs rounded-lg">Admin</Badge>;
      case "EDITOR":
        return <Badge variant="default" className="bg-blue-600 text-xs rounded-lg">Editor</Badge>;
      case "VIEWER":
        return <Badge variant="secondary" className="text-xs rounded-lg">Viewer</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs rounded-lg">{role}</Badge>;
    }
  };

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="p-5 border-b">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
            <Users className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-semibold">Carga de Trabajo por Socio</h3>
        </div>
      </div>
      <div className="divide-y">
        {workloads.length === 0 ? (
          <div className="text-center py-10 px-4">
            <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              No hay usuarios en el equipo
            </p>
          </div>
        ) : (
          workloads.map((workload) => {
            const percentage = getWorkloadPercentage(
              workload.pendingTasksCount,
              workload.weeklyCapacity
            );
            const isOverCapacity = workload.pendingTasksCount >= workload.weeklyCapacity;

            return (
              <div key={workload.userId} className="p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-10 w-10 ring-2 ring-border/30">
                    <AvatarImage src={workload.userImage || undefined} alt={workload.userName} />
                    <AvatarFallback className="text-sm font-medium">
                      {workload.userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{workload.userName}</span>
                      {getRoleBadge(workload.userRole)}
                    </div>
                    <div className="flex items-center gap-2">
                      {isOverCapacity && (
                        <AlertCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span
                        className={`text-xs font-semibold ${getWorkloadTextColor(
                          percentage
                        )}`}
                      >
                        {workload.pendingTasksCount} / {workload.weeklyCapacity}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all ${getWorkloadColor(percentage)}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                {isOverCapacity && (
                  <p className="text-xs text-red-600 flex items-center gap-1 mt-2">
                    <AlertCircle className="h-3 w-3" />
                    Capacidad semanal excedida
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

