"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { Settings2 } from "lucide-react";
import { KanbanBoard } from "./kanban-board";
import { ContentFilters } from "./content-filters";
import { MonthlyProgress } from "./monthly-progress";
import { ContentAccountsView } from "./content-accounts-view";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import type { Client, User } from "@prisma/client";
import type { ContentFactoryShoot, ContentMonthlyStrategyRecord } from "./content-accounts-utils";

// Calendar is only loaded when the user switches to the calendar tab
const ContentCalendar = dynamic(
  () => import("./content-calendar").then(m => ({ default: m.ContentCalendar })),
  { loading: () => <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Cargando calendario…</div> }
);

interface ContentFactoryWrapperProps {
  tasks: ContentTaskWithClient[];
  clients: Client[];
  users: User[];
  shootings: ContentFactoryShoot[];
  strategies: ContentMonthlyStrategyRecord[];
}

function getCurrentMonthValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function isValidMonthValue(value: string | null) {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}

function applyLocalTaskStatusChange(
  task: ContentTaskWithClient,
  oldStatus: string,
  newStatus: string
) {
  const updatedTask: ContentTaskWithClient = {
    ...task,
    status: newStatus,
  };

  if (oldStatus === "IDEA" && newStatus === "SCRIPT") {
    updatedTask.scheduledAt = null;
    updatedTask.dueDate = null;
    updatedTask.publishedAt = null;
  }

  if (newStatus === "PUBLISHED" && oldStatus !== "PUBLISHED") {
    updatedTask.publishedAt = new Date();
  }

  return updatedTask;
}

export function ContentFactoryWrapper({
  tasks,
  clients,
  users,
  shootings,
  strategies,
}: ContentFactoryWrapperProps) {
  const activeClients = useMemo(
    () => clients.filter((client) => client.status !== "INACTIVE"),
    [clients]
  );
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentMonthValue = getCurrentMonthValue();
  const requestedView = searchParams.get("view");
  const requestedAccountsClientId = searchParams.get("accountsClient");
  const requestedAccountsMonth = isValidMonthValue(searchParams.get("accountsMonth"))
    ? searchParams.get("accountsMonth")!
    : currentMonthValue;
  const [allTasks, setAllTasks] = useState<ContentTaskWithClient[]>(tasks);
  const [allStrategies, setAllStrategies] = useState<ContentMonthlyStrategyRecord[]>(strategies);
  const [filteredTasks, setFilteredTasks] = useState<ContentTaskWithClient[]>(tasks);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedAccountsClientId, setSelectedAccountsClientId] = useState<string>(() => {
    if (requestedAccountsClientId && activeClients.some((client) => client.id === requestedAccountsClientId)) {
      return requestedAccountsClientId;
    }

    return activeClients[0]?.id ?? "all";
  });
  const [selectedAccountsMonth, setSelectedAccountsMonth] = useState<string>(requestedAccountsMonth);
  const [viewMode, setViewMode] = useState<"kanban" | "calendar" | "accounts">(
    requestedView === "accounts" ? "accounts" : "kanban"
  );
  const [isCompactView, setIsCompactView] = useState(false);

  useEffect(() => {
    setAllTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    setAllStrategies(strategies);
  }, [strategies]);

  useEffect(() => {
    if (activeClients.length === 0) {
      setSelectedAccountsClientId("all");
      return;
    }

    setSelectedAccountsClientId((current) => {
      if (current !== "all" && activeClients.some((client) => client.id === current)) {
        return current;
      }

      return activeClients[0].id;
    });
  }, [activeClients]);

  useEffect(() => {
    const nextParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");

    if (viewMode === "accounts") {
      nextParams.set("view", "accounts");

      if (selectedAccountsClientId && selectedAccountsClientId !== "all") {
        nextParams.set("accountsClient", selectedAccountsClientId);
      } else {
        nextParams.delete("accountsClient");
      }

      if (selectedAccountsMonth) {
        nextParams.set("accountsMonth", selectedAccountsMonth);
      } else {
        nextParams.delete("accountsMonth");
      }
    } else {
      if (nextParams.get("view") === "accounts") {
        nextParams.delete("view");
      }

      nextParams.delete("accountsClient");
      nextParams.delete("accountsMonth");
    }

    const nextQuery = nextParams.toString();
    const currentQuery = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).toString()
      : "";

    if (nextQuery === currentQuery) {
      return;
    }

    window.history.replaceState(window.history.state, "", nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [pathname, selectedAccountsClientId, selectedAccountsMonth, viewMode]);

  useEffect(() => {
    const handleTaskStatusUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{
        taskId: string;
        oldStatus: string;
        newStatus: string;
      }>;

      const detail = customEvent.detail;
      if (!detail?.taskId || !detail?.oldStatus || !detail?.newStatus) {
        return;
      }

      setAllTasks((prev) =>
        prev.map((task) =>
          task.id === detail.taskId
            ? applyLocalTaskStatusChange(task, detail.oldStatus, detail.newStatus)
            : task
        )
      );
    };

    window.addEventListener("taskStatusUpdated", handleTaskStatusUpdated as EventListener);

    return () => {
      window.removeEventListener("taskStatusUpdated", handleTaskStatusUpdated as EventListener);
    };
  }, []);

  const handleStrategySaved = (strategy: ContentMonthlyStrategyRecord) => {
    setAllStrategies((current) => {
      const existingIndex = current.findIndex(
        (item) =>
          item.clientId === strategy.clientId &&
          item.year === strategy.year &&
          item.month === strategy.month
      );

      if (existingIndex === -1) {
        return [strategy, ...current];
      }

      const next = [...current];
      next[existingIndex] = strategy;
      return next;
    });
  };

  return (
    <div className="w-full px-0 md:px-4 py-6 space-y-6">
      <ContentFilters
        tasks={allTasks}
        clients={activeClients}
        users={users}
        onFilterChange={setFilteredTasks}
        onClientChange={setSelectedClientId}
      />
      <MonthlyProgress selectedClientId={selectedClientId} clients={activeClients} />

      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "kanban" | "calendar" | "accounts")}>
        <div className="flex items-center justify-between">
          <TabsList className="grid w-full max-w-[520px] grid-cols-3 h-12 items-center rounded-full bg-muted px-3 py-1 text-muted-foreground">
            <TabsTrigger value="kanban" className="rounded-full">Tablero</TabsTrigger>
            <TabsTrigger value="calendar" className="rounded-full">Calendario</TabsTrigger>
            <TabsTrigger value="accounts" className="rounded-full">Cuentas</TabsTrigger>
          </TabsList>
          
          {viewMode === "kanban" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCompactView(!isCompactView)}
              className="gap-2 rounded-full"
            >
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">{isCompactView ? "Vista Compacta" : "Vista Normal"}</span>
            </Button>
          )}
        </div>
        
        <TabsContent value="kanban" className="mt-4">
          <KanbanBoard 
            tasks={filteredTasks} 
            users={users} 
            clients={activeClients.map(c => ({ id: c.id, name: c.name, logo: c.logo, color: c.color }))}
            isCompactView={isCompactView}
          />
        </TabsContent>
        
        <TabsContent value="calendar" className="mt-4">
          <ContentCalendar 
            tasks={filteredTasks} 
            users={users} 
            clients={activeClients.map(c => ({ id: c.id, name: c.name, logo: c.logo, color: c.color }))}
          />
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <ContentAccountsView
            tasks={allTasks}
            clients={activeClients}
            users={users}
            shootings={shootings}
            strategies={allStrategies}
            selectedClientId={selectedAccountsClientId}
            selectedMonth={selectedAccountsMonth}
            onClientChange={(clientId) => setSelectedAccountsClientId((current) => (current === clientId ? current : clientId))}
            onMonthChange={(month) => setSelectedAccountsMonth((current) => (current === month ? current : month))}
            onStrategySaved={handleStrategySaved}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

