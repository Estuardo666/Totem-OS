"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Sala de Guerra
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Error al cargar los datos de la Sala de Guerra.</p>
        </CardContent>
      </Card>
    );
  }

  // Si el array está vacío, mostrar mensaje positivo
  if (warRoom.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-green-500" />
            Sala de Guerra
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">✨ Todo en orden. No hay urgencias.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          Sala de Guerra
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
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
                  "block p-3 rounded-lg border-l-4 hover:bg-muted/50 transition-colors relative",
                  isPublishedWithoutMetrics ? "border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/20" : priorityConfig.borderColor,
                  isHighPriorityOverdue && !isPublishedWithoutMetrics && priorityConfig.bgColor
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isPublishedWithoutMetrics ? (
                        <BarChart3 className="h-4 w-4 text-purple-600" />
                      ) : PriorityIcon && (
                        <PriorityIcon className={cn(
                          "h-4 w-4",
                          task.priority === "URGENT" ? "text-red-600 animate-pulse" : "text-orange-500"
                        )} />
                      )}
                      <h4 className="font-medium text-sm">{task.title}</h4>
                      {isPublishedWithoutMetrics ? (
                        <Badge className="text-xs bg-purple-600 text-white">
                          Pendiente de Medición
                        </Badge>
                      ) : (
                        <>
                          <Badge className={cn("text-xs", priorityConfig.badgeColor)}>
                            {priorityConfig.badgeLabel}
                          </Badge>
                          <Badge variant={urgency.variant} className="text-xs">
                            {urgency.label}
                          </Badge>
                        </>
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
      </CardContent>
    </Card>
  );
}

