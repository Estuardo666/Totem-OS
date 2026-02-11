"use client";

import { format, isPast, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Flame, BarChart3 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface WarRoomTask {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  scheduledAt: Date | null;
  publishedAt: Date | null;
  client: {
    id: string;
    name: string;
  };
  assignedTo: {
    id: string;
    name: string;
  } | null;
  metrics: {
    id: string;
  } | null;
}

interface WarRoomProps {
  warRoom: WarRoomTask[];
}

const getUrgencyBadge = (scheduledAt: Date | null) => {
  if (!scheduledAt) return { variant: "outline" as const, label: "Sin fecha" };

  const isOverdue = isPast(scheduledAt);
  const daysUntil = differenceInDays(scheduledAt, new Date());

  if (isOverdue) {
    return { variant: "destructive" as const, label: "Atrasada" };
  } else if (daysUntil === 0) {
    return { variant: "destructive" as const, label: "Hoy" };
  } else if (daysUntil === 1) {
    return { variant: "secondary" as const, label: "Mañana" };
  } else {
    return { variant: "outline" as const, label: `${daysUntil} días` };
  }
};

const getPriorityConfig = (priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT") => {
  switch (priority) {
    case "URGENT":
      return {
        borderColor: "border-l-red-600",
        badgeColor: "bg-red-600 text-white",
        badgeLabel: "Urgente",
        icon: Flame,
        bgColor: "bg-red-50/50 dark:bg-red-950/20",
      };
    case "HIGH":
      return {
        borderColor: "border-l-orange-500",
        badgeColor: "bg-orange-500 text-white",
        badgeLabel: "Alta",
        icon: AlertTriangle,
        bgColor: "bg-orange-50/50 dark:bg-orange-950/20",
      };
    case "MEDIUM":
      return {
        borderColor: "border-l-yellow-500",
        badgeColor: "bg-yellow-500 text-white",
        badgeLabel: "Media",
        icon: undefined,
        bgColor: "bg-yellow-50/50 dark:bg-yellow-950/20",
      };
    case "LOW":
      return {
        borderColor: "border-l-blue-500",
        badgeColor: "bg-blue-500 text-white",
        badgeLabel: "Baja",
        icon: undefined,
        bgColor: "bg-blue-50/50 dark:bg-blue-950/20",
      };
    default:
      return {
        borderColor: "border-l-gray-500",
        badgeColor: "bg-gray-500 text-white",
        badgeLabel: "Media",
        icon: undefined,
        bgColor: "",
      };
  }
};

export function WarRoom({ warRoom }: WarRoomProps) {
  // Validación defensiva: asegurar que warRoom sea un array
  if (!Array.isArray(warRoom)) {
    console.error("WarRoom: warRoom no es un array", warRoom);
    return (
      <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-bold">Sala de Guerra</h2>
        </div>
        <p className="text-sm text-muted-foreground">Error al cargar los datos de la Sala de Guerra.</p>
      </div>
    );
  }

  // Si el array está vacío, mostrar mensaje positivo
  if (warRoom.length === 0) {
    return (
      <div className="rounded-3xl border border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 dark:from-emerald-950/30 dark:via-gray-900 dark:to-emerald-900/20 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-bold">Sala de Guerra</h2>
        </div>
        <p className="text-sm text-muted-foreground">✨ Todo en orden. No hay urgencias.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-red-200 dark:border-red-800/50 bg-gradient-to-br from-red-50 via-white to-red-50/50 dark:from-red-950/30 dark:via-gray-900 dark:to-red-900/20 shadow-sm hover:shadow-md transition-shadow p-6 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-destructive" />
        <h2 className="text-lg font-bold">Sala de Guerra</h2>
      </div>
      <div className="space-y-2">
        {warRoom.map((task) => {
          const urgency = getUrgencyBadge(task.scheduledAt);
          const priorityConfig = getPriorityConfig(task.priority);
          const PriorityIcon = priorityConfig.icon;
          const scheduledDate = task.scheduledAt
            ? format(new Date(task.scheduledAt), "dd/MM/yyyy", { locale: es })
            : "Sin fecha";
          
          const isOverdue = task.scheduledAt ? isPast(new Date(task.scheduledAt)) : false;
          const isHighPriorityOverdue = (task.priority === "URGENT" || task.priority === "HIGH") && isOverdue;

          // Verificar si es una tarea publicada sin métricas
          const isPublishedWithoutMetrics = task.status === "PUBLISHED" && !task.metrics;
          
          return (
            <Link
              key={task.id}
              href={`/content?task=${task.id}`}
              className={cn(
                "block p-3.5 rounded-2xl border hover:shadow-sm transition-all",
                isPublishedWithoutMetrics 
                  ? "border-purple-200 dark:border-purple-800/50 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10 shadow-sm" 
                  : isHighPriorityOverdue 
                    ? priorityConfig.bgColor + " " + priorityConfig.borderColor.replace("border-l", "border") + " shadow-sm"
                    : "border-gray-200 dark:border-gray-700 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50 shadow-sm"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isPublishedWithoutMetrics ? (
                      <BarChart3 className="h-4 w-4 text-purple-600 flex-shrink-0" />
                    ) : PriorityIcon && (
                      <PriorityIcon className={cn(
                        "h-4 w-4 flex-shrink-0",
                        task.priority === "URGENT" ? "text-red-600 animate-pulse" : "text-orange-500"
                      )} />
                    )}
                    <h4 className="font-medium text-sm">{task.title}</h4>
                    {isPublishedWithoutMetrics ? (
                      <div className="px-2 py-1 rounded-full text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-medium">
                        Pendiente de Medición
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${priorityConfig.badgeColor}`}>
                          {priorityConfig.badgeLabel}
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          urgency.variant === "destructive" 
                            ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
                            : urgency.variant === "secondary"
                              ? "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300"
                              : "bg-muted text-muted-foreground"
                        }`}>
                          {urgency.label}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>
                      Cliente: <span className="font-medium">{task.client.name}</span>
                    </p>
                    {task.assignedTo && (
                      <p>
                        Asignado a: <span className="font-medium">{task.assignedTo.name}</span>
                      </p>
                    )}
                    <p>Fecha: {scheduledDate}</p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

