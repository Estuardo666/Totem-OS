/**
 * Shooting Notifications Service
 * Notificaciones relacionadas con rodajes
 * 
 * @fileoverview Lógica de notificaciones extraída de shooting-actions.ts
 */

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { db } from "@/lib/db";
import { enqueueWhatsApp, normalizePhone } from "@/lib/whatsapp/enqueue";
import { shootReminderText } from "@/lib/whatsapp/templates";

type SendNotificationInput = Parameters<typeof import("@/lib/system-notifications").sendNotification>[0];

async function sendNotification(input: SendNotificationInput) {
  const { sendNotification: action } = await import("@/lib/system-notifications");
  return action(input);
}

export interface NotificationResult {
  success: boolean;
  notifiedCount: number;
  errors: string[];
}

/**
 * Notifica a los miembros del crew sobre un nuevo rodaje
 */
export async function notifyCrewNewShooting(params: {
  shootingTitle: string;
  crewIds: string[];
  startTime: Date;
  createdBy: string;
}): Promise<NotificationResult> {
  const { shootingTitle, crewIds, startTime, createdBy } = params;
  const startTimeStr = format(startTime, "dd/MM/yyyy HH:mm", { locale: es });
  
  let notifiedCount = 0;
  const errors: string[] = [];

  for (const crewMemberId of crewIds) {
    try {
      await sendNotification({
        userId: crewMemberId,
        message: `Nuevo rodaje programado: ${shootingTitle} (${startTimeStr})`,
        type: "SHOOT_NEW",
        createdBy,
      });
      notifiedCount++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      errors.push(`Error notificando a ${crewMemberId}: ${msg}`);
    }
  }

  return { success: errors.length === 0, notifiedCount, errors };
}

/**
 * Notifica a los administradores sobre un nuevo rodaje (Pusher + PWA Push)
 */
export async function notifyAdminsNewShooting(params: {
  shootingTitle: string;
  clientName: string;
  startTime: Date;
  createdBy: string;
}): Promise<void> {
  const { shootingTitle, clientName, startTime, createdBy } = params;
  
  try {
    const { notifyAdminsWithPush } = await import("@/lib/system-notifications");
    const startTimeStr = format(startTime, "dd/MM/yyyy HH:mm", { locale: es });

    await notifyAdminsWithPush(
      "Nuevo rodaje creado",
      `Se creó un nuevo rodaje: ${shootingTitle} - ${clientName} (${startTimeStr})`,
      "ADMIN_ALERT",
      "/content/shoots",
      createdBy
    );
  } catch (error) {
    console.error("❌ Error al enviar notificaciones PUSH a admins:", error);
    // No fallar la operación si las notificaciones fallan
  }
}

/**
 * Envía recordatorios de rodajes próximos al crew
 */
export async function sendShootingReminders(params: {
  shootingId: string;
  shootingTitle: string;
  startTime: Date;
  crewIds: string[];
  clientId?: string;
  stage?: "MORNING" | "HOUR";
}): Promise<NotificationResult> {
  const { shootingId, shootingTitle, startTime, crewIds, clientId, stage = "MORNING" } = params;
  const startTimeStr = format(startTime, "dd/MM/yyyy HH:mm", { locale: es });
  
  let notifiedCount = 0;
  const errors: string[] = [];

  for (const crewMemberId of crewIds) {
    try {
      const variantKey = `shoot:${shootingId}:${stage.toLowerCase()}`;
      const date = `${stage === "MORNING" ? "hoy" : "en aproximadamente una hora"} (${startTimeStr})`;
      await sendNotification({
        userId: crewMemberId,
        message: `Recordatorio: Rodaje "${shootingTitle}" en ${startTimeStr}`,
        type: "SHOOT_REMINDER",
        createdBy: undefined, // Sistema
        whatsappKind: "SHOOT_REMINDER",
        whatsappDedupeKey: variantKey,
        whatsappBody: shootReminderText({ title: shootingTitle, date, variantKey }),
      });
      notifiedCount++;
    } catch {
      errors.push("Error notificando recordatorio al equipo");
    }
  }

  if (clientId) {
    try {
      const when = `${stage === "MORNING" ? "hoy" : "en aproximadamente una hora"} (${startTimeStr})`;
      const group = await db.whatsAppGroup.findFirst({
        where: { clientId, enabled: true, purposes: { has: "SHOOT" } },
        select: { jid: true },
      });
      if (group) {
        const dedupeKey = `shoot:${shootingId}:${stage.toLowerCase()}:${group.jid}`;
        const result = await enqueueWhatsApp({
          to: group.jid,
          body: shootReminderText({ title: shootingTitle, date: when, variantKey: dedupeKey }),
          kind: "SHOOT_REMINDER",
          dedupeKey,
        });
        if (result.created) notifiedCount++;
      }
    } catch (error) {
      errors.push(`Error encolando recordatorio WhatsApp de rodaje ${shootingId}: ${error instanceof Error ? "falló la cola" : "Error desconocido"}`);
    }
  }

  return { success: errors.length === 0, notifiedCount, errors };
}

/** Encola el recordatorio de 24h para clientes y crew con opt-in. */
export async function enqueueDueShoot24h(now = new Date()) {
  const normalWindowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const normalWindowEnd = new Date(normalWindowStart.getTime() + 15 * 60 * 1000);
  const catchUpStart = new Date(now.getTime() + 19 * 60 * 60 * 1000);
  const shoots = await db.shoot.findMany({
    where: {
      status: "SCHEDULED",
      OR: [
        { startTime: { gte: normalWindowStart, lt: normalWindowEnd } },
        { startTime: { gte: catchUpStart, lt: normalWindowStart } },
      ],
    },
    include: {
      client: { select: { name: true } },
      crew: { where: { whatsappOptIn: true, phone: { not: null } }, select: { id: true, name: true, phone: true } },
    },
    orderBy: { startTime: "asc" },
    take: 100,
  });
  let enqueued = 0;
  let destinations = 0;
  for (const shoot of shoots) {
    const when = shoot.startTime.toLocaleString("es-EC", { timeZone: "America/Guayaquil", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    const date = `${when} (${shoot.client.name})`;
    const group = await db.whatsAppGroup.findFirst({
      where: { clientId: shoot.clientId, enabled: true, purposes: { has: "SHOOT" } },
      select: { jid: true },
    });
    const recipients = [
      ...(group ? [{ to: group.jid }] : []),
      ...shoot.crew.filter((member) => member.phone).map((member) => ({ to: `${normalizePhone(member.phone!)}@s.whatsapp.net` })),
    ];
    for (const recipient of recipients) {
      destinations++;
      try {
        const dedupeKey = `shoot:${shoot.id}:24h:${recipient.to}`;
        const queued = await enqueueWhatsApp({
          to: recipient.to,
          body: shootReminderText({ title: shoot.title, date, variantKey: dedupeKey }),
          kind: "SHOOT_REMINDER",
          dedupeKey,
        });
        if (queued.created) enqueued++;
      } catch {
        // The queue applies pause, client enablement, group purpose, and opt-in guards.
      }
    }
  }
  return { shootsChecked: shoots.length, destinations, enqueued };
}

/**
 * Notifica sobre cancelación de rodaje
 */
export async function notifyShootingCancellation(params: {
  shootingTitle: string;
  crewIds: string[];
  cancelledBy: string;
}): Promise<NotificationResult> {
  const { shootingTitle, crewIds, cancelledBy } = params;
  
  let notifiedCount = 0;
  const errors: string[] = [];

  for (const crewMemberId of crewIds) {
    try {
      await sendNotification({
        userId: crewMemberId,
        message: `Rodaje cancelado: ${shootingTitle}`,
        type: "SHOOT_CANCELED",
        createdBy: cancelledBy,
      });
      notifiedCount++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      errors.push(`Error notificando a ${crewMemberId}: ${msg}`);
    }
  }

  return { success: errors.length === 0, notifiedCount, errors };
}
