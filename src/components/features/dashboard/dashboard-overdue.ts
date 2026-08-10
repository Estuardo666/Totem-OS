const OVERDUE_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

const PUBLICATION_READY_STATUSES = new Set(["CLIENT_APPROVED", "APPROVED"]);

type TaskDeadline = {
  dueDate: Date | string | null;
  status: string;
};

export function isOverdueBy24Hours(task: TaskDeadline, now: Date) {
  return Boolean(
    task.dueDate
    && new Date(task.dueDate).getTime() <= now.getTime() - OVERDUE_GRACE_PERIOD_MS,
  );
}

export function isOverdueEditingTask(task: TaskDeadline, now: Date) {
  return task.status === "EDITING" && isOverdueBy24Hours(task, now);
}

export function isOverduePublicationTask(task: TaskDeadline, now: Date) {
  return PUBLICATION_READY_STATUSES.has(task.status) && isOverdueBy24Hours(task, now);
}
