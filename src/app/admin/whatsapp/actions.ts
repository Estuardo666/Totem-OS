"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { resolveRoleCode } from "@/lib/roles";
import { appendSystemReviewNote } from "@/lib/content-review";
import { revalidatePath } from "next/cache";
import { setWhatsAppConfigValue, setWhatsAppPaused } from "@/lib/whatsapp";
import { applyOwnerPromptAnswer } from "@/lib/whatsapp/decisions";

const PAGE = "/admin/whatsapp";
const BOT_PHONE = "593994782827";

function requireText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" || value.length > maxLength) throw new Error(`${label} no es válido.`);
  return value.trim();
}

function normalizePhone(value: unknown, label: string, optional = false): string | null {
  const raw = requireText(value, label, 32);
  if (!raw && optional) return null;
  if (!raw || !/^\+?[\d\s().-]+$/.test(raw)) throw new Error(`Escribe un teléfono válido para ${label.toLowerCase()}.`);
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `593${digits.slice(1)}`;
  if (digits.length < 10 || digits.length > 15) throw new Error(`Escribe un teléfono válido para ${label.toLowerCase()} con código de país.`);
  return digits;
}

function requireId(value: unknown, label: string): string {
  const id = requireText(value, label, 128);
  if (!id) throw new Error(`${label} no es válido.`);
  return id;
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Inicia sesión para continuar.");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, roleCode: true, roleLegacy: true } });
  if (!user || resolveRoleCode(user) !== "ADMIN") throw new Error("Solo ADMIN puede administrar WhatsApp.");
  return user;
}

export async function pauseWhatsAppAction(paused: boolean) {
  await requireAdmin();
  if (typeof paused !== "boolean") throw new Error("Estado de pausa inválido.");
  await setWhatsAppPaused(paused);
  revalidatePath(PAGE);
  return { success: true };
}

export async function saveWhatsAppGeneralConfigAction(input: {
  ownerPhone: string; approvalReminderHours: number; maxApprovalReminders: number;
  skipWeekends: boolean; teamDailyHour: string; amountsInGroups: boolean;
}) {
  await requireAdmin();
  if (!input || typeof input !== "object") throw new Error("Configuración inválida.");
  const normalizedPhone = normalizePhone(input.ownerPhone, "Teléfono del dueño");
  if (normalizedPhone === BOT_PHONE) throw new Error("El teléfono del dueño debe ser distinto al número del bot.");
  if (typeof input.skipWeekends !== "boolean" || typeof input.amountsInGroups !== "boolean") throw new Error("Las opciones de configuración deben ser verdaderas o falsas.");
  if (!Number.isInteger(input.approvalReminderHours) || input.approvalReminderHours < 1 || input.approvalReminderHours > 168) throw new Error("Las horas deben estar entre 1 y 168.");
  if (!Number.isInteger(input.maxApprovalReminders) || input.maxApprovalReminders < 0 || input.maxApprovalReminders > 2) throw new Error("El máximo de recordatorios debe estar entre 0 y 2.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.teamDailyHour)) throw new Error("Usa una hora válida, por ejemplo 08:00.");
  await Promise.all([
    setWhatsAppConfigValue("ownerPhone", normalizedPhone),
    setWhatsAppConfigValue("approvalReminderHours", input.approvalReminderHours),
    setWhatsAppConfigValue("maxApprovalReminders", input.maxApprovalReminders),
    setWhatsAppConfigValue("skipWeekends", input.skipWeekends),
    setWhatsAppConfigValue("teamDailyHour", input.teamDailyHour),
    setWhatsAppConfigValue("amountsInGroups", input.amountsInGroups),
  ]);
  revalidatePath(PAGE);
  return { success: true };
}

export async function updateWhatsAppGroupAction(input: {
  id: string; clientId: string | null; purposes: string[]; aiMode: string; approvalMode: string; enabled: boolean;
}) {
  await requireAdmin();
  if (!input || typeof input !== "object" || !Array.isArray(input.purposes) || typeof input.enabled !== "boolean") throw new Error("Configuración de grupo inválida.");
  const id = requireId(input.id, "Grupo");
  if (input.clientId !== null && typeof input.clientId !== "string") throw new Error("Cliente inválido.");
  if (input.clientId && input.clientId.length > 128) throw new Error("Cliente inválido.");
  const purposes = [...new Set(input.purposes)];
  const allowedPurposes = new Set(["SHOOT", "PAYMENT", "APPROVAL", "AI_QA"]);
  if (purposes.some((purpose) => !allowedPurposes.has(purpose))) throw new Error("Configuración de grupo inválida.");
  if (!["OFF", "DRAFT", "AUTO"].includes(input.aiMode) || !["OFF", "DRAFT", "AUTO"].includes(input.approvalMode)) throw new Error("Modo de grupo inválido.");
  const current = await db.whatsAppGroup.findUnique({ where: { id }, select: { jid: true, clientId: true, aiMode: true, approvalMode: true } });
  if (!current) throw new Error("El grupo ya no existe.");
  if (input.aiMode === "AUTO" && current.aiMode !== "AUTO" || input.approvalMode === "AUTO" && current.approvalMode !== "AUTO") throw new Error("El modo AUTO solo se activa desde una decisión elegible del dueño.");
  const nextClientId = input.clientId || null;
  const reassigned = current.clientId !== nextClientId;
  await db.$transaction(async (tx) => {
    const changed = await tx.whatsAppGroup.updateMany({
      where: { id, clientId: current.clientId },
      data: {
        clientId: nextClientId,
        purposes,
        aiMode: reassigned ? (current.aiMode === "OFF" ? "OFF" : "DRAFT") : input.aiMode,
        approvalMode: reassigned ? (current.approvalMode === "OFF" ? "OFF" : "DRAFT") : input.approvalMode,
        enabled: input.enabled,
      },
    });
    if (changed.count !== 1) throw new Error("El grupo cambió mientras se guardaba. Actualiza e inténtalo de nuevo.");
    if (!reassigned) return;

    await tx.whatsAppMessage.updateMany({ where: { to: current.jid, status: { in: ["PENDING", "DRAFT"] } }, data: { status: "CANCELLED" } });
    await tx.whatsAppOwnerPrompt.updateMany({
      where: { status: "OPEN", payload: { path: ["groupJid"], equals: current.jid } },
      data: { status: "EXPIRED" },
    });
    await tx.whatsAppEvent.create({
      data: {
        type: "GROUP_REASSIGNED",
        groupJid: current.jid,
        payload: { oldClientId: current.clientId, newClientId: nextClientId },
      },
    });
  });
  revalidatePath(PAGE);
  return { success: true };
}

export async function updateWhatsAppTeamMemberAction(input: { id: string; phone: string; optedIn: boolean; activeSchedule: string }) {
  await requireAdmin();
  if (!input || typeof input !== "object" || typeof input.optedIn !== "boolean") throw new Error("Datos del equipo inválidos.");
  const id = requireId(input.id, "Usuario");
  const phone = normalizePhone(input.phone, "Teléfono", true);
  const scheduleText = requireText(input.activeSchedule, "Horario activo", 2000);
  let activeSchedule: unknown = null;
  if (scheduleText) {
    try { activeSchedule = JSON.parse(scheduleText); }
    catch { throw new Error("El horario activo debe ser JSON válido."); }
    if (!isSupportedSchedule(activeSchedule)) {
      throw new Error("Usa un horario válido: weekdays con días 1–7 o monthRange con días del mes 1–31.");
    }
  }
  await db.user.update({ where: { id }, data: { phone, whatsappOptIn: input.optedIn, activeSchedule: activeSchedule === null ? Prisma.JsonNull : activeSchedule as Prisma.InputJsonValue } });
  revalidatePath(PAGE);
  return { success: true };
}

function isSupportedSchedule(value: unknown): value is Prisma.InputJsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const schedule = value as Record<string, unknown>;
  if (schedule.type === "weekdays") {
    if (Object.keys(schedule).some((key) => key !== "type" && key !== "days")) return false;
    return Array.isArray(schedule.days)
      && schedule.days.length > 0
      && schedule.days.length <= 7
      && schedule.days.every((day) => Number.isInteger(day) && (day as number) >= 1 && (day as number) <= 7)
      && new Set(schedule.days).size === schedule.days.length;
  }
  if (schedule.type === "monthRange") {
    if (Object.keys(schedule).some((key) => !["type", "from", "to"].includes(key))) return false;
    return Number.isInteger(schedule.from) && Number.isInteger(schedule.to)
      && (schedule.from as number) >= 1 && (schedule.from as number) <= 31
      && (schedule.to as number) >= 1 && (schedule.to as number) <= 31
      && (schedule.from as number) <= (schedule.to as number);
  }
  return false;
}

export async function updateWhatsAppClientAction(input: { id: string; phone: string; target: string; reminderHours: number }) {
  await requireAdmin();
  if (!input || typeof input !== "object") throw new Error("Datos del cliente inválidos.");
  const id = requireId(input.id, "Cliente");
  const phone = normalizePhone(input.phone, "Teléfono WhatsApp", true);
  if (!["GROUP", "PERSONAL"].includes(input.target)) throw new Error("Destino de cobro inválido.");
  if (!Number.isInteger(input.reminderHours) || input.reminderHours < 1 || input.reminderHours > 168) throw new Error("Las horas deben estar entre 1 y 168.");
  await db.client.update({ where: { id }, data: { whatsappPhone: phone, paymentReminderTarget: input.target, approvalReminderHours: input.reminderHours } });
  revalidatePath(PAGE);
  return { success: true };
}

export async function decideOwnerPromptAction(id: string, answer: string) {
  await requireAdmin();
  id = requireId(id, "Decisión");
  answer = requireText(answer, "Opción", 3);
  if (!/^\d+$/.test(answer)) throw new Error("Selecciona una opción válida.");
  const prompt = await db.whatsAppOwnerPrompt.findUnique({ where: { id } });
  if (!prompt || prompt.status !== "OPEN" || prompt.expiresAt <= new Date()) throw new Error("La decisión ya no está disponible.");
  const options = Array.isArray(prompt.options) ? prompt.options : [];
  const option = options[Number(answer) - 1];
  if (!option) throw new Error("Esa opción no existe.");

  const outcome = await applyOwnerPromptAnswer({ id, answer });
  if (outcome.applied === false) throw new Error("No se pudo aplicar la decisión; actualiza la bandeja e inténtalo de nuevo.");
  revalidatePath(PAGE);
  return { success: true };
}

export async function saveWhatsAppDraftAction(id: string, body: string, send: boolean) {
  const admin = await requireAdmin();
  id = requireId(id, "Borrador");
  body = requireText(body, "Mensaje", 8192);
  if (typeof send !== "boolean") throw new Error("Acción del borrador inválida.");
  const message = await db.whatsAppMessage.findUnique({ where: { id }, select: { id: true, status: true, body: true, kind: true } });
  if (!message || message.status !== "DRAFT") throw new Error("El borrador ya no está disponible.");
  let trimmedBody = body.trim();
  if (message.kind === "AI_REPLY" && !trimmedBody.startsWith("🤖 Totem Bot: ")) trimmedBody = `🤖 Totem Bot: ${trimmedBody}`;
  if (trimmedBody.length > 4096) throw new Error("El mensaje supera el límite de 4096 caracteres.");
  if (send && !trimmedBody) throw new Error("El mensaje no puede quedar vacío.");
  const changed = trimmedBody !== message.body.trim();
  const prompts = await db.whatsAppOwnerPrompt.findMany({ where: { type: "AI_DRAFT", status: "OPEN", expiresAt: { gt: new Date() } } });
  const related = prompts.find((prompt) => (prompt.payload as { messageId?: string }).messageId === id);
  if (related) {
    await db.$transaction(async (tx) => {
      await tx.whatsAppMessage.update({ where: { id }, data: { body: trimmedBody } });
      if (changed) {
        const payload = related.payload as Record<string, unknown>;
        await tx.whatsAppOwnerPrompt.update({ where: { id: related.id }, data: { payload: { ...payload, edited: true } } });
      }
    });
    if (send) {
      const outcome = await applyOwnerPromptAnswer({ id: related.id, answer: "1" });
      if (outcome.applied === false) throw new Error("No se pudo enviar el borrador.");
    }
  } else {
    await db.whatsAppMessage.update({ where: { id }, data: { body: trimmedBody, status: send ? "PENDING" : "DRAFT", approvedById: send ? admin.id : null } });
  }
  revalidatePath(PAGE);
  return { success: true };
}

export async function discardWhatsAppDraftAction(id: string) {
  await requireAdmin();
  id = requireId(id, "Borrador");
  const message = await db.whatsAppMessage.findFirst({ where: { id, status: "DRAFT" }, select: { id: true } });
  if (!message) throw new Error("El borrador ya no está disponible.");
  const prompts = await db.whatsAppOwnerPrompt.findMany({ where: { type: "AI_DRAFT", status: "OPEN", expiresAt: { gt: new Date() } } });
  const related = prompts.find((prompt) => (prompt.payload as { messageId?: string }).messageId === id);
  if (related) {
    const outcome = await applyOwnerPromptAnswer({ id: related.id, answer: "2" });
    if (outcome.applied === false) throw new Error("No se pudo descartar el borrador.");
  }
  else await db.whatsAppMessage.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath(PAGE);
  return { success: true };
}

export async function undoWhatsAppApprovalAction(id: string) {
  const admin = await requireAdmin();
  id = requireId(id, "Aprobación");
  await db.$transaction(async (tx) => {
    const request = await tx.whatsAppApprovalRequest.findUnique({ where: { id } });
    if (!request || request.status !== "APPROVED" || !request.taskId || !request.previousTaskStatus) throw new Error("No se puede deshacer esta aprobación.");
    const task = await tx.contentTask.findUnique({ where: { id: request.taskId }, select: { status: true, clientFeedback: true } });
    if (!task || task.status !== "CLIENT_APPROVED") throw new Error("La tarea cambió desde la aprobación y no se puede restaurar automáticamente.");
    const restored = await tx.contentTask.updateMany({ where: { id: request.taskId, status: "CLIENT_APPROVED" }, data: { status: request.previousTaskStatus, clientFeedback: appendSystemReviewNote(task.clientFeedback, "Aprobación de WhatsApp deshecha por administrador.") } });
    if (restored.count !== 1) throw new Error("La tarea cambió durante el deshacer.");
    const reopened = await tx.whatsAppApprovalRequest.updateMany({ where: { id, status: "APPROVED", taskId: request.taskId, previousTaskStatus: request.previousTaskStatus }, data: { status: "PENDING", resolvedAt: null, resolvedByJid: null, resolvedText: null } });
    if (reopened.count !== 1) throw new Error("La aprobación cambió durante el deshacer.");
    await tx.whatsAppMessage.updateMany({ where: { dedupeKey: `approval-confirm:${id}`, status: "PENDING" }, data: { status: "CANCELLED" } });
    await tx.whatsAppEvent.create({ data: { type: "APPROVAL", groupJid: request.groupJid, payload: { requestId: id, action: "UNDO", userId: admin.id } } });
  });
  revalidatePath(PAGE);
  return { success: true };
}

export async function filterWhatsAppHistoryAction(filter: { kind?: string; status?: string }) {
  await requireAdmin();
  return db.whatsAppMessage.findMany({
    where: { ...(filter.kind ? { kind: filter.kind } : {}), ...(filter.status ? { status: filter.status } : {}) },
    orderBy: { createdAt: "desc" }, take: 200,
  });
}
