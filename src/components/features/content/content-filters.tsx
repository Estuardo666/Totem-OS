"use client";

import { useState, useMemo, useEffect } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useSession } from "next-auth/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import type { Client, User } from "@prisma/client";

interface ContentFiltersProps {
  tasks: ContentTaskWithClient[];
  clients: Client[];
  users: User[];
  onFilterChange: (filteredTasks: ContentTaskWithClient[]) => void;
  onClientChange?: (clientId: string) => void;
  currentUserId?: string;
  defaultView?: "my-tasks" | "all";
}

export function ContentFilters({
  tasks,
  clients,
  users,
  onFilterChange,
  onClientChange,
  currentUserId,
  defaultView = "all",
}: ContentFiltersProps) {
  const { data: session } = useSession();
  const userId = currentUserId || session?.user?.id;
  const userRole = session?.user?.role;
  
  // Por defecto, si es EDITOR o VIEWER, mostrar solo sus tareas
  const [viewMode, setViewMode] = useState<"my-tasks" | "all">(
    defaultView || (userRole === "EDITOR" || userRole === "VIEWER" ? "my-tasks" : "all")
  );
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  // Obtener meses únicos de las tareas
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    tasks.forEach((task) => {
      if (task.dueDate) {
        const date = new Date(task.dueDate);
        const monthKey = format(date, "yyyy-MM");
        months.add(monthKey);
      }
    });
    return Array.from(months).sort().reverse(); // Más recientes primero
  }, [tasks]);

  // Filtrar tareas cuando cambian los filtros
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Filtro principal: "Mis Tareas" vs "Todo el Equipo"
    if (viewMode === "my-tasks" && userId) {
      filtered = filtered.filter((task) => task.assignedEditorId === userId);
    }

    // Filtrar por cliente
    if (selectedClientId !== "all") {
      filtered = filtered.filter((task) => task.clientId === selectedClientId);
    }

    // Filtrar por mes
    if (selectedMonth !== "all") {
      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));

      filtered = filtered.filter((task) => {
        const referenceDate =
          task.status === "PUBLISHED"
            ? task.publishedAt
            : task.dueDate ?? task.scheduledAt;

        if (!referenceDate) return false;
        const taskDate = new Date(referenceDate);
        return taskDate >= startDate && taskDate <= endDate;
      });
    }

    // Filtrar por usuario (solo si no está en modo "Mis Tareas")
    if (viewMode === "all" && selectedUserId !== "all") {
      if (selectedUserId === "unassigned") {
        filtered = filtered.filter((task) => task.assignedEditorId === null);
      } else {
        filtered = filtered.filter((task) => task.assignedEditorId === selectedUserId);
      }
    }

    // Filtrar por tipo
    if (selectedType !== "all") {
      filtered = filtered.filter((task) => task.type === selectedType);
    }

    return filtered;
  }, [tasks, viewMode, userId, selectedClientId, selectedMonth, selectedUserId, selectedType]);

  // Actualizar el estado del padre cuando cambien las tareas filtradas
  useEffect(() => {
    onFilterChange(filteredTasks);
  }, [filteredTasks, onFilterChange]);

  return (
    <div className="space-y-4">
      {/* Filtro rápido: Mis Tareas / Todo el Equipo (solo visible para ADMIN) */}
      {userRole === "ADMIN" && (
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "my-tasks" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("my-tasks")}
            disabled={!userId}
          >
            Mis Tareas
          </Button>
          <Button
            variant={viewMode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("all")}
          >
            Ver todo el equipo
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2 md:grid md:grid-cols-2 lg:grid-cols-4">
        <div className="w-full">
          <Select
            value={selectedClientId}
            onValueChange={(value) => {
              setSelectedClientId(value);
              if (onClientChange) {
                onClientChange(value);
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filtrar por cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients
                .filter((client) => client.status !== "INACTIVE")
                .map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full">
          <Select 
            value={selectedMonth} 
            onValueChange={setSelectedMonth}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filtrar por mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los meses</SelectItem>
              {availableMonths.map((monthKey) => {
                const [year, month] = monthKey.split("-").map(Number);
                const monthNames = [
                  "Enero",
                  "Febrero",
                  "Marzo",
                  "Abril",
                  "Mayo",
                  "Junio",
                  "Julio",
                  "Agosto",
                  "Septiembre",
                  "Octubre",
                  "Noviembre",
                  "Diciembre",
                ];
                const monthName = `${monthNames[month - 1]} ${year}`;
                return (
                  <SelectItem key={monthKey} value={monthKey}>
                    {monthName}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        {viewMode === "all" && (
          <div className="w-full">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filtrar por usuario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los usuarios</SelectItem>
                <SelectItem value="unassigned">Sin asignar</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="w-full">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="REEL">Reel</SelectItem>
              <SelectItem value="FLYER">Flyer</SelectItem>
              <SelectItem value="STORY">Story</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

