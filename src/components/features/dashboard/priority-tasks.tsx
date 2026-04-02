import { getTasks } from "@/actions/content-actions";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ListTodo } from "lucide-react";
import { auth } from "@/auth";
import { format, isToday, isYesterday, differenceInHours, startOfDay, endOfDay, addDays } from "date-fns";
import Link from "next/link";

const EDITOR_RESPONSIBLE_STATUSES = ["RECORDED", "EDITING", "REVIEW_CLIENT"] as const;
const COMMUNITY_RESPONSIBLE_STATUSES = ["IDEA", "SCRIPT", "CLIENT_APPROVED"] as const;

function isTaskRelevantForUser(input: {
  userId?: string;
  userRole?: string | null;
  specialty?: string | null;
  task: {
    status: string;
    assignedEditorId: string | null;
    assignedCommunityId: string | null;
  };
}): boolean {
  const { userId, userRole, specialty, task } = input;

  if (!userId) {
    return true;
  }

  const normalizedSpecialty = specialty?.toUpperCase() ?? null;
  const actsAsCommunity = normalizedSpecialty?.includes("COMMUNITY") ?? false;
  const actsAsEditor = normalizedSpecialty === "EDITOR" || (!normalizedSpecialty && userRole === "EDITOR");

  if (actsAsCommunity) {
    return task.assignedCommunityId === userId && COMMUNITY_RESPONSIBLE_STATUSES.includes(task.status as (typeof COMMUNITY_RESPONSIBLE_STATUSES)[number]);
  }

  if (actsAsEditor) {
    return task.assignedEditorId === userId && EDITOR_RESPONSIBLE_STATUSES.includes(task.status as (typeof EDITOR_RESPONSIBLE_STATUSES)[number]);
  }

  return task.assignedEditorId === userId || task.assignedCommunityId === userId;
}

// Función para obtener el color de la fecha según urgencia
function getDateColor(date: Date | null): string {
  if (!date) return "text-muted-foreground";
  if (date < startOfDay(new Date())) return "text-orange-600 font-semibold";
  if (isToday(date)) return "text-red-600 font-semibold";
  if (isYesterday(date)) return "text-orange-600 font-semibold";
  const daysDiff = differenceInHours(date, new Date()) / 24;
  if (daysDiff < 3 && daysDiff >= 0) return "text-yellow-600";
  return "text-muted-foreground";
}

export async function PriorityTasks() {
  const session = await auth();
  const userId = session?.user?.id;
  const userRole = session?.user?.roleLegacy ?? session?.user?.role ?? null;
  const specialty = session?.user?.specialty ?? null;

  const tasksResult = await getTasks();
  const allTasks = tasksResult.success ? tasksResult.data ?? [] : [];

  const startOfToday = startOfDay(new Date());
  const endOfNextThreeDays = endOfDay(addDays(startOfToday, 3));
  
  const urgentTasks = allTasks
    .filter((task) => {
      if (!isTaskRelevantForUser({
        userId,
        userRole,
        specialty,
        task,
      })) {
        return false;
      }

      if (task.status === "PUBLISHED") return false;

      if (!task.dueDate) return false;

      const taskDueDate = new Date(task.dueDate);
      const taskDueDateStart = startOfDay(taskDueDate);
      return taskDueDateStart <= endOfNextThreeDays;
    })
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;

      const aDate = new Date(a.dueDate);
      const bDate = new Date(b.dueDate);
      const aIsOverdue = startOfDay(aDate) < startOfToday;
      const bIsOverdue = startOfDay(bDate) < startOfToday;

      if (aIsOverdue && !bIsOverdue) return -1;
      if (!aIsOverdue && bIsOverdue) return 1;

      return aDate.getTime() - bDate.getTime();
    })
    .slice(0, 5);

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="p-5 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ListTodo className="h-5 w-5 text-foreground" />
            <div>
              <h3 className="font-semibold">Tareas Prioritarias</h3>
              <p className="text-xs text-muted-foreground">{urgentTasks.length} próximos 3 días</p>
            </div>
          </div>
          <Link
            href="/content"
            className="text-sm text-primary hover:underline font-medium"
          >
            Ver todas
          </Link>
        </div>
      </div>
      <div className="divide-y">
        {urgentTasks.length > 0 ? (
          urgentTasks.map((task) => {
            // Calcular si la tarea vence en menos de 24 horas
            const now = new Date();
            const dueDate = task.dueDate ? new Date(task.dueDate) : null;
            const isOverdue = dueDate ? startOfDay(dueDate) < startOfToday : false;
            const hoursUntilDue = dueDate
              ? differenceInHours(dueDate, now)
              : Infinity;
            const isUrgent = isOverdue || (hoursUntilDue < 24 && hoursUntilDue >= 0);
            
            return (
              <div
                key={task.id}
                className={`flex items-start justify-between gap-3 p-4 transition-colors ${
                  isUrgent
                    ? "bg-rose-50/50 dark:bg-rose-950/20"
                    : "hover:bg-muted/50"
                }`}
              >
                <div 
                  className="w-1 h-12 rounded-full flex-shrink-0"
                  style={{ backgroundColor: isUrgent ? "#f43f5e" : (task.client.color || "#6366f1") }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-medium text-sm leading-tight truncate ${
                      isUrgent ? "text-rose-700 dark:text-rose-400" : ""
                    }`}>
                      {task.title}
                    </h4>
                    {isUrgent && (
                      <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs rounded-lg">
                      {task.client.name}
                    </Badge>
                    {task.dueDate && (
                      <span
                        className={`text-xs font-medium ${
                          isUrgent
                            ? "text-rose-600 dark:text-rose-400"
                            : getDateColor(new Date(task.dueDate))
                        }`}
                      >
                        {isOverdue
                          ? "Atrasada"
                          : isToday(new Date(task.dueDate))
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
              </div>
            );
          })
        ) : (
          <div className="text-center py-10 px-4">
            <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <ListTodo className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-1">
              No hay tareas prioritarias
            </p>
            <p className="text-xs text-muted-foreground">
              ¡Todo al día! 🎉
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
