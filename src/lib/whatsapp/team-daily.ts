import { db } from "@/lib/db";
import { enqueueWhatsApp, normalizePhone } from "./enqueue";
import { getWhatsAppConfig } from "./config";
import { ecuadorDayBounds, isConfiguredTeamDailyMinute, isWhatsAppScheduleActive } from "./schedule";

const DAY_MS = 24 * 60 * 60 * 1000;
const ECUADOR_OFFSET_MS = 5 * 60 * 60 * 1000;
const CLOSED_STATUSES = ["PUBLISHED", "APPROVED", "CLIENT_APPROVED", "PAUSED", "CANCELLED", "REJECTED"];

export async function enqueueWhatsAppTeamDailySummaries(now = new Date()) {
  const config = await getWhatsAppConfig();
  if (config.paused) return { checked: 0, enqueued: 0, skipped: "paused" as const };
  if (!isConfiguredTeamDailyMinute(now, config.teamDailyHour)) return { checked: 0, enqueued: 0, skipped: "outside-configured-time" as const };

  const { start, end } = ecuadorDayBounds(now);
  const today = new Date(start.getTime() - ECUADOR_OFFSET_MS).toISOString().slice(0, 10);
  const users = await db.user.findMany({
    where: { phone: { not: null } },
    select: { id: true, name: true, phone: true, whatsappOptIn: true, activeSchedule: true },
    orderBy: { name: "asc" },
  });
  let enqueued = 0;
  let checked = 0;
  let ownerUserId: string | null = null;
  if (config.ownerPhone) {
    ownerUserId = users.find((user) => user.phone && normalizePhone(user.phone) === normalizePhone(config.ownerPhone!))?.id ?? null;
  }

  for (const user of users) {
    if (!user.phone) continue;
    const isOwner = user.id === ownerUserId;
    if (!user.whatsappOptIn && !isOwner) continue;
    const activeSchedule = isOwner && user.activeSchedule === null
      ? { type: "weekdays", days: [1, 2, 3, 4, 5] }
      : user.activeSchedule;
    if (!isWhatsAppScheduleActive(activeSchedule, now)) continue;
    checked++;
    const [tasks, shoots] = await Promise.all([
      db.contentTask.findMany({
        where: {
          status: { notIn: CLOSED_STATUSES },
          AND: [
            { OR: [{ assignedEditorId: user.id }, { assignedCommunityId: user.id }] },
            { OR: [{ dueDate: { lt: end } }, { scheduledAt: { gte: start, lt: end } }] },
          ],
        },
        select: { title: true, status: true, dueDate: true, scheduledAt: true, client: { select: { name: true } } },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { scheduledAt: { sort: "asc", nulls: "last" } }],
        take: 10,
      }),
      db.shoot.findMany({
        where: { status: "SCHEDULED", startTime: { gte: start, lt: end }, crew: { some: { id: user.id } } },
        select: { title: true, startTime: true, client: { select: { name: true } } },
        orderBy: { startTime: "asc" },
        take: 5,
      }),
    ]);

    const lines = [
      ...tasks.map((task) => {
        const due = task.dueDate ?? task.scheduledAt;
        const label = due && due < start ? "Atrasada" : "Hoy";
        return `• ${label}: ${task.title} — ${task.client.name}`;
      }),
      ...shoots.map((shoot) => `• Rodaje: ${shoot.title} — ${shoot.client.name}, ${shoot.startTime.toLocaleTimeString("es-EC", { timeZone: "America/Guayaquil", hour: "2-digit", minute: "2-digit" })}`),
    ];

    if (isOwner) {
      lines.push(...await getOwnerDecisionSummary(now, config.maxApprovalReminders));
    }

    if (!lines.length) continue;
    const body = `Hola ${user.name.split(" ")[0]}, estos son tus pendientes de hoy (${today}):\n${lines.join("\n")}`.slice(0, 4000);
    try {
      const result = await enqueueWhatsApp({
        to: `${normalizePhone(user.phone)}@s.whatsapp.net`,
        body,
        kind: "TEAM_DAILY",
        dedupeKey: `team-daily:${user.id}:${today}`,
      });
      if (result.created) enqueued++;
    } catch {
      // Queue failures must not write phone numbers or message text to logs.
    }
  }

  // The owner's H1 number is authoritative even when it has not also been
  // copied into a User row. In that case send only the private bot summary,
  // never team tasks, and use the default weekday schedule.
  if (config.ownerPhone && !ownerUserId && isWhatsAppScheduleActive({ type: "weekdays", days: [1, 2, 3, 4, 5] }, now)) {
    const lines = await getOwnerDecisionSummary(now, config.maxApprovalReminders);
    if (lines.length) {
      checked++;
      try {
        const result = await enqueueWhatsApp({
          to: `${normalizePhone(config.ownerPhone)}@s.whatsapp.net`,
          body: `🤖 Totem Bot · Resumen privado (${today}):\n${lines.join("\n")}`.slice(0, 4000),
          kind: "TEAM_DAILY",
          dedupeKey: `team-daily:owner:${today}`,
        });
        if (result.created) enqueued++;
      } catch {
        // The global queue still enforces pause, destination, and daily dedupe.
      }
    }
  }

  return { checked, enqueued };
}

async function getOwnerDecisionSummary(now: Date, maxReminders: number): Promise<string[]> {
  const requests = await db.whatsAppApprovalRequest.findMany({
    where: { status: "PENDING", remindersSent: { gte: maxReminders, gt: 0 } },
    select: { id: true, groupJid: true, fileName: true, sentAt: true, task: { select: { title: true, status: true } } },
    orderBy: { sentAt: "asc" },
    take: 10,
  });
  const groupRows = await db.whatsAppGroup.findMany({
    where: { jid: { in: requests.map((request) => request.groupJid) } },
    select: { jid: true, name: true },
  });
  const groupNames = new Map(groupRows.map((group) => [group.jid, group.name]));
  const active = await Promise.all(requests.map(async (request) => {
    if (request.task && request.task.status !== "REVIEW_CLIENT") return null;
    const stopped = await db.whatsAppEvent.findFirst({
      where: { type: "APPROVAL_REMINDERS_STOPPED", payload: { path: ["requestId"], equals: request.id } },
      select: { id: true },
    });
    return stopped ? null : request;
  }));
  const lines = active.flatMap((request) => {
    if (!request) return [];
    const days = Math.max(1, Math.floor((now.getTime() - request.sentAt.getTime()) / DAY_MS));
    return [`• ${groupNames.get(request.groupJid) ?? "Cliente"} sin aprobar hace ${days} días: ${request.task?.title ?? request.fileName ?? "contenido"}`];
  });
  const expiredPrompts = await db.whatsAppOwnerPrompt.count({
    where: { status: "EXPIRED", expiresAt: { gte: new Date(now.getTime() - DAY_MS), lt: now } },
  });
  if (expiredPrompts) lines.push(`• Hay ${expiredPrompts} decisión${expiredPrompts === 1 ? "" : "es"} del bot vencida${expiredPrompts === 1 ? "" : "s"} en las últimas 24 horas.`);
  return lines;
}
