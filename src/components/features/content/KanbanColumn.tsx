"use client";

import { Droppable, DroppableProvided, DroppableStateSnapshot } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TaskCard } from "./TaskCard";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import type { ContentTaskStatus } from "@/types";

interface KanbanColumnProps {
  status: ContentTaskStatus;
  label: string;
  tasks: ContentTaskWithClient[];
  onCardClick: (task: ContentTaskWithClient) => void;
  optimisticPublish: (taskId: string) => Promise<void>;
}

export function KanbanColumn({ status, label, tasks, onCardClick, optimisticPublish }: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[85vw] sm:min-w-[350px] md:min-w-0 md:w-full md:flex-1 snap-center flex-shrink-0 first:ml-4 last:mr-4 px-2 md:px-0 h-full">
      {/* Column Container con fondo y borde - Padding reducido en desktop */}
      <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-90/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
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
              className={`flex-1 overflow-y-auto pr-1 scrollbar-hide transition-colors ${
                snapshot.isDraggingOver
                  ? "bg-primary/5 border-2 border-dashed border-primary rounded-md"
                  : ""
              }`}
            >
              {/* Mobile: grid 2 cols | Desktop: flex col siempre */}
              <div className="flex flex-col gap-3 p-3 w-full overflow-hidden">
                {tasks.length > 0 ? (
                  tasks.map((task, index) => (
                    <div
                      key={task.id}
                      className="animate-fade-in-up"
                    >
                      <TaskCard
                        task={task}
                        index={index}
                        onCardClick={onCardClick}
                        optimisticPublish={optimisticPublish}
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