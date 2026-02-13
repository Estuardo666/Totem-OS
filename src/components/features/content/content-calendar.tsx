"use client";

import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Video, Image as ImageIconLucide, Camera, CheckCircle2 } from "lucide-react";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskSheet } from "./task-sheet";
import type { User } from "@prisma/client";

interface ContentCalendarProps {
  tasks: ContentTaskWithClient[];
  users: User[];
  clients: Array<{ id: string; name: string; logo?: string | null; color?: string | null }>;
}

// Colores por tipo de contenido
const getTypeColor = (type: string): string => {
  switch (type) {
    case "REEL":
      return "bg-blue-500 hover:bg-blue-600";
    case "FLYER":
      return "bg-orange-500 hover:bg-orange-600";
    case "STORY":
      return "bg-purple-500 hover:bg-purple-600";
    default:
      return "bg-gray-500 hover:bg-gray-600";
  }
};

// Icono por tipo
const getTypeIcon = (type: string) => {
  switch (type) {
    case "REEL":
      return <Video className="h-3 w-3" />;
    case "FLYER":
      return <ImageIconLucide className="h-3 w-3" />;
    case "STORY":
      return <Camera className="h-3 w-3" />;
    default:
      return null;
  }
};

// Etiqueta por tipo
const getTypeLabel = (type: string): string => {
  switch (type) {
    case "REEL":
      return "Reel";
    case "FLYER":
      return "Flyer";
    case "STORY":
      return "Story";
    default:
      return type;
  }
};

export function ContentCalendar({ tasks, users, clients }: ContentCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<ContentTaskWithClient | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [newTaskDate, setNewTaskDate] = useState<Date | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Obtener el primer día del mes y el último día
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Lunes
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 }); // Domingo

  // Generar todos los días del calendario
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  // Filtrar tareas que tienen scheduledAt
  const tasksWithSchedule = tasks.filter(
    (task) => task.scheduledAt && new Date(task.scheduledAt) instanceof Date
  );

  // Obtener tareas para un día específico
  const getTasksForDay = (day: Date): ContentTaskWithClient[] => {
    return tasksWithSchedule.filter((task) => {
      if (!task.scheduledAt) return false;
      const taskDate = new Date(task.scheduledAt);
      return isSameDay(taskDate, day);
    });
  };

  // Manejar click en un día (crear nueva tarea)
  const handleDayClick = (day: Date) => {
    setNewTaskDate(day);
    setSelectedTask(null);
    setIsSheetOpen(true);
  };

  // Manejar click en una tarea (editar)
  const handleTaskClick = (task: ContentTaskWithClient, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTask(task);
    setIsSheetOpen(true);
  };

  const toggleExpandDay = (day: Date) => {
    const dayKey = format(day, "yyyy-MM-dd");
    const newExpandedDays = new Set(expandedDays);
    if (newExpandedDays.has(dayKey)) {
      newExpandedDays.delete(dayKey);
    } else {
      newExpandedDays.add(dayKey);
    }
    setExpandedDays(newExpandedDays);
  };

  // Navegación de meses
  const goToPreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  // Días de la semana en español
  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="space-y-4">
      {/* Header del calendario */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPreviousMonth}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold min-w-[200px] text-center">
            {format(currentDate, "MMMM yyyy", { locale: es })}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={() => setCurrentDate(new Date())}
          className="text-sm"
        >
          Hoy
        </Button>
      </div>

      {/* Grid del calendario */}
      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 gap-px bg-border">
            {/* Encabezados de días de la semana */}
            {weekDays.map((day) => (
              <div
                key={day}
                className="bg-muted/50 p-2 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}

            {/* Días del mes */}
            {calendarDays.map((day, dayIdx) => {
              const dayTasks = getTasksForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={dayIdx}
                  className={`min-h-[100px] bg-background p-1 ${
                    !isCurrentMonth ? "opacity-40" : ""
                  } ${isCurrentDay ? "bg-muted/30" : ""} cursor-pointer hover:bg-muted/50 transition-colors`}
                  onClick={() => handleDayClick(day)}
                >
                  <div
                    className={`text-sm font-medium mb-1 ${
                      isCurrentDay
                        ? "text-primary font-bold"
                        : isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {(() => {
                      const dayKey = format(day, "yyyy-MM-dd");
                      const isExpanded = expandedDays.has(dayKey);
                      const tasksToShow = isExpanded ? dayTasks : dayTasks.slice(0, 3);

                      return (
                        <>
                          {tasksToShow.map((task, idx) => (
                            <div
                              key={task.id}
                              onClick={(e) => handleTaskClick(task, e)}
                              className={`${getTypeColor(
                                task.type
                              )} text-white text-xs p-1.5 rounded cursor-pointer flex items-center gap-1.5 shadow-sm transition-all duration-300 opacity-100 animate-in fade-in slide-in-from-top-1`}
                              style={{
                                animationDelay: `${idx * 50}ms`,
                              }}
                            >
                              {getTypeIcon(task.type)}
                              <span className="truncate flex-1 font-medium">
                                {task.client.name}
                              </span>
                              {task.status === "CLIENT_APPROVED" && (
                                <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                              )}
                            </div>
                          ))}
                          {dayTasks.length > 3 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandDay(day);
                              }}
                              className="text-xs text-primary hover:text-primary/80 font-medium text-center w-full py-1 hover:underline transition-all duration-300"
                            >
                              {isExpanded
                                ? "▲ Mostrar menos"
                                : `+${dayTasks.length - 3} más`}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-blue-500" />
          <span>Reel</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-orange-500" />
          <span>Flyer</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-purple-500" />
          <span>Story</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Aprobado por Cliente</span>
        </div>
      </div>

      {/* TaskSheet para crear/editar */}
      <TaskSheet
        task={selectedTask}
        open={isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) {
            setSelectedTask(null);
            setNewTaskDate(null);
          }
        }}
        users={users}
        clients={clients}
        initialScheduledAt={newTaskDate ? newTaskDate.toISOString() : undefined}
      />
    </div>
  );
}

