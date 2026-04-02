"use client";

import { useState, useEffect } from "react";
import { Droppable, DroppableProvided, DroppableStateSnapshot } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  onOptimisticStatusChange?: (taskId: string, newStatus: ContentTaskStatus) => Promise<void>;
  isCompactView?: boolean;
  clients?: Array<{ id: string; name: string; logo?: string | null }>;
}

const columnToneClasses: Partial<Record<ContentTaskStatus, { container: string; header: string; emptyState: string }>> = {
  IDEA: {
    container: "border-slate-200 bg-slate-50 hover:bg-slate-100/90 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800/85",
    header: "border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800/90",
    emptyState: "border-slate-200/70 bg-slate-100/50",
  },
  SCRIPT: {
    container: "border-yellow-200 bg-yellow-50 hover:bg-yellow-100 dark:border-yellow-900/70 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/35",
    header: "border-yellow-200/80 bg-yellow-100/80 dark:border-yellow-900/70 dark:bg-yellow-950/35",
    emptyState: "border-yellow-200/70 bg-yellow-100/50",
  },
  RECORDED: {
    container: "border-lime-200 bg-lime-50 hover:bg-lime-100 dark:border-lime-900/70 dark:bg-lime-950/20 dark:hover:bg-lime-950/35",
    header: "border-lime-200/80 bg-lime-100/80 dark:border-lime-900/70 dark:bg-lime-950/35",
    emptyState: "border-lime-200/70 bg-lime-100/50",
  },
  EDITING: {
    container: "border-sky-200 bg-sky-50 hover:bg-sky-100 dark:border-sky-900/70 dark:bg-sky-950/20 dark:hover:bg-sky-950/35",
    header: "border-sky-200/80 bg-sky-100/80 dark:border-sky-900/70 dark:bg-sky-950/35",
    emptyState: "border-sky-200/70 bg-sky-100/50",
  },
  REVIEW_INTERNAL: {
    container: "border-blue-200 bg-blue-50 hover:bg-blue-100 dark:border-blue-900/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/35",
    header: "border-blue-200/80 bg-blue-100/80 dark:border-blue-900/70 dark:bg-blue-950/35",
    emptyState: "border-blue-200/70 bg-blue-100/50",
  },
  REVIEW_CLIENT: {
    container: "border-cyan-200 bg-cyan-50 hover:bg-cyan-100 dark:border-cyan-900/70 dark:bg-cyan-950/20 dark:hover:bg-cyan-950/35",
    header: "border-cyan-200/80 bg-cyan-100/80 dark:border-cyan-900/70 dark:bg-cyan-950/35",
    emptyState: "border-cyan-200/70 bg-cyan-100/50",
  },
  CLIENT_APPROVED: {
    container: "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/35",
    header: "border-emerald-200/80 bg-emerald-100/80 dark:border-emerald-900/70 dark:bg-emerald-950/35",
    emptyState: "border-emerald-200/70 bg-emerald-100/50",
  },
  APPROVED: {
    container: "border-green-200 bg-green-50 hover:bg-green-100 dark:border-green-900/70 dark:bg-green-950/20 dark:hover:bg-green-950/35",
    header: "border-green-200/80 bg-green-100/80 dark:border-green-900/70 dark:bg-green-950/35",
    emptyState: "border-green-200/70 bg-green-100/50",
  },
  PUBLISHED: {
    container: "border-teal-200 bg-teal-50 hover:bg-teal-100 dark:border-teal-900/70 dark:bg-teal-950/20 dark:hover:bg-teal-950/35",
    header: "border-teal-200/80 bg-teal-100/80 dark:border-teal-900/70 dark:bg-teal-950/35",
    emptyState: "border-teal-200/70 bg-teal-100/50",
  },
};

export function KanbanColumn({ status, label, tasks, onCardClick, optimisticPublish, onPromoteTask, onOptimisticStatusChange, isCompactView = false, clients = [] }: KanbanColumnProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const toneClasses = columnToneClasses[status] ?? columnToneClasses.IDEA!;

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