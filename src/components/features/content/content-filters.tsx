"use client";

import { useState, useMemo, useEffect } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useSession } from "next-auth/react";
import { SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import type { Client, User } from "@prisma/client";

const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const EDITOR_RESPONSIBLE_STATUSES = ["RECORDED", "EDITING", "REVIEW_CLIENT"] as const;
const COMMUNITY_RESPONSIBLE_STATUSES = ["IDEA", "SCRIPT", "CLIENT_APPROVED"] as const;

function matchesTaskAssignment(
  task: ContentTaskWithClient,
  targetUserId?: string,
  specialty?: string | null,
  role?: string | null
) {
  if (!targetUserId) {
    return true;
  }

  const normalizedSpecialty = specialty?.toUpperCase() ?? null;
  const actsAsCommunity = normalizedSpecialty?.includes("COMMUNITY") ?? false;
  const actsAsEditor = normalizedSpecialty === "EDITOR" || (!normalizedSpecialty && role === "EDITOR");

  if (actsAsCommunity) {
    return (
      task.assignedCommunityId === targetUserId &&
      COMMUNITY_RESPONSIBLE_STATUSES.includes(task.status as (typeof COMMUNITY_RESPONSIBLE_STATUSES)[number])
    );
  }

  if (actsAsEditor) {
    return (
      task.assignedEditorId === targetUserId &&
      EDITOR_RESPONSIBLE_STATUSES.includes(task.status as (typeof EDITOR_RESPONSIBLE_STATUSES)[number])
    );
  }

  return task.assignedEditorId === targetUserId || task.assignedCommunityId === targetUserId;
}

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Por defecto, si es EDITOR o VIEWER, mostrar solo sus tareas
  const [viewMode, setViewMode] = useState<"my-tasks" | "all">(
    defaultView || (userRole === "EDITOR" || userRole === "VIEWER" ? "my-tasks" : "all")
  );
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), "yyyy-MM"));
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [clientSearch, setClientSearch] = useState("");

  const sortedClients = [...clients].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  const filteredClients = sortedClients.filter((client) => {
    const search = normalizeText(clientSearch).trim();
    if (!search) return true;
    return normalizeText(client.name).startsWith(search);
  });

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

    const selectedUser = selectedUserId !== "all"
      ? users.find((user) => user.id === selectedUserId)
      : null;

    // Filtro principal: "Mis Tareas" vs "Todo el Equipo"
    if (viewMode === "my-tasks" && userId) {
      filtered = filtered.filter((task) =>
        matchesTaskAssignment(task, userId, session?.user?.specialty, session?.user?.role ?? null)
      );
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
        filtered = filtered.filter(
          (task) => task.assignedEditorId === null && task.assignedCommunityId === null
        );
      } else {
        filtered = filtered.filter((task) =>
          matchesTaskAssignment(
            task,
            selectedUserId,
            selectedUser?.specialty ?? null,
            selectedUser?.roleLegacy ?? null
          )
        );
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

  const FiltersGrid = (
    <>
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
            <div className="px-3 pt-3 pb-2" onKeyDown={(e) => e.stopPropagation()}>
              <Input
                placeholder="Buscar cliente"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                autoFocus
              />
            </div>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {filteredClients
              .filter((client) => client.status !== "INACTIVE")
              .map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  <div className="flex items-center gap-2">
                    {(client as any).logo ? (
                      <img
                        src={(client as any).logo}
                        alt={client.name}
                        className="h-4 w-4 object-contain"
                      />
                    ) : (
                      <div
                        className="h-4 w-4 rounded flex items-center justify-center text-white text-xs font-medium"
                        style={{ backgroundColor: client.color || "#000000" }}
                      >
                        {client.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .substring(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                    <span>{client.name}</span>
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
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
              <SelectItem value="unassigned">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center">
                    ?
                  </div>
                  <span>Sin asignar</span>
                </div>
              </SelectItem>
              {users.map((user) => {
                const initials = user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase();
                return (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      {user.image ? (
                        <img src={user.image} alt={user.name} className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                          {initials}
                        </div>
                      )}
                      <span>{user.name}</span>
                    </div>
                  </SelectItem>
                );
              })}
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
    </>
  );

  return (
    <div className="w-full px-0 space-y-3">
      <div
        className={`${
          userRole === "ADMIN"
            ? "grid grid-cols-3 md:flex md:items-center"
            : "flex justify-end"
        } w-full items-center gap-2`}
      >
        {/* Filtro rápido: Mis Tareas / Todo el Equipo (solo visible para ADMIN) */}
        {userRole === "ADMIN" && (
          <>
            <Button
              variant={viewMode === "my-tasks" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("my-tasks")}
              disabled={!userId}
              className="w-full min-w-0 md:w-auto gap-1 rounded-full px-2 text-[12px] sm:text-sm"
            >
              <Avatar className="hidden h-5 w-5 sm:flex">
                <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || "Usuario"} />
                <AvatarFallback className="text-xs">
                  {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">Mis Tareas</span>
            </Button>
            <Button
              variant={viewMode === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("all")}
              className="w-full min-w-0 md:w-auto rounded-full px-2 text-[12px] sm:text-sm"
            >
              <span className="truncate">Ver todo el equipo</span>
            </Button>
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full min-w-0 md:w-auto md:ml-auto rounded-full px-2 text-[12px] sm:text-sm"
          onClick={() => setFiltersOpen((prev) => !prev)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="truncate">Filtros</span>
        </Button>
      </div>

      <div
        className={`overflow-hidden transition-all duration-200 ease-out ${
          filtersOpen ? "max-h-[1400px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">{FiltersGrid}</div>
      </div>
    </div>
  );
}

