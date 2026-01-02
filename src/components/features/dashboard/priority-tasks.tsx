import { getTasks } from "@/actions/content-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { auth } from "@/auth";
import { format, isToday, isYesterday, differenceInHours, startOfDay, endOfDay, addDays } from "date-fns";
import Link from "next/link";

// Función para obtener el color de la fecha según urgencia
function getDateColor(date: Date | null): string {
  if (!date) return "text-muted-foreground";
  if (isToday(date)) return "text-red-600 font-semibold";
  if (isYesterday(date)) return "text-orange-600 font-semibold";
  const daysDiff = differenceInHours(date, new Date()) / 24;
  if (daysDiff < 3 && daysDiff >= 0) return "text-yellow-600";
  return "text-muted-foreground";
}

export async function PriorityTasks() {
  // Obtener sesión del usuario
  const session = await auth();
  const userId = session?.user?.id;

  // Obtener tareas
  const tasksResult = await getTasks();
  const allTasks = tasksResult.success ? tasksResult.data ?? [] : [];

  // Tareas prioritarias: no publicadas, con dueDate en los próximos 3 días
  // Incluye tareas asignadas al usuario Y tareas sin asignar (assignedToId === null)
  const startOfToday = startOfDay(new Date());
  const endOfTomorrow = endOfDay(addDays(startOfToday, 1)); // Incluir mañana
  const endOfNextThreeDays = endOfDay(addDays(startOfToday, 3));
  
  const urgentTasks = allTasks
    .filter((task) => {
      // Filtrar por usuario asignado como editor O community O sin asignar
      if (userId && task.assignedEditorId !== userId && task.assignedCommunityId !== userId) {
        return false;
      }
      // Filtrar por estado (no publicado)
      if (task.status === "PUBLISHED") return false;
      // Filtrar por fecha (dentro de los próximos 3 días)
      if (!task.dueDate) return false;
      const taskDueDate = new Date(task.dueDate);
      const taskDueDateStart = startOfDay(taskDueDate);
      return taskDueDateStart >= startOfToday && taskDueDateStart <= endOfNextThreeDays;
    })
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Tareas Prioritarias</CardTitle>
            <Badge variant="outline" className="text-xs">
              {urgentTasks.length} próximos 3 días
            </Badge>
          </div>
          <Link
            href="/content"
            className="text-sm text-primary hover:underline"
          >
            Ver todas
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {urgentTasks.length > 0 ? (
          <div className="space-y-3">
            {urgentTasks.map((task) => {
              // Calcular si la tarea vence en menos de 24 horas
              const now = new Date();
              const dueDate = task.dueDate ? new Date(task.dueDate) : null;
              const hoursUntilDue = dueDate
                ? differenceInHours(dueDate, now)
                : Infinity;
              const isUrgent = hoursUntilDue < 24 && hoursUntilDue >= 0;
              
              return (
                <div
                  key={task.id}
                  className={`flex items-start justify-between gap-3 p-3 rounded-lg border transition-colors ${
                    isUrgent
                      ? "border-rose-500 bg-rose-50/50 hover:bg-rose-100/50 animate-pulse"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`font-medium text-sm leading-tight ${
                        isUrgent ? "text-rose-700 font-semibold" : ""
                      }`}>
                        {task.title}
                      </h4>
                      {isUrgent && (
                        <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {task.client.name}
                      </Badge>
                      {task.dueDate && (
                        <span
                          className={`text-xs font-medium ${
                            isUrgent
                              ? "text-rose-600 font-semibold"
                              : getDateColor(new Date(task.dueDate))
                          }`}
                        >
                          {isToday(new Date(task.dueDate))
                            ? "Hoy"
                            : isYesterday(new Date(task.dueDate))
                              ? "Ayer"
                              : hoursUntilDue < 24 && hoursUntilDue >= 0
                                ? `Mañana (${Math.round(hoursUntilDue)}h)`
                                : format(new Date(task.dueDate), "dd/MM/yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className={`w-1 h-full rounded-full flex-shrink-0 ${
                      isUrgent ? "bg-rose-500" : ""
                    }`}
                    style={{
                      backgroundColor: isUrgent
                        ? undefined
                        : task.client.color || "#000000",
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">
              No hay tareas prioritarias esta semana
            </p>
            <p className="text-xs text-muted-foreground">
              ¡Todo al día! 🎉
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
