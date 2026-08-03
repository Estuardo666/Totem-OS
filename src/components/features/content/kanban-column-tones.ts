import type { ContentTaskStatus } from "@/types";

export type KanbanColumnToneClasses = { container: string; header: string; emptyState: string };

const tone = (toneClass: string): KanbanColumnToneClasses => ({
  container: `${toneClass} border-[hsl(var(--kanban-tone)/0.34)] bg-[hsl(var(--kanban-tone)/0.07)] hover:bg-[hsl(var(--kanban-tone)/0.11)]`,
  header: `${toneClass} border-[hsl(var(--kanban-tone)/0.28)] bg-[hsl(var(--kanban-tone)/0.12)]`,
  emptyState: `${toneClass} border-[hsl(var(--kanban-tone)/0.24)] bg-[hsl(var(--kanban-tone)/0.06)]`,
});

export const kanbanColumnToneClasses: Partial<Record<ContentTaskStatus, KanbanColumnToneClasses>> = {
  IDEA: tone("[--kanban-tone:var(--muted-foreground)]"),
  SCRIPT: tone("[--kanban-tone:var(--theme-warning)]"),
  RECORDED: tone("[--kanban-tone:var(--theme-peach)]"),
  EDITING: tone("[--kanban-tone:var(--theme-info)]"),
  REVIEW_INTERNAL: tone("[--kanban-tone:var(--theme-info)]"),
  REVIEW_CLIENT: tone("[--kanban-tone:var(--theme-info)]"),
  CLIENT_APPROVED: tone("[--kanban-tone:var(--primary)]"),
  APPROVED: tone("[--kanban-tone:var(--theme-green)]"),
  PUBLISHED: tone("[--kanban-tone:var(--theme-success)]"),
};
