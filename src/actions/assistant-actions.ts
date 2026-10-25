"use server";

import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";
import { hashDraftToken, verifyDraftToken } from "@/lib/assistant/drafts";
import { createExpense, createTransaction } from "@/actions/finance-actions";
import { createTask } from "@/actions/content-actions";
import { createShooting } from "@/actions/shooting-actions";
import { enqueueWhatsApp, setWhatsAppPaused } from "@/lib/whatsapp";
import { appendSystemReviewNote } from "@/lib/content-review";

/**
 * Ejecuta un borrador del asistente que el usuario confirmó.
 *
 * Idempotente: el hash del borrador es único en AiActionLog, así que un doble
 * clic o un reintento no crea dos registros. La escritura pasa por las mismas
 * server actions que usa la app, con sus validaciones y permisos.
 */
export async function confirmAssistantDraft(
  token: string
): Promise<ApiResponse<{ resultId: string | null; alreadyDone?: boolean }>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: "No autorizado" };

  const verified = verifyDraftToken(token, userId);
  if (!verified.ok) return { success: false, error: verified.error };
  const { action, input } = verified.payload;
  if (["enviarWhatsApp", "pausarBot", "marcarAprobado"].includes(action)) {
    const actor = await db.user.findUnique({ where: { id: userId }, select: { roleCode: true } });
    if (actor?.roleCode !== "ADMIN") return { success: false, error: "Solo un administrador puede confirmar acciones de WhatsApp." };
  }

  const draftHash = hashDraftToken(token);
  let logId: string;
  try {
    const log = await db.aiActionLog.create({
      data: { draftHash, action, payload: JSON.stringify(input), userId },
    });
    logId = log.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.aiActionLog.findUnique({ where: { draftHash } });
      if (existing?.status === "DONE") {
        return { success: true, data: { resultId: existing.resultId, alreadyDone: true } };
      }
      return { success: false, error: "Esta acción ya se está procesando" };
    }
    throw error;
  }

  let result: ApiResponse<unknown>;
  try {
    if (action === "crearGasto") result = await createExpense(input);
    else if (action === "crearTarea") result = await createTask(input);
    else if (action === "crearRodaje") {
      result = await createShooting({
        // El borrador viaja como JSON: las fechas llegan como texto.
        ...(input as { title: string; clientId: string; address?: string; notes?: string; crewIds?: string[] }),
        startTime: new Date(String(input.startTime)),
        endTime: new Date(String(input.endTime)),
      });
    } else if (action === "enviarWhatsApp") {
      const queued = await enqueueWhatsApp({
        to: String(input.to ?? ""),
        body: String(input.body ?? ""),
        kind: String(input.kind ?? "MANUAL"),
        dedupeKey: String(input.dedupeKey ?? draftHash),
        quotedId: typeof input.quotedId === "string" ? input.quotedId : null,
        createdById: userId,
        approvedById: userId,
      });
      result = { success: true, data: { id: queued.id } };
    } else if (action === "pausarBot") {
      await setWhatsAppPaused(input.pausado === true);
      result = { success: true, data: { id: null } };
    } else if (action === "marcarAprobado") {
      result = await approveTaskFromAssistant(String(input.taskId ?? ""), userId);
    } else result = await createTransaction(input);
  } catch {
    // Avoid exposing database, phone, or transport details to the client.
    result = { success: false, error: "No se pudo ejecutar la acción. El borrador quedó disponible para volver a intentarlo." };
  }

  const resultId =
    result.success && result.data && typeof result.data === "object" && "id" in result.data
      ? String((result.data as { id: unknown }).id)
      : null;

  await db.aiActionLog.update({
    where: { id: logId },
    data: result.success
      ? { status: "DONE", resultId }
      : { status: "FAILED", error: result.error ?? "Error desconocido" },
  });

  if (!result.success) {
    // Libera el hash para que el usuario pueda reintentar el mismo borrador.
    await db.aiActionLog.update({ where: { id: logId }, data: { draftHash: `${draftHash}:failed:${logId}` } });
    return { success: false, error: result.error ?? "No se pudo ejecutar la acción" };
  }

  return { success: true, data: { resultId } };
}

async function approveTaskFromAssistant(taskId: string, userId: string): Promise<ApiResponse<{ id: string }>> {
  if (!taskId) return { success: false, error: "La tarea ya no está pendiente de aprobación del cliente." };
  const approved = await db.$transaction(async (tx) => {
    const task = await tx.contentTask.findFirst({
      where: { id: taskId, status: "REVIEW_CLIENT" },
      select: {
        id: true, title: true, clientId: true, clientFeedback: true,
        assignedEditorId: true, assignedCommunityId: true,
      },
    });
    if (!task) return null;
    const changed = await tx.contentTask.updateMany({
      where: { id: task.id, clientId: task.clientId, status: "REVIEW_CLIENT" },
      data: {
        status: "CLIENT_APPROVED",
        clientFeedback: appendSystemReviewNote(task.clientFeedback, `Aprobada desde el asistente por ${userId}`),
      },
    });
    if (changed.count !== 1) return null;

    const requests = await tx.whatsAppApprovalRequest.findMany({
      where: { taskId: task.id, status: "PENDING" },
      select: { id: true, groupJid: true, messageId: true },
    });
    const groups = requests.length
      ? await tx.whatsAppGroup.findMany({ where: { jid: { in: requests.map((request) => request.groupJid) } }, select: { jid: true, clientId: true } })
      : [];
    const matchingJids = new Set(groups.filter((group) => group.clientId === task.clientId).map((group) => group.jid));
    const matchingRequests = requests.filter((request) => matchingJids.has(request.groupJid));
    for (const approval of matchingRequests) {
      const resolved = await tx.whatsAppApprovalRequest.updateMany({
        where: { id: approval.id, taskId: task.id, status: "PENDING" },
        data: { status: "APPROVED", resolvedByJid: `assistant:${userId}`, resolvedText: "Aprobada desde Totem", resolvedAt: new Date() },
      });
      if (resolved.count !== 1) throw new Error("La aprobación cambió durante la decisión");
    }
    await tx.whatsAppEvent.create({ data: { type: "APPROVAL", payload: { taskId: task.id, actor: "assistant", userId } } });
    return {
      task,
      recipients: [...new Set([task.assignedEditorId, task.assignedCommunityId].filter((id): id is string => Boolean(id)))],
      requests: matchingRequests,
    };
  });
  if (!approved) return { success: false, error: "La tarea ya no está pendiente de aprobación del cliente." };

  // Notifications and group confirmations are best-effort effects after the
  // atomic task/request update. They must not turn a completed approval into a
  // failed assistant action if a push provider is temporarily unavailable.
  try {
    const { sendNotification } = await import("@/lib/system-notifications");
    await Promise.allSettled(approved.recipients.map((recipient) => sendNotification({
      userId: recipient,
      message: `El contenido “${approved.task.title}” fue aprobado por el cliente.`,
      type: "TASK_CLIENT_APPROVED",
      createdBy: userId,
    })));
    if (approved.recipients.length) {
      const { sendPushNotification } = await import("@/lib/system-push");
      await sendPushNotification({ title: "Contenido aprobado", message: `“${approved.task.title}” fue aprobado por el cliente.`, userIds: approved.recipients, url: "/content" });
    }
  } catch {
    // Notification delivery is best effort; do not log user or content data.
  }
  try {
    const { canSendToWhatsAppDestination } = await import("@/lib/whatsapp/enqueue");
    for (const approval of approved.requests) {
      if (!(await canSendToWhatsAppDestination(approval.groupJid))) continue;
      await enqueueWhatsApp({
        to: approval.groupJid,
        body: `🤖 Totem Bot: ¡Gracias! Registramos “${approved.task.title}” como aprobado ✅`,
        kind: "APPROVAL_CONFIRM",
        dedupeKey: `approval-confirm:${approval.id}`,
        quotedId: approval.messageId,
        createdById: userId,
        approvedById: userId,
      });
    }
  } catch {
    // WhatsApp remains guarded by the central queue and worker.
  }
  return { success: true, data: { id: approved.task.id } };
}
