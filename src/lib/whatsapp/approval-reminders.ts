import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canSendToWhatsAppDestination } from "./enqueue";
import { getWhatsAppConfig } from "./config";
import { nextWhatsAppReminderWindow } from "./schedule";
import { approvalReminderText } from "./templates";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const ECUADOR_OFFSET_MS = 5 * HOUR_MS;

export async function enqueueWhatsAppApprovalReminders(now = new Date()) {
  const config = await getWhatsAppConfig();
  if (config.paused || !config.clientsEnabled) return { checked: 0, enqueued: 0, skipped: "disabled" as const };
  const requests = await db.whatsAppApprovalRequest.findMany({
    where: { status: "PENDING", remindersSent: { lt: config.maxApprovalReminders } },
    include: { task: { select: { id: true, title: true, status: true } } },
    orderBy: { sentAt: "asc" },
    take: 200,
  });
  let checked = 0;
  let enqueued = 0;
  const localHour = new Date(now.getTime() - ECUADOR_OFFSET_MS).getUTCHours();
  if (localHour < 8 || localHour > 19) return { checked: requests.length, enqueued: 0, skipped: "outside-send-window" as const };

  for (const request of requests) {
    const group = await db.whatsAppGroup.findUnique({
      where: { jid: request.groupJid },
      select: { name: true, clientId: true, enabled: true, purposes: true, client: { select: { approvalReminderHours: true } } },
    });
    if (!group) {
      await db.whatsAppApprovalRequest.updateMany({ where: { id: request.id, status: "PENDING" }, data: { status: "CANCELLED" } });
      await cancelQueuedApprovalReminders(request.id);
      continue;
    }
    const currentTask = request.taskId
      ? await db.contentTask.findUnique({ where: { id: request.taskId }, select: { status: true, clientId: true } })
      : null;
    if (request.taskId && (!currentTask || currentTask.status !== "REVIEW_CLIENT" || currentTask.clientId !== group.clientId)) {
      await db.whatsAppApprovalRequest.updateMany({ where: { id: request.id, status: "PENDING" }, data: { status: "CANCELLED" } });
      await cancelQueuedApprovalReminders(request.id);
      continue;
    }
    const stopped = await db.whatsAppEvent.findFirst({
      where: { type: "APPROVAL_REMINDERS_STOPPED", payload: { path: ["requestId"], equals: request.id } },
      select: { id: true },
    });
    if (stopped) {
      await cancelQueuedApprovalReminders(request.id);
      continue;
    }
    if (!group.enabled || !group.clientId || !group.purposes.includes("APPROVAL")) continue;
    const dueFrom = request.lastReminderAt ?? request.sentAt;
    const dueAt = new Date(dueFrom.getTime() + (group.client?.approvalReminderHours ?? config.approvalReminderHours) * HOUR_MS);
    const sendAt = nextWhatsAppReminderWindow(dueAt, config.skipWeekends);
    if (now < sendAt) continue;
    checked++;

    // A message after the video means the client or team has resumed the
    // conversation, so the bot stops nudging this approval.
    const activity = await db.whatsAppInbound.findFirst({
      where: { chatJid: request.groupJid, ts: { gt: request.sentAt } },
      select: { id: true },
    });
    if (activity) {
      await db.whatsAppEvent.create({
        data: { type: "APPROVAL_REMINDERS_STOPPED", groupJid: request.groupJid, payload: { requestId: request.id, reason: "NEW_GROUP_ACTIVITY" } },
      });
      await cancelQueuedApprovalReminders(request.id);
      continue;
    }
    if (!(await canSendToWhatsAppDestination(request.groupJid))) continue;

    const ordinal = request.remindersSent + 1;
    const dayCount = Math.max(1, Math.floor((now.getTime() - request.sentAt.getTime()) / DAY_MS));
    const title = request.task?.title ?? request.fileName ?? "el contenido";
    const dedupeKey = `appr:${request.id}:${ordinal}`;
    const body = approvalReminderText({ title: `${title} · enviado hace ${dayCount} ${dayCount === 1 ? "día" : "días"}`, variantKey: dedupeKey });

    try {
      const created = await db.$transaction(async (tx) => {
        const claimed = await tx.whatsAppApprovalRequest.updateMany({
          where: { id: request.id, status: "PENDING", remindersSent: request.remindersSent },
          data: { remindersSent: ordinal, lastReminderAt: now },
        });
        if (claimed.count !== 1) return false;
        await tx.whatsAppMessage.create({
          data: {
            to: request.groupJid,
            body,
            quotedId: request.messageId,
            kind: "APPROVAL_REMINDER",
            dedupeKey,
            status: "PENDING",
            scheduledFor: now,
          },
        });
        return true;
      });
      if (created) enqueued++;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      // Do not write group names, phone numbers, messages, or secret-bearing DB errors to logs.
    }
  }
  return { checked, enqueued };
}

async function cancelQueuedApprovalReminders(requestId: string) {
  await db.whatsAppMessage.updateMany({
    where: {
      kind: "APPROVAL_REMINDER",
      status: "PENDING",
      dedupeKey: { startsWith: `appr:${requestId}:` },
    },
    data: { status: "CANCELLED" },
  });
}
