"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContentTaskStatus } from "@/types";

import { kanbanColumnToneClasses } from "./kanban-column-tones";

interface KanbanStickyHeadersProps {
  columns: Array<{
    status: ContentTaskStatus;
    label: string;
  }>;
  counts: Partial<Record<ContentTaskStatus, number>>;
  isVisible: boolean;
  scrollLeft: number;
  topOffset: number;
  boardLeft: number;
  boardWidth: number;
}

const columnWidthClassName = "flex flex-col min-w-[35vw] max-w-[35vw] sm:min-w-[350px] sm:max-w-none md:min-w-0 md:w-full md:flex-1 snap-center flex-shrink-0 ml-0 mr-[5px] md:mr-0 px-0 md:px-0";

export function KanbanStickyHeaders({
  columns,
  counts,
  isVisible,
  scrollLeft,
  topOffset,
  boardLeft,
  boardWidth,
}: KanbanStickyHeadersProps) {
  return (
    <div
      aria-hidden={!isVisible}
      style={{
        position: "fixed",
        top: topOffset,
        left: boardLeft,
        width: boardWidth,
        zIndex: 50,
        pointerEvents: isVisible ? "auto" : "none",
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(-6px)",
        transition: "opacity 200ms ease-out, transform 200ms ease-out",
        overflow: "hidden",
      }}
    >
      <div className="border-b border-slate-200/70 bg-background/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 dark:border-border/80">
        <div className="overflow-hidden">
          <div
            className="flex w-max items-stretch md:grid md:w-full md:grid-cols-7 md:gap-4"
            style={{ transform: `translateX(-${scrollLeft}px)` }}
          >
            {columns.map((column) => {
              const toneClasses = kanbanColumnToneClasses[column.status] ?? kanbanColumnToneClasses.IDEA!;

              return (
                <div key={column.status} className={columnWidthClassName}>
                  <div
                    className={cn(
                      "flex items-center justify-between border-b px-2 py-2 transition-colors duration-200 ease-out",
                      toneClasses.header
                    )}
                  >
                    <span className="truncate text-xs font-semibold md:text-sm">{column.label}</span>
                    <Badge variant="secondary" className="ml-2 flex-shrink-0 text-[10px] md:text-xs">
                      {counts[column.status] ?? 0}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}