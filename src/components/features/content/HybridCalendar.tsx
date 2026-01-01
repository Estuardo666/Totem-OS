"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface HybridCalendarProps {
  shoots: Array<{
    id: string;
    title: string;
    startTime: Date;
    client: {
      id: string;
      name: string;
    };
  }>;
  tasks: Array<{
    id: string;
    title: string;
    scheduledAt: Date | null;
    client: {
      id: string;
      name: string;
    };
  }>;
}

export function HybridCalendar({ shoots, tasks }: HybridCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Domingo
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 }); // Domingo
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Filtrar eventos del mes actual
  const filteredShoots = useMemo(() => {
    return shoots.filter((shoot) => {
      const shootDate = new Date(shoot.startTime);
      return shootDate >= monthStart && shootDate <= monthEnd;
    });
  }, [shoots, monthStart, monthEnd]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.scheduledAt) return false;
      const taskDate = new Date(task.scheduledAt);
      return taskDate >= monthStart && taskDate <= monthEnd;
    });
  }, [tasks, monthStart, monthEnd]);

  // Agrupar eventos por día
  const eventsByDay = useMemo(() => {
    const map = new Map<string, { shoots: typeof filteredShoots; tasks: typeof filteredTasks }>();

    filteredShoots.forEach((shoot) => {
      const dayKey = format(new Date(shoot.startTime), "yyyy-MM-dd");
      if (!map.has(dayKey)) {
        map.set(dayKey, { shoots: [], tasks: [] });
      }
      map.get(dayKey)!.shoots.push(shoot);
    });

    filteredTasks.forEach((task) => {
      if (!task.scheduledAt) return;
      const dayKey = format(new Date(task.scheduledAt), "yyyy-MM-dd");
      if (!map.has(dayKey)) {
        map.set(dayKey, { shoots: [], tasks: [] });
      }
      map.get(dayKey)!.tasks.push(task);
    });

    return map;
  }, [filteredShoots, filteredTasks]);

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePreviousMonth}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle>
            {format(currentMonth, "MMMM yyyy", { locale: es }).charAt(0).toUpperCase() +
              format(currentMonth, "MMMM yyyy", { locale: es }).slice(1)}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextMonth}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
        <div className="grid grid-cols-7 gap-2">
          {/* Días de la semana */}
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
              {day}
            </div>
          ))}

          {/* Días del calendario (incluye días vacíos) */}
          {days.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const events = eventsByDay.get(dayKey) || { shoots: [], tasks: [] };
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = day >= monthStart && day <= monthEnd;

            return (
              <div
                key={dayKey}
                className={`min-h-[80px] p-1 border rounded-md ${
                  isToday ? "bg-primary/10 border-primary" : ""
                } ${!isCurrentMonth ? "opacity-40" : ""}`}
              >
                <div className={`text-xs font-medium mb-1 ${!isCurrentMonth ? "text-muted-foreground" : ""}`}>
                  {format(day, "d")}
                </div>
                {isCurrentMonth && (
                  <div className="space-y-1">
                    {events.shoots.map((shoot) => {
                      const shootTime = format(new Date(shoot.startTime), "HH:mm", { locale: es });
                      return (
                        <Tooltip key={shoot.id}>
                          <TooltipTrigger asChild>
                            <div className="text-[10px] px-1 py-0.5 rounded bg-red-500/20 text-red-700 dark:text-red-400 truncate cursor-pointer">
                              🎥 {shoot.title}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>🎥 Rodaje {shoot.client.name} - {shootTime}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    {events.tasks.map((task) => (
                      <Tooltip key={task.id}>
                        <TooltipTrigger asChild>
                          <div className="text-[10px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-400 truncate cursor-pointer">
                            📋 {task.title}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{task.title} - [{task.client.name}]</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500/20" />
            <span>Rodajes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500/20" />
            <span>Entregas</span>
          </div>
        </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

