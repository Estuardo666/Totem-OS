"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format, startOfDay, endOfDay } from "date-fns";
import { Calendar, CheckCircle2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import { updateTaskStatusRequest } from "@/lib/content-task-status-client";
import type { ContentTaskStatus } from "@/types";

interface TodayScheduledTasksProps {
  tasks: ContentTaskWithClient[];
}

export function TodayScheduledTasks({ tasks: initialTasks }: TodayScheduledTasksProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [tasks, setTasks] = useState(initialTasks);
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set());
  const [pendingConfirmationTaskId, setPendingConfirmationTaskId] = useState<string | null>(null);

  const normalizedSpecialty = session?.user?.specialty?.toUpperCase() ?? "";
  const normalizedName = session?.user?.name?.toUpperCase() ?? "";
  const normalizedEmail = session?.user?.email?.toUpperCase() ?? "";
  const isDanielaCommunityEditor =
    session?.user?.role === "EDITOR" &&
    normalizedSpecialty.includes("COMMUNITY") &&
    (normalizedName.includes("DANIELA") || normalizedEmail.includes("DANIELA"));

  // Filtrar tareas programadas para hoy
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const scheduledToday = tasks.filter((task) => {
    if (!task.scheduledAt) return false;
    const scheduledDate = new Date(task.scheduledAt);
    return scheduledDate >= todayStart && scheduledDate <= todayEnd && task.status !== "PUBLISHED";
  });

  const handleTaskStatusAction = async (taskId: string) => {
    setUpdatingTasks((prev) => new Set(prev).add(taskId));

    const targetStatus: ContentTaskStatus = isDanielaCommunityEditor ? "SCRIPT" : "PUBLISHED";
    const successTitle = isDanielaCommunityEditor ? "Pasó a guión" : "¡Publicado!";
    const successDescription = isDanielaCommunityEditor
      ? "La tarea fue enviada a guión y su fecha se reinició."
      : "La tarea ha sido marcada como publicada.";
    const errorDescription = isDanielaCommunityEditor
      ? "No se pudo mover la tarea a guión"
      : "No se pudo marcar como publicada";

    try {
      const result = await updateTaskStatusRequest(taskId, targetStatus);

      if (result.success) {
        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status: targetStatus,
                  ...(targetStatus === "SCRIPT"
                    ? {
                        scheduledAt: null,
                        dueDate: null,
                        publishedAt: null,
                      }
                    : {
                        publishedAt: new Date(),
                      }),
                }
              : task
          )
        );

        window.dispatchEvent(
          new CustomEvent("taskStatusUpdated", {
            detail: { taskId, newStatus: targetStatus },
          })
        );

        router.refresh();

        toast({
          title: successTitle,
          description: successDescription,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || errorDescription,
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

  const pendingTask = pendingConfirmationTaskId
    ? tasks.find((task) => task.id === pendingConfirmationTaskId) ?? null
    : null;
  const pendingTargetStatus: ContentTaskStatus = isDanielaCommunityEditor ? "SCRIPT" : "PUBLISHED";
  const confirmationTitle = isDanielaCommunityEditor
    ? "¿Pasar tarea a guión?"
    : "¿Marcar tarea como publicada?";
  const confirmationDescription = pendingTask
    ? isDanielaCommunityEditor
      ? `La tarea \"${pendingTask.title}\" pasará a guión y se reiniciará su fecha para que Daniela pueda trabajar el copy.`
      : `La tarea \"${pendingTask.title}\" se marcará como publicada.`
    : "";
  const confirmationActionLabel = isDanielaCommunityEditor ? "Pasar a guión" : "Publicar";

  if (scheduledToday.length === 0) {
    return null;
  }

  return (
    <>
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
                          if (task.status !== "PUBLISHED" && !isUpdating) {
                            setPendingConfirmationTaskId(task.id);
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

      <AlertDialog
        open={pendingConfirmationTaskId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingConfirmationTaskId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmationDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingTask ? updatingTasks.has(pendingTask.id) : false}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();

                if (!pendingTask) {
                  setPendingConfirmationTaskId(null);
                  return;
                }

                void handleTaskStatusAction(pendingTask.id).then(() => {
                  setPendingConfirmationTaskId(null);
                });
              }}
              disabled={pendingTask ? updatingTasks.has(pendingTask.id) : false}
            >
              {pendingTask && updatingTasks.has(pendingTask.id)
                ? pendingTargetStatus === "SCRIPT"
                  ? "Pasando..."
                  : "Publicando..."
                : confirmationActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

