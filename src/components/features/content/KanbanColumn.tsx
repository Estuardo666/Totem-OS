"use client";

import { useState, useEffect } from "react";
import { Droppable, DroppableProvided, DroppableStateSnapshot } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";

import { TaskCard } from "./TaskCard";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import type { ContentTaskStatus } from "@/types";

interface KanbanColumnProps {
  status: ContentTaskStatus;
  label: string;
  tasks: ContentTaskWithClient[];
  onCardClick: (task: ContentTaskWithClient) => void;
  optimisticPublish: (taskId: string) => Promise<void>;
  onPromoteTask?: (taskId: string) => Promise<void>;
  isCompactView?: boolean;
}

export function KanbanColumn({ status, label, tasks, onCardClick, optimisticPublish, onPromoteTask, isCompactView = false }: KanbanColumnProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);

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
      <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-600 overflow-visible md:overflow-hidden">
        {/* Header Sticky - Texto más compacto en desktop */}
        <div className="sticky top-0 z-30 w-full bg-white dark:bg-slate-900 py-2 px-2 md:py-2 md:px-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between rounded-t-xl">
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
              className={`flex-1 overflow-y-auto pr-1 scrollbar-hide transition-colors ${ 
                snapshot.isDraggingOver
                  ? "bg-primary/5 border-2 border-dashed border-primary rounded-md"
                  : ""
              }`}
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
                        isCompactView={isCompactView}
                      />
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed p-3 text-center text-[9px] md:text-[10px] text-muted-foreground bg-muted/5 col-span-2 md:col-span-1 animate-fade-in">
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