"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    endTime?: Date | null;
    address?: string | null;
    status?: string | null;
    mapLink?: string | null;
    scriptUrl?: string | null;
    notes?: string | null;
    crew?: Array<{ id: string; name: string; role?: string | null; image?: string | null }>;
    client: {
      id: string;
      name: string;
      logo?: string | null;
    };
  }>;
  tasks: Array<{
    id: string;
    title: string;
    scheduledAt: Date | null;
    dueDate?: Date | string | null;
    status?: string | null;
    type?: string | null;
    priority?: string | null;
    postCopy?: string | null;
    client: {
      id: string;
      name: string;
      logo?: string | null;
    };
    assignedEditor?: { id: string; name: string; image?: string | null } | null;
    assignedCommunity?: { id: string; name: string; image?: string | null } | null;
  }>;
}

const getInitials = (text: string) =>
  text
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const renderClientChip = (name: string, logo?: string | null) => (
  <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm text-foreground">
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs overflow-hidden">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={name} className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
    <span className="font-medium">{name}</span>
  </div>
);

const renderUserChip = (name: string, image?: string | null, label?: string) => (
  <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm text-foreground bg-card">
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted overflow-hidden text-xs font-semibold">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name} className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
    <div className="flex flex-col leading-tight">
      <span className="font-medium">{name}</span>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  </div>
);

const renderTaskBadges = (task: HybridCalendarProps["tasks"][number]) => {
  const status = task.status || undefined;
  const type = task.type || undefined;
  const priority = task.priority || undefined;

  const pill = (label: string, color: string) => (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color} bg-opacity-15`}>{label}</span>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {type && pill(type, "text-blue-600 bg-blue-100")}
      {status && pill(status, "text-emerald-700 bg-emerald-100")}
      {priority && pill(priority, "text-amber-700 bg-amber-100")}
    </div>
  );
};

export function HybridCalendar({ shoots, tasks }: HybridCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filter, setFilter] = useState<"all" | "shoots" | "tasks">("all");
  const [selectedTask, setSelectedTask] = useState<HybridCalendarProps["tasks"][number] | null>(null);
  const [selectedShoot, setSelectedShoot] = useState<HybridCalendarProps["shoots"][number] | null>(null);

  const filterOptions: { key: "all" | "shoots" | "tasks"; label: string }[] = [
    { key: "all", label: "Todo" },
    { key: "tasks", label: "Solo tareas" },
    { key: "shoots", label: "Solo rodajes" },
  ];

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Domingo
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 }); // Domingo
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Filtrar eventos del mes actual según filtro
  const filteredShoots = useMemo(() => {
    if (filter === "tasks") return [];
    return shoots.filter((shoot) => {
      const shootDate = new Date(shoot.startTime);
      return shootDate >= monthStart && shootDate <= monthEnd;
    });
  }, [shoots, monthStart, monthEnd, filter]);

  const filteredTasks = useMemo(() => {
    if (filter === "shoots") return [];
    return tasks.filter((task) => {
      if (!task.scheduledAt) return false;
      const taskDate = new Date(task.scheduledAt);
      return taskDate >= monthStart && taskDate <= monthEnd;
    });
  }, [tasks, monthStart, monthEnd, filter]);

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

  const formatDayAndTime = (date: Date | string | null | undefined) => {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) return "";
    const day = format(d, "dd/MM/yyyy", { locale: es });
    const time = format(d, "HH:mm", { locale: es });
    return `${day} · ${time}`;
  };

  return (
    <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
      <div className="pb-3 p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePreviousMonth}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-2xl md:text-3xl font-semibold text-center flex-1">
              {format(currentMonth, "MMMM yyyy", { locale: es }).charAt(0).toUpperCase() +
                format(currentMonth, "MMMM yyyy", { locale: es }).slice(1)}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {filterOptions.map((option) => (
              <Button
                key={option.key}
                variant={filter === option.key ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(option.key)}
                className="px-4 rounded-full"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div className="pt-2 px-6 pb-6 flex-1">
        <TooltipProvider>
        <div className="grid grid-cols-7 gap-3 text-base">
          {/* Días de la semana */}
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => (
            <div key={day} className="text-center text-sm md:text-base font-semibold text-muted-foreground p-2">
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
                className={`min-h-[110px] p-2 border rounded-lg ${
                  isToday ? "bg-primary/10 border-primary" : ""
                } ${!isCurrentMonth ? "opacity-40" : ""}`}
              >
                <div className={`text-sm font-semibold mb-2 ${!isCurrentMonth ? "text-muted-foreground" : ""}`}>
                  {format(day, "d")}
                </div>
                {isCurrentMonth && (
                  <div className="space-y-1.5">
                    {events.shoots.map((shoot) => {
                      const shootTime = format(new Date(shoot.startTime), "HH:mm", { locale: es });
                      return (
                        <Tooltip key={shoot.id}>
                          <TooltipTrigger asChild>
                            <div
                              className="text-[11px] px-1.5 py-1 rounded-md bg-red-500/20 text-red-700 dark:text-red-400 truncate cursor-pointer hover:bg-red-500/30"
                              onClick={() => setSelectedShoot(shoot)}
                            >
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
                          <div
                            className="text-[11px] px-1.5 py-1 rounded-md bg-blue-500/20 text-blue-700 dark:text-blue-400 truncate cursor-pointer hover:bg-blue-500/30"
                            onClick={() => setSelectedTask(task)}
                          >
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
        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
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
      </div>

      {/* Dialogo para Rodajes */}
      <Dialog open={!!selectedShoot} onOpenChange={(open) => !open && setSelectedShoot(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-2xl font-bold flex items-start gap-3">
              <span className="mt-1 text-lg">🎥</span>
              <div className="space-y-1">
                <span>{selectedShoot?.title}</span>
                {selectedShoot && (
                  <p className="text-sm font-normal text-muted-foreground">{formatDayAndTime(selectedShoot.startTime)}</p>
                )}
              </div>
            </DialogTitle>
            {selectedShoot && (
              <div className="flex flex-wrap gap-2 items-center text-sm">
                {renderClientChip(selectedShoot.client.name, selectedShoot.client.logo)}
                {selectedShoot.status && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                    {selectedShoot.status}
                  </span>
                )}
              </div>
            )}
          </DialogHeader>

          {selectedShoot && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Fecha y hora</span>
                <span className="text-base font-semibold">{formatDayAndTime(selectedShoot.startTime)}</span>
              </div>
              {selectedShoot.endTime && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Termina</span>
                  <span className="text-base font-semibold">{formatDayAndTime(selectedShoot.endTime)}</span>
                </div>
              )}
              {selectedShoot.address && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Ubicación</span>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold">{selectedShoot.address}</span>
                    {selectedShoot.mapLink && (
                      <a
                        href={selectedShoot.mapLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary underline"
                      >
                        Ver mapa
                      </a>
                    )}
                  </div>
                </div>
              )}
              {selectedShoot.notes && (
                <div className="flex flex-col gap-2 bg-muted/60 rounded-xl p-3 border border-border/50">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Notas</span>
                  <p className="leading-relaxed text-foreground whitespace-pre-wrap">{selectedShoot.notes}</p>
                </div>
              )}
              {selectedShoot.scriptUrl && (
                <a
                  href={selectedShoot.scriptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline"
                >
                  📄 Ver guion / brief
                </a>
              )}
              {selectedShoot.crew && selectedShoot.crew.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Equipo</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedShoot.crew.map((member) => (
                      <div key={member.id} className="rounded-lg border border-border px-3 py-2 flex items-center gap-2 bg-card">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted overflow-hidden text-xs font-semibold">
                          {member.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={member.image} alt={member.name} className="h-full w-full object-cover" />
                          ) : (
                            getInitials(member.name)
                          )}
                        </span>
                        <div className="flex flex-col leading-tight">
                          <span className="font-semibold text-sm">{member.name}</span>
                          {member.role && <span className="text-xs text-muted-foreground">{member.role}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialogo para Tareas */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-2xl font-bold flex items-start gap-3">
              <span className="mt-1 text-lg">📋</span>
              <div className="space-y-1">
                <span>{selectedTask?.title}</span>
                {selectedTask && (
                  <p className="text-sm font-normal text-muted-foreground">{formatDayAndTime(selectedTask.scheduledAt)}</p>
                )}
              </div>
            </DialogTitle>
            {selectedTask && (
              <div className="flex flex-wrap gap-2 items-center text-sm">
                {renderClientChip(selectedTask.client.name, selectedTask.client.logo)}
                {renderTaskBadges(selectedTask)}
              </div>
            )}
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Programada</span>
                  <span className="text-base font-semibold">{formatDayAndTime(selectedTask.scheduledAt)}</span>
                </div>
                {selectedTask.dueDate && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Entrega</span>
                    <span className="text-base font-semibold">{formatDayAndTime(selectedTask.dueDate)}</span>
                  </div>
                )}
              </div>
              {(selectedTask.assignedEditor || selectedTask.assignedCommunity) && (
                <div className="flex flex-wrap gap-2">
                  {selectedTask.assignedEditor && renderUserChip(selectedTask.assignedEditor.name, selectedTask.assignedEditor.image, "Editor")}
                  {selectedTask.assignedCommunity && renderUserChip(selectedTask.assignedCommunity.name, selectedTask.assignedCommunity.image, "Community")}
                </div>
              )}
              {(selectedTask as any).postCopy && (
                <div className="flex flex-col gap-2 bg-muted/60 rounded-xl p-3 border border-border/50">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Copy</span>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap text-sm">{(selectedTask as any).postCopy}</p>
                </div>
              )}
              {(selectedTask as any).status && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Estado</span>
                  <span className="text-base font-semibold">{(selectedTask as any).status}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

