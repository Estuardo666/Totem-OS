"use client";

import { useState, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  setHours,
  setMinutes,
  getHours,
  getMinutes,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ShootWithRelations } from "@/lib/shooting-service";

export type CalendarViewType = "day" | "week" | "month" | "agenda";

interface ShootsCalendarProps {
  shootings: ShootWithRelations[];
  onShootingClick: (shooting: ShootWithRelations) => void;
  onCreateClick: (date: Date, startTime?: string, endTime?: string) => void;
}

// Constants
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const VIEW_LABELS: Record<CalendarViewType, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
  agenda: "Agenda",
};
const VIEW_SHORTCUTS: Record<CalendarViewType, string> = {
  day: "D",
  week: "W",
  month: "M",
  agenda: "A",
};

export function ShootsCalendar({
  shootings,
  onShootingClick,
  onCreateClick,
}: ShootsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("month");

  // Navigation handlers
  const goToToday = () => setCurrentDate(new Date());

  const goToPrevious = () => {
    switch (view) {
      case "day":
        setCurrentDate(subDays(currentDate, 1));
        break;
      case "week":
        setCurrentDate(subWeeks(currentDate, 1));
        break;
      case "month":
        setCurrentDate(subMonths(currentDate, 1));
        break;
      case "agenda":
        setCurrentDate(subMonths(currentDate, 1));
        break;
    }
  };

  const goToNext = () => {
    switch (view) {
      case "day":
        setCurrentDate(addDays(currentDate, 1));
        break;
      case "week":
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case "month":
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case "agenda":
        setCurrentDate(addMonths(currentDate, 1));
        break;
    }
  };

  // Format title based on view
  const getTitle = () => {
    switch (view) {
      case "day":
        return format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: es });
      case "week": {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        const startMonth = format(weekStart, "MMM", { locale: es });
        const endMonth = format(weekEnd, "MMM", { locale: es });
        const startYear = format(weekStart, "yyyy");
        const endYear = format(weekEnd, "yyyy");
        if (startMonth === endMonth) {
          return `${startMonth} de ${startYear}`;
        }
        if (startYear === endYear) {
          return `${startMonth} – ${endMonth} de ${startYear}`;
        }
        return `${startMonth} ${startYear} – ${endMonth} ${endYear}`;
      }
      case "month":
        return format(currentDate, "MMMM 'de' yyyy", { locale: es });
      case "agenda":
        return format(currentDate, "MMMM 'de' yyyy", { locale: es });
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-background">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="rounded-full px-4"
            >
              Hoy
            </Button>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrevious}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNext}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <h2 className="text-lg font-semibold ml-2 capitalize">
              {getTitle()}
            </h2>
          </div>

          {/* View Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full px-4">
                {VIEW_LABELS[view]} ▾
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {(Object.keys(VIEW_LABELS) as CalendarViewType[]).map((v) => (
                <DropdownMenuItem
                  key={v}
                  onClick={() => setView(v)}
                  className="flex justify-between"
                >
                  <span>{VIEW_LABELS[v]}</span>
                  <span className="text-muted-foreground text-xs">
                    {VIEW_SHORTCUTS[v]}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Calendar Views */}
        {view === "month" && (
          <MonthView
            currentDate={currentDate}
            shootings={shootings}
            onShootingClick={onShootingClick}
            onDayClick={onCreateClick}
          />
        )}
        {view === "week" && (
          <WeekView
            currentDate={currentDate}
            shootings={shootings}
            onShootingClick={onShootingClick}
            onCellClick={onCreateClick}
          />
        )}
        {view === "day" && (
          <DayView
            currentDate={currentDate}
            shootings={shootings}
            onShootingClick={onShootingClick}
            onCellClick={onCreateClick}
          />
        )}
        {view === "agenda" && (
          <AgendaView
            currentDate={currentDate}
            shootings={shootings}
            onShootingClick={onShootingClick}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ==================== MONTH VIEW ====================
interface MonthViewProps {
  currentDate: Date;
  shootings: ShootWithRelations[];
  onShootingClick: (shooting: ShootWithRelations) => void;
  onDayClick: (date: Date) => void;
}

function MonthView({
  currentDate,
  shootings,
  onShootingClick,
  onDayClick,
}: MonthViewProps) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const getShootingsForDay = (day: Date) =>
    shootings.filter((s) => isSameDay(new Date(s.startTime), day));

  const handleDayClick = (day: Date, e: React.MouseEvent) => {
    // Only trigger if clicking on empty space, not on a shooting
    if ((e.target as HTMLElement).closest(".shooting-item")) return;
    // Set default time to 9:00 AM
    const dateWithTime = setMinutes(setHours(day, 9), 0);
    onDayClick(dateWithTime);
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

  return (
    <div className="p-4">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const dayShootings = getShootingsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={day.toISOString()}
              onClick={(e) => handleDayClick(day, e)}
              className={`min-h-[100px] border rounded-lg p-1 cursor-pointer transition-colors hover:bg-accent/50 ${
                isCurrentMonth ? "bg-background" : "bg-muted/30"
              }`}
            >
              <div
                className={`text-sm mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : isCurrentMonth
                    ? ""
                    : "text-muted-foreground"
                }`}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-1">
                {(() => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  const isExpanded = expandedDays.has(dayKey);
                  const shootingsToShow = isExpanded ? dayShootings : dayShootings.slice(0, 3);

                  return (
                    <>
                      {shootingsToShow.map((shooting, idx) => (
                        <div
                          key={shooting.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onShootingClick(shooting);
                          }}
                          className="shooting-item text-xs p-1 rounded bg-primary text-primary-foreground cursor-pointer hover:opacity-80 truncate transition-all duration-300 opacity-100 animate-in fade-in slide-in-from-top-1"
                          style={{
                            animationDelay: `${idx * 50}ms`,
                          }}
                          title={shooting.title}
                        >
                          <span className="font-medium">
                            {format(new Date(shooting.startTime), "HH:mm")}
                          </span>{" "}
                          {shooting.title}
                        </div>
                      ))}
                      {dayShootings.length > 3 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpandDay(day);
                          }}
                          className="text-xs text-primary hover:text-primary/80 font-medium pl-1 hover:underline transition-all duration-300"
                        >
                          {isExpanded
                            ? "▲ Mostrar menos"
                            : `+${dayShootings.length - 3} más`}
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
    </div>
  );
}

// ==================== WEEK VIEW ====================
interface WeekViewProps {
  currentDate: Date;
  shootings: ShootWithRelations[];
  onShootingClick: (shooting: ShootWithRelations) => void;
  onCellClick: (date: Date, startTime: string, endTime: string) => void;
}

function WeekView({
  currentDate,
  shootings,
  onShootingClick,
  onCellClick,
}: WeekViewProps) {
  const [hoveredCell, setHoveredCell] = useState<{ day: string; hour: number } | null>(null);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  });

  const getShootingsForDay = (day: Date) =>
    shootings.filter((s) => isSameDay(new Date(s.startTime), day));

  const handleCellClick = (day: Date, hour: number) => {
    const startTime = `${hour.toString().padStart(2, "0")}:00`;
    const endTime = `${(hour + 1).toString().padStart(2, "0")}:00`;
    const dateWithTime = setMinutes(setHours(day, hour), 0);
    onCellClick(dateWithTime, startTime, endTime);
  };

  // Calculate shooting position and height
  const getShootingStyle = (shooting: ShootWithRelations) => {
    const start = new Date(shooting.startTime);
    const end = new Date(shooting.endTime);
    const startHour = getHours(start) + getMinutes(start) / 60;
    const endHour = getHours(end) + getMinutes(end) / 60;
    const top = startHour * 48; // 48px per hour
    const height = Math.max((endHour - startHour) * 48, 20);
    return { top, height };
  };

  return (
    <div className="flex flex-col max-h-[600px]">
      {/* Header with days */}
      <div className="flex border-b sticky top-0 bg-background z-10">
        <div className="w-16 flex-shrink-0 border-r" /> {/* Time column spacer */}
        {weekDays.map((day, index) => {
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              className={`flex-1 text-center py-2 ${index < weekDays.length - 1 ? "border-r" : ""}`}
            >
              <div className="text-xs text-muted-foreground uppercase">
                {format(day, "EEE", { locale: es })}
              </div>
              <div
                className={`text-lg font-semibold w-10 h-10 mx-auto flex items-center justify-center rounded-full ${
                  isToday ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex overflow-y-auto">
        {/* Time column */}
        <div className="w-16 flex-shrink-0 border-r">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="h-12 relative border-b"
            >
              <span className={`absolute -top-2 right-2 text-xs transition-colors ${
                hoveredCell?.hour === hour ? "text-primary font-medium" : "text-muted-foreground"
              }`}>
                {hour.toString().padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDays.map((day, dayIndex) => {
          const dayShootings = getShootingsForDay(day);
          const dayKey = day.toISOString();
          return (
            <div key={dayKey} className={`flex-1 relative ${dayIndex < weekDays.length - 1 ? "border-r" : ""}`}>
              {/* Hour cells */}
              {HOURS.map((hour) => {
                const isHovered = hoveredCell?.day === dayKey && hoveredCell?.hour === hour;
                return (
                  <div
                    key={hour}
                    onClick={() => handleCellClick(day, hour)}
                    onMouseEnter={() => setHoveredCell({ day: dayKey, hour })}
                    onMouseLeave={() => setHoveredCell(null)}
                    className={`h-12 border-b cursor-pointer transition-colors ${
                      isHovered ? "bg-accent/50" : "hover:bg-accent/30"
                    }`}
                  />
                );
              })}

              {/* Shootings overlay */}
              {dayShootings.map((shooting) => {
                const style = getShootingStyle(shooting);
                return (
                  <div
                    key={shooting.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onShootingClick(shooting);
                    }}
                    className="absolute left-0.5 right-0.5 bg-primary text-primary-foreground rounded px-1 py-0.5 text-xs cursor-pointer hover:opacity-80 overflow-hidden"
                    style={{
                      top: `${style.top}px`,
                      height: `${style.height}px`,
                    }}
                  >
                    <div className="font-medium truncate">{shooting.title}</div>
                    <div className="text-[10px] opacity-80 truncate">
                      {format(new Date(shooting.startTime), "HH:mm")} -{" "}
                      {format(new Date(shooting.endTime), "HH:mm")}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== DAY VIEW ====================
interface DayViewProps {
  currentDate: Date;
  shootings: ShootWithRelations[];
  onShootingClick: (shooting: ShootWithRelations) => void;
  onCellClick: (date: Date, startTime: string, endTime: string) => void;
}

function DayView({
  currentDate,
  shootings,
  onShootingClick,
  onCellClick,
}: DayViewProps) {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const dayShootings = shootings.filter((s) =>
    isSameDay(new Date(s.startTime), currentDate)
  );
  const isToday = isSameDay(currentDate, new Date());

  const handleCellClick = (hour: number) => {
    const startTime = `${hour.toString().padStart(2, "0")}:00`;
    const endTime = `${(hour + 1).toString().padStart(2, "0")}:00`;
    const dateWithTime = setMinutes(setHours(currentDate, hour), 0);
    onCellClick(dateWithTime, startTime, endTime);
  };

  const getShootingStyle = (shooting: ShootWithRelations) => {
    const start = new Date(shooting.startTime);
    const end = new Date(shooting.endTime);
    const startHour = getHours(start) + getMinutes(start) / 60;
    const endHour = getHours(end) + getMinutes(end) / 60;
    const top = startHour * 48;
    const height = Math.max((endHour - startHour) * 48, 20);
    return { top, height };
  };

  return (
    <div className="flex flex-col max-h-[600px]">
      {/* Header */}
      <div className="flex border-b sticky top-0 bg-background z-10">
        <div className="w-16 flex-shrink-0 border-r" />
        <div className="flex-1 text-center py-2">
          <div className="text-xs text-muted-foreground uppercase">
            {format(currentDate, "EEEE", { locale: es })}
          </div>
          <div
            className={`text-2xl font-semibold w-12 h-12 mx-auto flex items-center justify-center rounded-full ${
              isToday ? "bg-primary text-primary-foreground" : ""
            }`}
          >
            {format(currentDate, "d")}
          </div>
        </div>
      </div>

      {/* Time grid */}
      <div className="flex overflow-y-auto">
        {/* Time column */}
        <div className="w-16 flex-shrink-0 border-r">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="h-12 relative border-b"
            >
              <span className={`absolute -top-2 right-2 text-xs transition-colors ${
                hoveredHour === hour ? "text-primary font-medium" : "text-muted-foreground"
              }`}>
                {hour.toString().padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>

        {/* Day column */}
        <div className="flex-1 relative">
          {/* Hour cells */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              onClick={() => handleCellClick(hour)}
              onMouseEnter={() => setHoveredHour(hour)}
              onMouseLeave={() => setHoveredHour(null)}
              className={`h-12 border-b cursor-pointer transition-colors ${
                hoveredHour === hour ? "bg-accent/50" : "hover:bg-accent/30"
              }`}
            />
          ))}

          {/* Shootings overlay */}
          {dayShootings.map((shooting) => {
            const style = getShootingStyle(shooting);
            return (
              <div
                key={shooting.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onShootingClick(shooting);
                }}
                className="absolute left-1 right-1 bg-primary text-primary-foreground rounded px-2 py-1 text-sm cursor-pointer hover:opacity-80 overflow-hidden"
                style={{
                  top: `${style.top}px`,
                  height: `${style.height}px`,
                }}
              >
                <div className="font-medium">{shooting.title}</div>
                <div className="text-xs opacity-80 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(shooting.startTime), "HH:mm")} -{" "}
                  {format(new Date(shooting.endTime), "HH:mm")}
                </div>
                {shooting.address && (
                  <div className="text-xs opacity-80 flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    {shooting.address}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==================== AGENDA VIEW ====================
interface AgendaViewProps {
  currentDate: Date;
  shootings: ShootWithRelations[];
  onShootingClick: (shooting: ShootWithRelations) => void;
}

function AgendaView({
  currentDate,
  shootings,
  onShootingClick,
}: AgendaViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Filter shootings for current month and sort by date
  const monthShootings = useMemo(() => {
    return shootings
      .filter((s) => {
        const date = new Date(s.startTime);
        return date >= monthStart && date <= monthEnd;
      })
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
  }, [shootings, monthStart, monthEnd]);

  // Group by date
  const groupedShootings = useMemo(() => {
    const groups: Record<string, ShootWithRelations[]> = {};
    monthShootings.forEach((shooting) => {
      const dateKey = format(new Date(shooting.startTime), "yyyy-MM-dd");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(shooting);
    });
    return groups;
  }, [monthShootings]);

  if (monthShootings.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No hay rodajes programados para este mes
      </div>
    );
  }

  return (
    <div className="divide-y max-h-[600px] overflow-y-auto">
      {Object.entries(groupedShootings).map(([dateKey, dayShoots]) => {
        const date = new Date(dateKey);
        const isToday = isSameDay(date, new Date());
        return (
          <div key={dateKey} className="flex">
            {/* Date column */}
            <div
              className={`w-24 flex-shrink-0 p-4 text-center border-r ${
                isToday ? "bg-primary/10" : ""
              }`}
            >
              <div className="text-xs text-muted-foreground uppercase">
                {format(date, "EEE", { locale: es })}
              </div>
              <div
                className={`text-2xl font-semibold ${
                  isToday ? "text-primary" : ""
                }`}
              >
                {format(date, "d")}
              </div>
              <div className="text-xs text-muted-foreground">
                {format(date, "MMM", { locale: es })}
              </div>
            </div>

            {/* Shootings column */}
            <div className="flex-1 p-2 space-y-2">
              {dayShoots.map((shooting) => (
                <div
                  key={shooting.id}
                  onClick={() => onShootingClick(shooting)}
                  className="p-3 rounded-lg bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {shooting.title}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(shooting.startTime), "HH:mm")} -{" "}
                        {format(new Date(shooting.endTime), "HH:mm")}
                      </div>
                      {shooting.address && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          {shooting.address}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {shooting.client.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
