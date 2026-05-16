import { format, isAfter, isSameMonth, endOfMonth, startOfMonth } from "date-fns";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import type { Client } from "@prisma/client";

export type ContentMonthlyStrategyRecord = {
  id: string;
  clientId: string;
  month: number;
  year: number;
  prepared: boolean;
  sentAt: Date | null;
  approved: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ContentMonthlyStrategyDraft = {
  prepared: boolean;
  sentAt: Date | null;
  approved: boolean;
};

export type ContentMonthlyStrategyState = ContentMonthlyStrategyDraft & {
  note: string;
};

export type ContentFactoryShoot = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  status: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    logo?: string | null;
    color?: string | null;
  };
};

export const NON_PUBLISHED_STATUSES = ["PAUSED", "CANCELLED", "REJECTED"] as const;
export const ACTIVE_PIPELINE_STATUSES = [
  "IDEA",
  "SCRIPT",
  "RECORDED",
  "EDITING",
  "REVIEW_INTERNAL",
  "REVIEW_CLIENT",
  "CLIENT_APPROVED",
  "APPROVED",
] as const;

type DeliverableBucket = {
  published: ContentTaskWithClient[];
  unpublished: ContentTaskWithClient[];
  pending: ContentTaskWithClient[];
};

export type ContentAccountSummary = {
  client: Client;
  selectedMonth: string;
  monthLabel: string;
  deliverables: DeliverableBucket;
  health: {
    status: "GREEN" | "YELLOW" | "RED";
    committed: number;
    published: number;
    expectedByToday: number;
    progressPct: number;
    detail: string;
  };
  strategy: ContentMonthlyStrategyState;
  nextShoot: ContentFactoryShoot | null;
  nextDelivery: ContentTaskWithClient | null;
  nextMilestoneLabel: string;
  kanbanTasks: ContentTaskWithClient[];
};

export function getContentStrategyNote(strategy: ContentMonthlyStrategyDraft) {
  if (!strategy.prepared) {
    return "No hay estrategia registrada para este mes.";
  }

  if (!strategy.sentAt) {
    return "La estrategia fue elaborada, pero todavía falta registrar el envío al cliente.";
  }

  if (strategy.approved) {
    return "La estrategia ya fue enviada y aprobada por el cliente.";
  }

  return "La estrategia ya fue enviada al cliente y sigue pendiente de aprobación.";
}

export function buildContentStrategyState(
  strategyRecord?: ContentMonthlyStrategyRecord | null
): ContentMonthlyStrategyState {
  const prepared = strategyRecord?.prepared ?? false;
  const sentAt = strategyRecord?.sentAt ?? null;
  const approved = prepared ? (strategyRecord?.approved ?? false) : false;

  return {
    prepared,
    sentAt,
    approved,
    note: getContentStrategyNote({
      prepared,
      sentAt,
      approved,
    }),
  };
}

export function getMonthOptions(tasks: ContentTaskWithClient[]) {
  const months = new Set<string>();
  months.add(format(new Date(), "yyyy-MM"));

  for (const task of tasks) {
    const referenceDate = getMonthReferenceDate(task);
    if (!referenceDate) continue;
    months.add(format(referenceDate, "yyyy-MM"));
  }

  return [...months].sort().reverse();
}

export function getMonthReferenceDate(task: ContentTaskWithClient) {
  if (task.status === "PUBLISHED") {
    return task.publishedAt ? new Date(task.publishedAt) : null;
  }

  if (NON_PUBLISHED_STATUSES.includes(task.status as (typeof NON_PUBLISHED_STATUSES)[number])) {
    return task.updatedAt ? new Date(task.updatedAt) : null;
  }

  return task.scheduledAt ? new Date(task.scheduledAt) : task.dueDate ? new Date(task.dueDate) : null;
}

export function shouldIncludeTaskInAccountsMonth(task: ContentTaskWithClient, monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  const referenceDate = getMonthReferenceDate(task);

  if (!referenceDate) {
    return ACTIVE_PIPELINE_STATUSES.includes(task.status as (typeof ACTIVE_PIPELINE_STATUSES)[number]);
  }

  if (task.status === "PUBLISHED") {
    return referenceDate >= monthStart && referenceDate <= monthEnd;
  }

  if (NON_PUBLISHED_STATUSES.includes(task.status as (typeof NON_PUBLISHED_STATUSES)[number])) {
    return referenceDate >= monthStart && referenceDate <= monthEnd;
  }

  return referenceDate >= monthStart && referenceDate <= monthEnd;
}

export function buildContentAccountSummary({
  client,
  tasks,
  shootings,
  selectedMonth,
  strategyRecord,
}: {
  client: Client;
  tasks: ContentTaskWithClient[];
  shootings: ContentFactoryShoot[];
  selectedMonth: string;
  strategyRecord?: ContentMonthlyStrategyRecord | null;
}): ContentAccountSummary {
  const [year, month] = selectedMonth.split("-").map(Number);
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  const now = new Date();
  const isCurrentMonth = isSameMonth(monthStart, now);

  const monthTasks = tasks.filter((task) => shouldIncludeTaskInAccountsMonth(task, selectedMonth));

  const published = monthTasks
    .filter((task) => task.status === "PUBLISHED")
    .sort((left, right) => {
      const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
      const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
      return rightTime - leftTime;
    });

  const unpublished = monthTasks
    .filter((task) => NON_PUBLISHED_STATUSES.includes(task.status as (typeof NON_PUBLISHED_STATUSES)[number]))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  const pending = monthTasks
    .filter((task) => ACTIVE_PIPELINE_STATUSES.includes(task.status as (typeof ACTIVE_PIPELINE_STATUSES)[number]))
    .sort((left, right) => {
      const leftTime = getMonthReferenceDate(left)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightTime = getMonthReferenceDate(right)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });

  const committed = (client.monthlyReels || 0) + (client.monthlyFlyers || 0);
  const publishedCount = published.filter((task) => task.type === "REEL" || task.type === "FLYER").length;
  const totalDaysInMonth = monthEnd.getDate();
  const elapsedDays = isCurrentMonth ? now.getDate() : totalDaysInMonth;
  const expectedByToday = committed > 0 ? Math.ceil((committed * elapsedDays) / totalDaysInMonth) : pending.length + publishedCount;
  const progressPct = committed > 0 ? Math.min(100, Math.round((publishedCount / committed) * 100)) : 0;

  let status: "GREEN" | "YELLOW" | "RED" = "GREEN";
  if (publishedCount + 1 < expectedByToday) {
    status = "RED";
  } else if (publishedCount < expectedByToday) {
    status = "YELLOW";
  }

  const clientShoots = shootings
    .filter((shoot) => shoot.clientId === client.id && shoot.status === "SCHEDULED")
    .sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime());

  const nextShoot = clientShoots.find((shoot) => isAfter(new Date(shoot.startTime), now)) ?? null;
  const nextDelivery = pending.find((task) => getMonthReferenceDate(task) !== null) ?? pending[0] ?? null;
  const strategy = buildContentStrategyState(strategyRecord);

  let nextMilestoneLabel = "Sin próximos hitos registrados";
  if (nextShoot && nextDelivery) {
    nextMilestoneLabel =
      new Date(nextShoot.startTime).getTime() <= (getMonthReferenceDate(nextDelivery)?.getTime() ?? Number.MAX_SAFE_INTEGER)
        ? `Próximo rodaje: ${nextShoot.title}`
        : `Próxima entrega: ${nextDelivery.title}`;
  } else if (nextShoot) {
    nextMilestoneLabel = `Próximo rodaje: ${nextShoot.title}`;
  } else if (nextDelivery) {
    nextMilestoneLabel = `Próxima entrega: ${nextDelivery.title}`;
  }

  return {
    client,
    selectedMonth,
    monthLabel: format(monthStart, "MMMM yyyy"),
    deliverables: {
      published,
      unpublished,
      pending,
    },
    health: {
      status,
      committed,
      published: publishedCount,
      expectedByToday,
      progressPct,
      detail:
        committed > 0
          ? `${publishedCount}/${committed} publicados · esperado a hoy ${expectedByToday}`
          : `${publishedCount} publicados en ${format(monthStart, "MMMM")}`,
    },
    strategy,
    nextShoot,
    nextDelivery,
    nextMilestoneLabel,
    kanbanTasks: pending,
  };
}

export function formatAccountDate(date: Date | null) {
  if (!date) return "Sin fecha";
  return format(date, "dd MMM · HH:mm");
}