"use client";

import { useState } from "react";
import { KanbanBoard } from "./kanban-board";
import { ContentCalendar } from "./content-calendar";
import { ContentFilters } from "./content-filters";
import { MonthlyProgress } from "./monthly-progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import type { Client, User } from "@prisma/client";

interface ContentFactoryWrapperProps {
  tasks: ContentTaskWithClient[];
  clients: Client[];
  users: User[];
}

export function ContentFactoryWrapper({
  tasks,
  clients,
  users,
}: ContentFactoryWrapperProps) {
  const activeClients = clients.filter((client) => client.status !== "INACTIVE");
  const [filteredTasks, setFilteredTasks] = useState<ContentTaskWithClient[]>(tasks);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"kanban" | "calendar">("kanban");

  return (
    <div className="space-y-4">
      <ContentFilters
        tasks={tasks}
        clients={activeClients}
        users={users}
        onFilterChange={setFilteredTasks}
        onClientChange={setSelectedClientId}
      />
      <MonthlyProgress selectedClientId={selectedClientId} clients={activeClients} />

      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "kanban" | "calendar")}>
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="kanban">Tablero</TabsTrigger>
          <TabsTrigger value="calendar">Calendario</TabsTrigger>
        </TabsList>
        
        <TabsContent value="kanban" className="mt-4">
          <KanbanBoard 
            tasks={filteredTasks} 
            users={users} 
            clients={activeClients.map(c => ({ id: c.id, name: c.name }))}
          />
        </TabsContent>
        
        <TabsContent value="calendar" className="mt-4">
          <ContentCalendar 
            tasks={filteredTasks} 
            users={users} 
            clients={activeClients.map(c => ({ id: c.id, name: c.name }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

