/**
 * Shooting Notifications Service
 * Notificaciones relacionadas con rodajes
 * 
 * @fileoverview Lógica de notificaciones extraída de shooting-actions.ts
 */

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { sendNotification } from "@/actions/notification-actions";

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
    const { notifyAdminsWithPush } = await import("@/actions/notification-actions");
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
}): Promise<NotificationResult> {
  const { shootingTitle, startTime, crewIds } = params;
  const startTimeStr = format(startTime, "dd/MM/yyyy HH:mm", { locale: es });
  
  let notifiedCount = 0;
  const errors: string[] = [];

  for (const crewMemberId of crewIds) {
    try {
      await sendNotification({
        userId: crewMemberId,
        message: `Recordatorio: Rodaje "${shootingTitle}" en ${startTimeStr}`,
        type: "SHOOT_REMINDER",
        createdBy: undefined, // Sistema
      });
      notifiedCount++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      errors.push(`Error notificando a ${crewMemberId}: ${msg}`);
      console.error(`❌ Error al notificar recordatorio:`, error);
    }
  }

  return { success: errors.length === 0, notifiedCount, errors };
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
