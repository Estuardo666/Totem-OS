"use client";

import { useState } from "react";
import { format, isToday, startOfDay, endOfDay } from "date-fns";
import { Calendar, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import { updateTaskStatusRequest } from "@/lib/content-task-status-client";

interface TodayScheduledTasksProps {
  tasks: ContentTaskWithClient[];
}

export function TodayScheduledTasks({ tasks: initialTasks }: TodayScheduledTasksProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState(initialTasks);
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set());

  // Filtrar tareas programadas para hoy
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const scheduledToday = tasks.filter((task) => {
    if (!task.scheduledAt) return false;
    const scheduledDate = new Date(task.scheduledAt);
    return scheduledDate >= todayStart && scheduledDate <= todayEnd && task.status !== "PUBLISHED";
  });

  const handleMarkAsPublished = async (taskId: string) => {
    setUpdatingTasks((prev) => new Set(prev).add(taskId));

    try {
      const result = await updateTaskStatusRequest(taskId, "PUBLISHED");

      if (result.success) {
        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            task.id === taskId
              ? { ...task, status: "PUBLISHED" as const }
              : task
          )
        );
        toast({
          title: "¡Publicado!",
          description: "La tarea ha sido marcada como publicada.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo marcar como publicada",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Ocurrió un error inesperado",
      });
    } finally {
      setUpdatingTasks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  if (scheduledToday.length === 0) {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-orange-50/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-orange-600" />
          <CardTitle className="text-orange-900">Hoy en Redes</CardTitle>
          <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
            {scheduledToday.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {scheduledToday
            .sort((a, b) => {
              if (!a.scheduledAt || !b.scheduledAt) return 0;
              return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
            })
            .map((task) => {
              const isUpdating = updatingTasks.has(task.id);
              const scheduledTime = task.scheduledAt
                ? format(new Date(task.scheduledAt), "HH:mm")
                : "";

              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-orange-200 bg-white hover:bg-orange-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Checkbox
                      checked={task.status === "PUBLISHED"}
                      onCheckedChange={() => {
                        if (task.status !== "PUBLISHED") {
                          handleMarkAsPublished(task.id);
                        }
                      }}
                      disabled={isUpdating || task.status === "PUBLISHED"}
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm leading-tight truncate">
                          {task.title}
                        </h4>
                        {task.status === "PUBLISHED" && (
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {task.client.name}
                        </Badge>
                        {scheduledTime && (
                          <span className="text-xs text-orange-600 font-semibold">
                            {scheduledTime}
                          </span>
                        )}
                      </div>
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

