// Shared Node service for Next.js and the worker; this module is not a Server Action.
import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";
import type { ApiResponse } from "@/types";
import type { Notification } from "@prisma/client";

// Internal service: callers must authorize the originating operation.
export async function sendNotification({
  userId,
  message,
  type,
  createdBy,
  clientLogo,
  clientName,
  whatsappDedupeKey,
  whatsappKind,
  whatsappBody,
}: {
  userId: string;
  message: string;
  type: string;
  createdBy?: string;
  clientLogo?: string;
  clientName?: string;
  whatsappDedupeKey?: string;
  whatsappKind?: string;
  whatsappBody?: string;
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

    // WhatsApp is an optional mirror for opted-in team members. The shared
    // queue applies pause, allow-list and dedupe rules; a queue outage must not
    // make the in-app notification fail.
    const whatsappTypes = new Set(["SHOOT_NEW", "SHOOT_REMINDER", "SHOOT_CANCELED", "DAILY_DIGEST"]);
    if (whatsappTypes.has(type)) {
      try {
        const recipient = await db.user.findUnique({
          where: { id: userId },
          select: { phone: true, whatsappOptIn: true },
        });
        const { normalizePhone } = await import("@/lib/whatsapp/enqueue");
        const digits = recipient?.phone ? normalizePhone(recipient.phone) : "";
        if (recipient?.whatsappOptIn && digits) {
          const { enqueueWhatsApp } = await import("@/lib/whatsapp/enqueue");
          await enqueueWhatsApp({
            to: `${digits}@s.whatsapp.net`,
            body: whatsappBody ?? message,
            kind: whatsappKind ?? (type === "DAILY_DIGEST" ? "TEAM_DAILY" : "SHOOT_REMINDER"),
            dedupeKey: whatsappDedupeKey ? `${whatsappDedupeKey}:${digits}@s.whatsapp.net` : `notification:${notification.id}`,
          });
        }
      } catch {
        // Queue exceptions can contain transport or payload details; never log them.
        console.warn("WhatsApp notification enqueue failed");
      }
    }

    // 2. Disparar evento a Pusher en canal privado del usuario
    try {
      await pusherServer.trigger(`private-user-${userId}`, "new-notification", {
        id: notification.id,
        message: notification.message,
        type: notification.type,
        createdBy: notification.createdBy,
        createdAt: notification.createdAt,
        clientLogo: notification.clientLogo,
        clientName: notification.clientName,
      });
      console.log(`Notificación enviada a Pusher para usuario ${userId}`);
    } catch (pusherError) {
      console.error("Error al enviar notificación a Pusher:", pusherError);
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

export async function notifyAdmins(
  message: string,
  type: string = "ADMIN_ALERT",
  createdBy?: string
): Promise<ApiResponse<{ count: number }>> {
  try {
    const admins = await db.user.findMany({
      where: { roleCode: "ADMIN" },
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
    const { sendPushNotification } = await import("@/lib/system-push");

    const admins = await db.user.findMany({
      where: { roleCode: "ADMIN" },
      select: { id: true },
    });

    const pushResult = await sendPushNotification({
      title,
      message,
      userIds: admins.map((admin) => admin.id),
      url,
      imageUrl,
    });

    console.log(`Notificaciones enviadas: ${inAppCount} in-app, PUSH: ${pushResult.success ? "" : ""}${imageUrl ? " (con imagen)" : ""}`);

    return {
      success: true,
      data: {
        inAppCount,
        pushSent: pushResult.success,
      },
    };
  } catch (error) {
    console.error("Error al notificar administradores con PUSH:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al notificar administradores con PUSH",
    };
  }
}

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
        console.error(`Error al notificar sobre factura ${invoice.id}:`, error);
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
      console.log("No hay tareas programadas para hoy - digest no enviado");
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
      const { sendPushNotification } = await import("@/lib/system-push");
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

    console.log(`Daily digest enviado a ${sentCount} usuarios (${todayTasks.length} tareas totales)`);

    return {
      success: true,
      data: {
        sentCount,
        totalTasks: todayTasks.length,
      },
    };
  } catch (error) {
    console.error("Error al enviar daily digest:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al enviar daily digest",
    };
  }
}
