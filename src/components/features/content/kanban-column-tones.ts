import type { ContentTaskStatus } from "@/types";

export type KanbanColumnToneClasses = {
  container: string;
  header: string;
  emptyState: string;
};

export const kanbanColumnToneClasses: Partial<Record<ContentTaskStatus, KanbanColumnToneClasses>> = {
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