"use server";

import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";
import type { ApiResponse } from "@/types";
import type { Notification } from "@prisma/client";

/**
 * Envía una notificación a un usuario
 * Guarda en Prisma y dispara evento a Pusher
 */
export async function sendNotification({
  userId,
  message,
  type,
  createdBy,
  clientLogo,
  clientName,
}: {
  userId: string;
  message: string;
  type: string;
  createdBy?: string;
  clientLogo?: string;
  clientName?: string;
}): Promise<ApiResponse<Notification>> {
  try {
    // 1. Guardar notificación en Prisma
    const notification = await db.notification.create({
      data: {
        userId,
        message,
        type,
        createdBy: createdBy || null,
        read: false,
        clientLogo: clientLogo || null,
        clientName: clientName || null,
      },
    });

    // 2. Disparar evento a Pusher en canal privado del usuario
    try {
      await pusherServer.trigger(`user-${userId}`, "new-notification", {
        id: notification.id,
        message: notification.message,
        type: notification.type,
        createdBy: notification.createdBy,
        createdAt: notification.createdAt,
        clientLogo: notification.clientLogo,
        clientName: notification.clientName,
      });
      console.log(`✅ Notificación enviada a Pusher para usuario ${userId}`);
    } catch (pusherError) {
      console.error("❌ Error al enviar notificación a Pusher:", pusherError);
      // No fallar la operación si Pusher falla
    }

    return { success: true, data: notification };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al enviar notificación",
    };
  }
}

/**
 * Notifica a todos los administradores
 */
export async function notifyAdmins(
  message: string,
  type: string = "ADMIN_ALERT",
  createdBy?: string
): Promise<ApiResponse<{ count: number }>> {
  try {
    const admins = await db.user.findMany({
      where: { roleLegacy: "ADMIN" },
      select: { id: true },
    });

    let successCount = 0;
    for (const admin of admins) {
      const result = await sendNotification({
        userId: admin.id,
        message,
        type,
        createdBy,
      });
      if (result.success) {
        successCount++;
      }
    }

    return { success: true, data: { count: successCount } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al notificar administradores",
    };
  }
}

/**
 * Notifica a todos los administradores con notificación PUSH (PWA)
 * Combina notificaciones in-app (Pusher) + notificaciones PUSH (OneSignal)
 */
export async function notifyAdminsWithPush(
  title: string,
  message: string,
  type: string = "ADMIN_ALERT",
  url?: string,
  createdBy?: string,
  imageUrl?: string // Rich media: logo del cliente, preview de tarea, etc
): Promise<ApiResponse<{ inAppCount: number; pushSent: boolean }>> {
  try {
    // 1. Enviar notificaciones in-app a todos los admins
    const inAppResult = await notifyAdmins(message, type, createdBy);
    const inAppCount = inAppResult.success ? inAppResult.data?.count ?? 0 : 0;

    // 2. Enviar notificación PUSH a todos los admins
    const { sendPushNotification } = await import("@/actions/onesignal-actions");
    
    const admins = await db.user.findMany({
      where: { roleLegacy: "ADMIN" },
      select: { id: true },
    });

    const pushResult = await sendPushNotification({
      title,
      message,
      userIds: admins.map((admin) => admin.id),
      url,
      imageUrl, // Pasar rich media a OneSignal
    });

    console.log(`✅ Notificaciones enviadas: ${inAppCount} in-app, PUSH: ${pushResult.success ? "✅" : "❌"}${imageUrl ? " (con imagen)" : ""}`);

    return {
      success: true,
      data: {
        inAppCount,
        pushSent: pushResult.success,
      },
    };
  } catch (error) {
    console.error("❌ Error al notificar administradores con PUSH:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al notificar administradores con PUSH",
    };
  }
}

/**
 * Marca una notificación como leída
 */
export async function markAsRead(
  notificationId: string
): Promise<ApiResponse<Notification>> {
  try {
    const notification = await db.notification.update({
      where: { id: notificationId },
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
export async function checkPendingInvoicesOver72h(): Promise<ApiResponse<{ checked: number; notified: number }>> {
  try {
    const now = new Date();
    const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    // Buscar facturas pendientes creadas hace más de 72 horas
    const pendingInvoices = await db.invoice.findMany({
      where: {
        status: "PENDING",
        generatedAt: {
          lte: seventyTwoHoursAgo,
        },
      },
      include: {
        client: true,
      },
    });

    let notifiedCount = 0;

    // Notificar a los admins sobre cada factura pendiente
    for (const invoice of pendingInvoices) {
      try {
        await notifyAdmins(
          `Alerta: La factura de ${invoice.client.name} por $${invoice.amount} lleva más de 72 horas sin cobrar.`,
          "ADMIN_ALERT",
          undefined // Sistema
        );
        notifiedCount++;
      } catch (error) {
        console.error(`❌ Error al notificar sobre factura ${invoice.id}:`, error);
      }
    }

    return {
      success: true,
      data: {
        checked: pendingInvoices.length,
        notified: notifiedCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al verificar facturas pendientes",
    };
  }
}

/**
 * Envía smart digest diario a todos los usuarios con tareas asignadas para hoy
 * Se ejecuta todos los días a las 8am (via cron)
 * Consolida todas las tareas del día en UNA notificación por usuario
 */
export async function sendDailyTaskDigest(): Promise<ApiResponse<{ sentCount: number; totalTasks: number }>> {
  try {
    const { startOfDay, endOfDay } = await import("date-fns");
    const today = new Date();
    const startToday = startOfDay(today);
    const endToday = endOfDay(today);

    // Obtener todas las tareas programadas para hoy (scheduledAt entre startOfDay y endOfDay)
    const todayTasks = await db.contentTask.findMany({
      where: {
        scheduledAt: {
          gte: startToday,
          lte: endToday,
        },
        status: {
          notIn: ["PUBLISHED", "APPROVED", "PAUSED", "CANCELLED", "REJECTED"], // Excluir tareas ya finalizadas o detenidas
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
      },
      orderBy: {
        dueDate: "asc",
      },
    });

    if (todayTasks.length === 0) {
      console.log("📭 No hay tareas programadas para hoy - digest no enviado");
      return {
        success: true,
        data: { sentCount: 0, totalTasks: 0 },
      };
    }

    // Agrupar tareas por usuario (assignedEditorId o assignedCommunityId)
    const tasksByUser = new Map<string, typeof todayTasks>();

    for (const task of todayTasks) {
      // Asignar a Editor
      if (task.assignedEditorId) {
        const existing = tasksByUser.get(task.assignedEditorId) || [];
        tasksByUser.set(task.assignedEditorId, [...existing, task]);
      }
      // Asignar a Community Manager
      if (task.assignedCommunityId) {
        const existing = tasksByUser.get(task.assignedCommunityId) || [];
        tasksByUser.set(task.assignedCommunityId, [...existing, task]);
      }
    }

    let sentCount = 0;

    // Enviar digest consolidado a cada usuario
    for (const [userId, userTasks] of tasksByUser) {
      const taskCount = userTasks.length;
      const clientNames = [...new Set(userTasks.map((t) => t.client.name))];
      const clientSummary = clientNames.length <= 3 
        ? clientNames.join(", ") 
        : `${clientNames.slice(0, 2).join(", ")} y ${clientNames.length - 2} más`;

      const title = taskCount === 1 
        ? "Tienes 1 tarea programada para hoy" 
        : `Tienes ${taskCount} tareas programadas para hoy`;

      const message = `${clientSummary} • ${userTasks.filter((t) => t.type === "REEL").length} Reels, ${userTasks.filter((t) => t.type === "FLYER").length} Flyers, ${userTasks.filter((t) => t.type === "STORY").length} Stories`;

      // Enviar notificación in-app
      const inAppResult = await sendNotification({
        userId,
        message: `${title}: ${message}`,
        type: "DAILY_DIGEST",
      });

      // Enviar notificación PUSH con logo del primer cliente
      const { sendPushNotification } = await import("@/actions/onesignal-actions");
      const firstClientLogo = userTasks[0]?.client?.logo || undefined;

      await sendPushNotification({
        title,
        message,
        userIds: [userId],
        url: "/content",
        data: {
          type: "DAILY_DIGEST",
          taskCount: taskCount.toString(),
        },
        imageUrl: firstClientLogo, // Rich media: logo del cliente
      });

      if (inAppResult.success) {
        sentCount++;
      }
    }

    console.log(`✅ Daily digest enviado a ${sentCount} usuarios (${todayTasks.length} tareas totales)`);

    return {
      success: true,
      data: {
        sentCount,
        totalTasks: todayTasks.length,
      },
    };
  } catch (error) {
    console.error("❌ Error al enviar daily digest:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al enviar daily digest",
    };
  }
}
