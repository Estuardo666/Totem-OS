import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { appendSystemReviewNote } from "@/lib/content-review";
import { canSendToWhatsAppDestination, normalizePhone } from "./enqueue";
import { getWhatsAppConfig } from "./config";
import { isWhatsAppPromotionEligible } from "./rollout";
import { recordWhatsAppEvent } from "./audit";

const TASK_PICK_STATUSES = ["EDITING", "REVIEW_INTERNAL", "REVIEW_CLIENT", "RECORDED"];

/** Single transactional decision path shared by the worker and admin UI. */
export async function applyOwnerPromptAnswer(input: { id: string; answer: string; fromJid?: string }) {
  const answer = input.answer.trim().toLowerCase();
  if (!answer) throw new Error("Respuesta vacía");
  if (input.fromJid) {
    const config = await getWhatsAppConfig();
    const fromNumber = input.fromJid.endsWith("@s.whatsapp.net") ? input.fromJid.slice(0, -"@s.whatsapp.net".length) : "";
    if (!config.ownerPhone || normalizePhone(fromNumber) !== normalizePhone(config.ownerPhone)) throw new Error("Solo el dueño puede responder por WhatsApp");
  }
  const now = new Date();

  const outcome = await db.$transaction(async (tx) => {
    const prompt = await tx.whatsAppOwnerPrompt.findUnique({ where: { id: input.id } });
    if (!prompt || prompt.status !== "OPEN" || prompt.expiresAt <= now) throw new Error("Prompt vencido o ya respondido");
    const payload = prompt.payload as Record<string, unknown>;
    const choice = numericChoice(answer, prompt.id);
    const options = Array.isArray(prompt.options) ? prompt.options : [];
    if (choice !== null && choice > options.length) throw new Error("Opción inválida para este prompt");
    if (choice === null && !["si", "sí", "yes", "no", "aprobar", "descartar"].includes(answer)) {
      throw new Error("Respuesta inválida para este prompt");
    }
    if (prompt.type === "APPROVAL_DRAFT" && choice === 3) {
      return { type: prompt.type, applied: false, noAction: true, url: "/admin/whatsapp" };
    }

    // Claim the prompt inside the same transaction as the requested mutation.
    // A failed/stale action rolls this claim back, leaving the prompt reviewable.
    const claimed = await tx.whatsAppOwnerPrompt.updateMany({
      where: { id: prompt.id, status: "OPEN", expiresAt: { gt: now } },
      data: { status: "ANSWERED", answer },
    });
    if (claimed.count !== 1) throw new Error("Prompt vencido o ya respondido");

    let result: Record<string, unknown>;
    if (prompt.type === "APPROVAL_DRAFT") {
      result = await decideApprovalDraft(tx, payload, choice, now);
    } else if (prompt.type === "AI_DRAFT") {
      const messageId = String(payload.messageId ?? "");
      if (!messageId) throw new Error("El borrador no tiene mensaje asociado");
      const message = await tx.whatsAppMessage.findUnique({ where: { id: messageId } });
      if (!message || message.status !== "DRAFT") throw new Error("El borrador ya no está disponible");
      const nextStatus = choice === 1 ? "PENDING" : "CANCELLED";
      const changed = await tx.whatsAppMessage.updateMany({ where: { id: messageId, status: "DRAFT" }, data: { status: nextStatus, approvedById: choice === 1 ? "owner" : null } });
      if (changed.count !== 1) throw new Error("El borrador ya no está disponible");
      result = { type: prompt.type, applied: true, sent: choice === 1 };
    } else if (prompt.type === "TASK_PICK") {
      result = await decideTaskPick(tx, payload, choice, now);
    } else if (prompt.type === "GROUP_MATCH") {
      result = await decideGroupMatch(tx, payload, choice);
    } else if (prompt.type === "ENABLE_CLIENTS") {
      result = await decideEnableClients(tx, payload, choice);
    } else if (prompt.type === "PROMOTE_AUTO") {
      result = await decidePromotion(tx, payload, choice, now);
    } else {
      // Alerts and unknown prompts can be acknowledged without side effects.
      result = { type: prompt.type, applied: true, noAction: true };
    }

    await tx.whatsAppEvent.create({
      data: {
        type: "OWNER_ANSWER",
        payload: { promptId: prompt.id, answer, outcome: result } as Prisma.InputJsonValue,
      },
    });
    return result;
  });

  await notifyApprovalParticipants(outcome);
  return outcome;
}

/** Atomic resolution for client replies in AUTO groups; shared by the worker. */
export async function applyWhatsAppClientDecision(input: {
  requestId: string;
  intent: "APPROVE" | "CHANGES";
  senderJid: string;
  text?: string | null;
}) {
  const now = new Date();
  const outcome = await db.$transaction(async (tx) => {
    const outcome = await resolveApprovalDecision(tx, {
      requestId: input.requestId,
      intent: input.intent,
      resolvedByJid: input.senderJid,
      text: input.text ?? "",
      now,
    });
    await tx.whatsAppEvent.create({
      data: {
        type: input.intent === "APPROVE" ? "APPROVAL" : "CHANGES",
        groupJid: typeof outcome.groupJid === "string" ? outcome.groupJid : null,
        payload: { requestId: input.requestId, intent: input.intent } as Prisma.InputJsonValue,
      },
    });
    return outcome;
  });
  await notifyApprovalParticipants(outcome);
  return outcome;
}

async function decideApprovalDraft(
  tx: Prisma.TransactionClient,
  payload: Record<string, unknown>,
  choice: number | null,
  now: Date,
) {
  // The second option rejects the suggestion. It deliberately does not change
  // either the approval request or its task.
  if (choice !== 1) return { type: "APPROVAL_DRAFT", applied: true, noAction: true };
  return resolveApprovalDecision(tx, {
    requestId: String(payload.requestId ?? ""),
    intent: payload.intent === "CHANGES" ? "CHANGES" : "APPROVE",
    resolvedByJid: "owner",
    text: String(payload.text ?? ""),
    now,
  });
}

async function resolveApprovalDecision(
  tx: Prisma.TransactionClient,
  input: { requestId: string; intent: "APPROVE" | "CHANGES"; resolvedByJid: string; text: string; now: Date },
) {
  const request = await tx.whatsAppApprovalRequest.findUnique({ where: { id: input.requestId } });
  if (!request || request.status !== "PENDING" || !request.taskId) throw new Error("La aprobación ya no está pendiente");
  const group = await tx.whatsAppGroup.findUnique({ where: { jid: request.groupJid }, select: { clientId: true } });
  if (!group?.clientId) throw new Error("El grupo ya no está asignado a un cliente");
  const task = await tx.contentTask.findUnique({ where: { id: request.taskId } });
  if (!task || task.clientId !== group.clientId || task.status !== "REVIEW_CLIENT") {
    throw new Error("La tarea cambió o ya no pertenece al cliente del grupo");
  }

  const isChangeRequest = input.intent === "CHANGES";
  const requestUpdated = await tx.whatsAppApprovalRequest.updateMany({
    where: { id: request.id, status: "PENDING", taskId: task.id },
    data: { status: isChangeRequest ? "CHANGES" : "APPROVED", resolvedByJid: input.resolvedByJid, resolvedText: input.text.slice(0, 4000), resolvedAt: input.now },
  });
  if (requestUpdated.count !== 1) throw new Error("La aprobación cambió durante la decisión");
  const taskUpdated = await tx.contentTask.updateMany({
    where: { id: task.id, clientId: group.clientId, status: "REVIEW_CLIENT" },
    data: {
      status: isChangeRequest ? "EDITING" : "CLIENT_APPROVED",
      clientFeedback: appendSystemReviewNote(task.clientFeedback, isChangeRequest
        ? `Cambios solicitados por WhatsApp: ${input.text.slice(0, 4000)}`
        : `Cliente aprobó por WhatsApp: ${task.title}`),
    },
  });
  if (taskUpdated.count !== 1) throw new Error("La tarea cambió durante la decisión");

  if (!isChangeRequest && await canSendToWhatsAppDestination(request.groupJid, tx)) {
    await tx.whatsAppMessage.create({ data: {
      to: request.groupJid,
      body: `🤖 Totem Bot: ¡Gracias! Registramos “${task.title}” como aprobado ✅`,
      kind: "APPROVAL_CONFIRM",
      status: "PENDING",
      dedupeKey: `approval-confirm:${request.id}`,
      quotedId: request.messageId,
    } });
  }
  return {
    type: "APPROVAL",
    applied: true,
    changes: isChangeRequest,
    requestId: request.id,
    taskId: task.id,
    groupJid: request.groupJid,
    taskTitle: task.title,
    notifyUserIds: [...new Set([task.assignedEditorId, task.assignedCommunityId].filter((id): id is string => Boolean(id)))],
  };
}

async function notifyApprovalParticipants(outcome: Record<string, unknown>) {
  if (process.env.WA_FUNCTIONAL_TEST_ONLY === "1") return;
  const requestId = typeof outcome.requestId === "string" ? outcome.requestId : null;
  if (!requestId) return;
  if (process.env.TOTEM_WHATSAPP_WORKER === "1") {
    const baseUrl = process.env.APP_API_URL || process.env.TOTEM_API_URL;
    const secret = process.env.WA_WORKER_SECRET;
    if (!baseUrl || !secret) {
      await recordWhatsAppEvent({ type: "NOTIFICATION_FAILED", groupJid: typeof outcome.groupJid === "string" ? outcome.groupJid : null, payload: { requestId, event: "APPROVAL_RESOLVED", reason: "INTERNAL_NOTIFICATION_NOT_CONFIGURED" } }).catch(() => undefined);
      return;
    }
    try {
      const endpoint = new URL("/api/internal/whatsapp/notify", baseUrl);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({ event: "APPROVAL_RESOLVED", requestId }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        await recordWhatsAppEvent({ type: "NOTIFICATION_FAILED", groupJid: typeof outcome.groupJid === "string" ? outcome.groupJid : null, payload: { requestId, event: "APPROVAL_RESOLVED", reason: "INTERNAL_NOTIFICATION_REJECTED" } }).catch(() => undefined);
      }
    } catch {
      await recordWhatsAppEvent({ type: "NOTIFICATION_FAILED", groupJid: typeof outcome.groupJid === "string" ? outcome.groupJid : null, payload: { requestId, event: "APPROVAL_RESOLVED", reason: "INTERNAL_NOTIFICATION_UNAVAILABLE" } }).catch(() => undefined);
    }
    return;
  } else {
    const userIds = Array.isArray(outcome.notifyUserIds) ? outcome.notifyUserIds.filter((id): id is string => typeof id === "string") : [];
    const title = typeof outcome.taskTitle === "string" ? outcome.taskTitle : null;
    if (!userIds.length || !title) return;
    const changed = outcome.changes === true;
    const message = changed
      ? `El cliente pidió cambios para “${title}”. Revisa los comentarios en Totem.`
      : `El cliente aprobó “${title}”.`;
    try {
      const { sendNotification } = await import("@/actions/notification-actions");
      await Promise.allSettled(userIds.map((userId) => sendNotification({ userId, message, type: changed ? "TASK_CLIENT_CHANGES" : "TASK_CLIENT_APPROVED" })));
      const { sendPushNotification } = await import("@/actions/push-actions");
      await sendPushNotification({ title: changed ? "Cambios solicitados" : "Contenido aprobado", message, userIds, url: "/content" });
    } catch {
      // Notifications do not roll back the already committed approval decision.
    }
  }
}

async function decideTaskPick(tx: Prisma.TransactionClient, payload: Record<string, unknown>, choice: number | null, now: Date) {
  const candidates = Array.isArray(payload.candidates)
    ? payload.candidates as Array<{ taskId?: string; score?: number }>
    : [];
  const selectedCandidate = choice ? candidates[choice - 1] : undefined;
  const selected = selectedCandidate?.taskId;
  if (!selected) return { type: "TASK_PICK", applied: true, noAction: true };

  const requestId = String(payload.requestId ?? "");
  const request = await tx.whatsAppApprovalRequest.findFirst({ where: { id: requestId, status: "UNMATCHED" } });
  if (!request) throw new Error("La solicitud de aprobación ya no está disponible");
  const group = await tx.whatsAppGroup.findUnique({ where: { jid: request.groupJid }, select: { clientId: true } });
  if (!group?.clientId) throw new Error("El grupo ya no está asignado a un cliente");
  const task = await tx.contentTask.findFirst({
    where: {
      id: selected,
      clientId: group.clientId,
      status: { in: TASK_PICK_STATUSES },
      updatedAt: { gte: new Date(now.getTime() - 60 * 86_400_000) },
    },
  });
  if (!task) throw new Error("La tarea ya no es candidata para este grupo");

  const changedRequest = await tx.whatsAppApprovalRequest.updateMany({
    where: { id: request.id, status: "UNMATCHED", taskId: null },
    data: {
      taskId: task.id,
      status: "PENDING",
      previousTaskStatus: task.status,
      matchScore: typeof selectedCandidate.score === "number" ? selectedCandidate.score : null,
    },
  });
  if (changedRequest.count !== 1) throw new Error("La solicitud cambió durante la selección");
  const changedTask = await tx.contentTask.updateMany({
    where: { id: task.id, clientId: group.clientId, status: task.status, updatedAt: task.updatedAt },
    data: { status: "REVIEW_CLIENT", clientFeedback: appendSystemReviewNote(task.clientFeedback, "Enviado al cliente por WhatsApp") },
  });
  if (changedTask.count !== 1) throw new Error("La tarea cambió durante la selección");
  return { type: "TASK_PICK", applied: true, taskId: task.id };
}

async function decideGroupMatch(tx: Prisma.TransactionClient, payload: Record<string, unknown>, choice: number | null) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates as Array<{ id?: string }> : [];
  const clientId = choice ? candidates[choice - 1]?.id : undefined;
  if (!clientId) return { type: "GROUP_MATCH", applied: true, noAction: true };
  const groupJid = String(payload.groupJid ?? "");
  const result = await tx.whatsAppGroup.updateMany({ where: { jid: groupJid, clientId: null }, data: { clientId } });
  if (result.count !== 1) throw new Error("El grupo ya fue asignado o no existe");
  return { type: "GROUP_MATCH", applied: true };
}

async function decideEnableClients(tx: Prisma.TransactionClient, payload: Record<string, unknown>, choice: number | null) {
  // A rejection only records the owner's answer. It must not silently turn
  // off a previously enabled rollout.
  if (choice !== 1) return { type: "ENABLE_CLIENTS", applied: true, noAction: true };
  await tx.globalConfig.upsert({
    where: { key: "whatsapp.clientsEnabled" },
    create: { key: "whatsapp.clientsEnabled", value: JSON.stringify(true) },
    update: { value: JSON.stringify(true) },
  });
  const groupJids = Array.isArray(payload.groupJids) ? payload.groupJids.map(String) : [];
  if (groupJids.length) {
    await tx.whatsAppGroup.updateMany({ where: { jid: { in: groupJids }, clientId: { not: null } }, data: { enabled: true } });
  }
  return { type: "ENABLE_CLIENTS", applied: true, clientsEnabled: true };
}

async function decidePromotion(tx: Prisma.TransactionClient, payload: Record<string, unknown>, choice: number | null, now: Date) {
  if (choice !== 1 && choice !== 3) return { type: "PROMOTE_AUTO", applied: true, noAction: true };
  const feature = payload.feature;
  if (feature !== "AI" && feature !== "APPROVAL") throw new Error("La promoción no especifica una función válida");
  const all = choice === 3;
  const groupJid = String(payload.groupJid ?? "");
  const groupJids = all && Array.isArray(payload.groupJids) ? payload.groupJids.map(String) : [groupJid];
  const targets = [...new Set(groupJids.filter(Boolean))];
  if (!targets.length) {
    if (all) return { type: "PROMOTE_AUTO", applied: true, noAction: true, promoted: 0 };
    throw new Error("La promoción no tiene un grupo seleccionado");
  }
  if (!all) {
    const jid = targets[0];
    if (!(await isWhatsAppPromotionEligible(jid, feature, now))) throw new Error(`El grupo ${jid} ya no cumple las métricas para AUTO`);
    const changed = await tx.whatsAppGroup.updateMany({
      where: { jid, enabled: true, clientId: { not: null }, ...(feature === "AI" ? { aiMode: "DRAFT" } : { approvalMode: "DRAFT" }) },
      data: feature === "AI" ? { aiMode: "AUTO" } : { approvalMode: "AUTO" },
    });
    if (changed.count !== 1) throw new Error(`El grupo ${jid} cambió durante la promoción`);
    return { type: "PROMOTE_AUTO", applied: true, feature, promoted: 1 };
  }

  const eligibleTargets: string[] = [];
  for (const jid of targets) {
    if (await isWhatsAppPromotionEligible(jid, feature, now)) eligibleTargets.push(jid);
  }
  if (!eligibleTargets.length) return { type: "PROMOTE_AUTO", applied: true, noAction: true, feature, promoted: 0 };
  let promoted = 0;
  for (const jid of eligibleTargets) {
    const changed = await tx.whatsAppGroup.updateMany({
      where: { jid, enabled: true, clientId: { not: null }, ...(feature === "AI" ? { aiMode: "DRAFT" } : { approvalMode: "DRAFT" }) },
      data: feature === "AI" ? { aiMode: "AUTO" } : { approvalMode: "AUTO" },
    });
    promoted += changed.count;
  }
  return { type: "PROMOTE_AUTO", applied: true, noAction: promoted === 0, feature, promoted };
}

function numericChoice(answer: string, promptId: string): number | null {
  const normalized = answer.replace(new RegExp(`^#?${escapeRegExp(promptId)}\\s+`, "i"), "").trim();
  const match = normalized.match(/^([1-9])$/);
  if (match) return Number(match[1]);
  if (["sí", "si", "yes", "aprobar"].includes(normalized)) return 1;
  if (["no", "descartar"].includes(normalized)) return 2;
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
