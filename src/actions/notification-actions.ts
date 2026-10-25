"use server";

import { requireActor, requireAdmin } from "@/lib/server-access";
import { db } from "@/lib/db";
import { sendNotification as system_sendNotification, notifyAdmins as system_notifyAdmins, notifyAdminsWithPush as system_notifyAdminsWithPush, checkPendingInvoicesOver72h as system_checkPendingInvoicesOver72h, sendDailyTaskDigest as system_sendDailyTaskDigest } from "@/lib/system-notifications";
import type { ApiResponse } from "@/types";
import type { Notification } from "@prisma/client";

/**
 * Envía una notificación a un usuario
 * Guarda en Prisma y dispara evento a Pusher
 */
export async function sendNotification(...args: Parameters<typeof system_sendNotification>): Promise<Awaited<ReturnType<typeof system_sendNotification>>> {
  try {
    await requireAdmin();
    return await system_sendNotification(...args);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
  }
}

/**
 * Notifica a todos los administradores
 */
export async function notifyAdmins(...args: Parameters<typeof system_notifyAdmins>): Promise<Awaited<ReturnType<typeof system_notifyAdmins>>> {
  try {
    await requireAdmin();
    return await system_notifyAdmins(...args);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
  }
}

/**
 * Notifica a todos los administradores con notificación PUSH (PWA)
 * Combina notificaciones in-app (Pusher) + notificaciones PUSH (Web Push)
 */
export async function notifyAdminsWithPush(...args: Parameters<typeof system_notifyAdminsWithPush>): Promise<Awaited<ReturnType<typeof system_notifyAdminsWithPush>>> {
  try {
    await requireAdmin();
    return await system_notifyAdminsWithPush(...args);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
  }
}

/**
 * Marca una notificación como leída
 */
export async function markAsRead(
  notificationId: string
): Promise<ApiResponse<Notification>> {
  try {
    const actor = await requireActor("notifications.self");
    const notification = await db.notification.update({
      where: { id: notificationId, userId: actor.userId },
      data: { read: true },
    });

    return { success: true, data: notification };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al marcar notificación como leída",
    };
  }
}

/**
 * Obtiene las notificaciones no leídas del usuario actual
 */
export async function getUnreadNotifications(): Promise<
  ApiResponse<Array<Notification & { createdByUser?: { name: string; image: string | null } }>>
> {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    const notifications = await db.notification.findMany({
      where: {
        userId: sessionUserId,
        read: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50, // Limitar a las últimas 50 notificaciones
    });

    // Obtener IDs únicos de creadores
    const creatorIds = notifications
      .map((n) => n.createdBy)
      .filter((id): id is string => id !== null);

    // Obtener información de todos los creadores en una sola consulta
    const creators = creatorIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true, image: true },
        })
      : [];

    const creatorMap = new Map(
      creators.map((c) => [c.id, { name: c.name, image: c.image }])
    );

    // Mapear para incluir información del usuario que creó la notificación
    const notificationsWithCreator = notifications.map((notif) => ({
      ...notif,
      createdByUser: notif.createdBy
        ? creatorMap.get(notif.createdBy)
        : undefined,
    }));

    return { success: true, data: notificationsWithCreator };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener notificaciones",
    };
  }
}

/**
 * Obtiene todas las notificaciones del usuario (leídas y no leídas)
 */
export async function getAllNotifications(): Promise<
  ApiResponse<Array<Notification & { createdByUser?: { name: string; image: string | null } }>>
> {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    const notifications = await db.notification.findMany({
      where: {
        userId: sessionUserId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // Limitar a las últimas 100 notificaciones
    });

    // Obtener IDs únicos de creadores
    const creatorIds = notifications
      .map((n) => n.createdBy)
      .filter((id): id is string => id !== null);

    // Obtener información de todos los creadores en una sola consulta
    const creators = creatorIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true, image: true },
        })
      : [];

    const creatorMap = new Map(
      creators.map((c) => [c.id, { name: c.name, image: c.image }])
    );

    // Mapear para incluir información del usuario que creó la notificación
    const notificationsWithCreator = notifications.map((notif) => ({
      ...notif,
      createdByUser: notif.createdBy
        ? creatorMap.get(notif.createdBy)
        : undefined,
    }));

    return { success: true, data: notificationsWithCreator };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener notificaciones",
    };
  }
}

/**
 * Obtiene las notificaciones del usuario con límite opcional
 * Si se pasa un límite, devuelve solo esa cantidad. Si no, devuelve todas.
 */
export async function getUserNotifications(
  limit?: number
): Promise<
  ApiResponse<Array<Notification & { createdByUser?: { name: string; image: string | null } }>>
> {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    const notifications = await db.notification.findMany({
      where: {
        userId: sessionUserId,
      },
      orderBy: {
        createdAt: "desc",
      },
      ...(limit && { take: limit }),
    });

    // Obtener IDs únicos de creadores
    const creatorIds = notifications
      .map((n) => n.createdBy)
      .filter((id): id is string => id !== null);

    // Obtener información de todos los creadores en una sola consulta
    const creators = creatorIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true, image: true },
        })
      : [];

    const creatorMap = new Map(
      creators.map((c) => [c.id, { name: c.name, image: c.image }])
    );

    // Mapear para incluir información del usuario que creó la notificación
    const notificationsWithCreator = notifications.map((notif) => ({
      ...notif,
      createdByUser: notif.createdBy
        ? creatorMap.get(notif.createdBy)
        : undefined,
    }));

    return { success: true, data: notificationsWithCreator };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener notificaciones",
    };
  }
}

/**
 * Marca todas las notificaciones del usuario como leídas
 */
export async function markAllAsRead(): Promise<ApiResponse<{ count: number }>> {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      return { success: false, error: "No autenticado" };
    }

    const result = await db.notification.updateMany({
      where: {
        userId: sessionUserId,
        read: false,
      },
      data: {
        read: true,
      },
    });

    return { success: true, data: { count: result.count } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al marcar todas las notificaciones como leídas",
    };
  }
}

/**
 * Obtiene el conteo de notificaciones no leídas
 */
export async function getUnreadCount(): Promise<ApiResponse<number>> {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      return { success: true, data: 0 };
    }

    const count = await db.notification.count({
      where: {
        userId: sessionUserId,
        read: false,
      },
    });

    return { success: true, data: count };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener conteo de notificaciones",
    };
  }
}

/**
 * Verifica facturas pendientes > 72 horas y notifica a los admins
 * Esta función debe ejecutarse periódicamente (cron job o similar)
 */
export async function checkPendingInvoicesOver72h(...args: Parameters<typeof system_checkPendingInvoicesOver72h>): Promise<Awaited<ReturnType<typeof system_checkPendingInvoicesOver72h>>> {
  try {
    await requireAdmin();
    return await system_checkPendingInvoicesOver72h(...args);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
  }
}

/**
 * Envía smart digest diario a todos los usuarios con tareas asignadas para hoy
 * Se ejecuta todos los días a las 8am (via cron)
 * Consolida todas las tareas del día en UNA notificación por usuario
 */
export async function sendDailyTaskDigest(...args: Parameters<typeof system_sendDailyTaskDigest>): Promise<Awaited<ReturnType<typeof system_sendDailyTaskDigest>>> {
  try {
    await requireAdmin();
    return await system_sendDailyTaskDigest(...args);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
  }
}
