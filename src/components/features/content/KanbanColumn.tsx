"use client";

import { useState, useEffect } from "react";
import { Droppable, DroppableProvided, DroppableStateSnapshot } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { TaskCard } from "./TaskCard";
import { kanbanColumnToneClasses } from "./kanban-column-tones";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import type { ContentTaskStatus } from "@/types";

interface KanbanColumnProps {
  status: ContentTaskStatus;
  label: string;
  tasks: ContentTaskWithClient[];
  onCardClick: (task: ContentTaskWithClient) => void;
  optimisticPublish: (taskId: string) => Promise<void>;
  onPromoteTask?: (taskId: string) => Promise<void>;
  onOptimisticStatusChange?: (taskId: string, newStatus: ContentTaskStatus) => Promise<void>;
  isCompactView?: boolean;
  clients?: Array<{ id: string; name: string; logo?: string | null }>;
}

export function KanbanColumn({ status, label, tasks, onCardClick, optimisticPublish, onPromoteTask, onOptimisticStatusChange, isCompactView = false, clients = [] }: KanbanColumnProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const toneClasses = kanbanColumnToneClasses[status] ?? kanbanColumnToneClasses.IDEA!;

  // Gatillar transición cuando isCompactView cambia
  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 150);
    return () => clearTimeout(timer);
  }, [isCompactView]);
  return (
    <div
      data-column-id={status}
      className="flex flex-col min-w-[35vw] max-w-[35vw] sm:min-w-[350px] sm:max-w-none md:min-w-0 md:w-full md:flex-1 snap-center flex-shrink-0 ml-0 mr-[5px] md:mr-0 px-0 md:px-0 h-full"
    >
      {/* Column Container con fondo y borde - Padding reducido en desktop */}
      <div
        className={cn(
          "flex flex-col h-full rounded-xl border overflow-visible md:overflow-hidden transition-colors duration-200 ease-out",
          toneClasses.container
        )}
      >
        {/* Header Sticky - Texto más compacto en desktop */}
        <div
          className={cn(
            "sticky top-0 z-30 w-full py-2 px-2 md:py-2 md:px-2 border-b flex items-center justify-between rounded-t-xl transition-colors duration-200 ease-out",
            toneClasses.header
          )}
        >
          <h3 className="font-semibold text-xs md:text-sm truncate">
            {label}
          </h3>
          <Badge variant="secondary" className="ml-2 flex-shrink-0 text-[10px] md:text-xs">
            {tasks.length}
          </Badge>
        </div>

        {/* Área droppable con scroll vertical independiente */}
        <Droppable droppableId={status}>
          {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              data-droppable-id={status}
              className={cn(
                "flex-1 overflow-visible md:overflow-y-auto pr-1 scrollbar-hide rounded-b-xl transition-colors duration-200 ease-out",
                snapshot.isDraggingOver && "bg-primary/5 border-2 border-dashed border-primary rounded-md"
              )}
            >
              {/* Contenedor de tarjetas con transición suave */}
              <div 
                key={`tasks-${status}-${isCompactView}`}
                className={`flex flex-col gap-3 p-3 w-full overflow-visible tasks-content-transition ${
                  isTransitioning ? "opacity-0" : "opacity-100"
                }`}
              >
                {tasks.length > 0 ? (
                  tasks.map((task, index) => (
                    <div
                      key={task.id}
                      className="animate-fade-in-view"
                    >
                      <TaskCard
                        task={task}
                        index={index}
                        onCardClick={onCardClick}
                        optimisticPublish={optimisticPublish}
                        onPromoteTask={onPromoteTask}
                        onOptimisticStatusChange={onOptimisticStatusChange}
                        isCompactView={isCompactView}
                        clients={clients}
                      />
                    </div>
                  ))
                ) : (
                  <div
                    className={cn(
                      "rounded-md border border-dashed p-3 text-center text-[9px] md:text-[10px] text-muted-foreground col-span-2 md:col-span-1 animate-fade-in transition-colors duration-200 ease-out",
                      toneClasses.emptyState
                    )}
                  >
                    Sin tareas
                  </div>
                )}
                {provided.placeholder}
              </div>
            </div>
          )}
        </Droppable>
      </div>
    </div>
  );
}