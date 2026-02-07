"use server";

import { db } from "@/lib/db";

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

interface SendNotificationOptions {
  title: string;
  message: string;
  url?: string;
  // Destinatarios (usar uno de estos)
  userIds?: string[];       // IDs de usuarios de nuestra app
  playerIds?: string[];     // IDs de OneSignal directamente
  segments?: string[];      // Segmentos de OneSignal (ej: "Subscribed Users")
  // Datos adicionales
  data?: Record<string, string>;
}

interface OneSignalResponse {
  id?: string;
  recipients?: number;
  errors?: string[];
}

/**
 * Envía una notificación push vía OneSignal REST API
 */
export async function sendPushNotification(options: SendNotificationOptions) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.error("[OneSignal] API keys no configuradas");
    return { success: false, error: "OneSignal no configurado" };
  }

  try {
    let targetPlayerIds: string[] | undefined = options.playerIds;

    // Si se pasan userIds, buscar sus playerIds en la BD
    if (options.userIds && options.userIds.length > 0) {
      const players = await db.oneSignalPlayer.findMany({
        where: {
          userId: { in: options.userIds },
          subscribed: true,
        },
        select: { playerId: true },
      });
      targetPlayerIds = players.map((p) => p.playerId);
      console.log(`[OneSignal] Encontrados ${targetPlayerIds.length} playerIds para ${options.userIds.length} userIds:`, targetPlayerIds);
    }

    // Construir el payload para OneSignal
    const payload: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: options.title, es: options.title },
      contents: { en: options.message, es: options.message },
    };

    // Configurar destinatarios
    if (targetPlayerIds && targetPlayerIds.length > 0) {
      payload.include_player_ids = targetPlayerIds; // API v11 usa include_player_ids
      console.log(`[OneSignal] Enviando a playerIds:`, targetPlayerIds);
    } else if (options.segments && options.segments.length > 0) {
      payload.included_segments = options.segments;
      console.log(`[OneSignal] Enviando a segmentos:`, options.segments);
    } else {
      // Por defecto, enviar a todos los suscritos
      payload.included_segments = ["Subscribed Users"];
      console.log(`[OneSignal] Enviando a todos los suscritos (Subscribed Users)`);
    }

    // URL de destino al hacer click
    if (options.url) {
      payload.url = options.url;
    }

    // Datos adicionales
    if (options.data) {
      payload.data = options.data;
    }

    // Enviar a OneSignal
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as OneSignalResponse;

    if (!response.ok) {
      console.error("[OneSignal] Error en respuesta:", result);
      return {
        success: false,
        error: result.errors?.join(", ") || "Error al enviar",
      };
    }

    console.log("[OneSignal] Respuesta completa de OneSignal:", JSON.stringify(result, null, 2));
    console.log("[OneSignal] Notificación enviada:", result.id, "Recipients:", result.recipients);

    return {
      success: true,
      data: {
        notificationId: result.id,
        recipients: result.recipients,
      },
    };
  } catch (error) {
    console.error("[OneSignal] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

/**
 * Envía una notificación a un usuario específico
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  message: string,
  url?: string
) {
  // 0. Verificar autenticación
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "No autenticado" };
  }

  return sendPushNotification({
    title,
    message,
    userIds: [userId],
    url,
  });
}

/**
 * Envía una notificación a todos los usuarios suscritos
 */
export async function sendPushToAll(
  title: string,
  message: string,
  url?: string
) {
  // 0. Verificar autenticación
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "No autenticado" };
  }

  return sendPushNotification({
    title,
    message,
    segments: ["Subscribed Users"],
    url,
  });
}

/**
 * Obtiene estadísticas de suscripciones
 */
export async function getSubscriptionStats() {
  try {
    // 0. Verificar autenticación
    const { auth } = await import("@/auth");
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "No autenticado" };
    }

    const total = await db.oneSignalPlayer.count();
    const subscribed = await db.oneSignalPlayer.count({
      where: { subscribed: true },
    });
    const byDevice = await db.oneSignalPlayer.groupBy({
      by: ["device"],
      where: { subscribed: true },
      _count: { device: true },
    });

    return {
      success: true,
      data: {
        total,
        subscribed,
        unsubscribed: total - subscribed,
        byDevice: byDevice.reduce(
          (acc, item) => {
            acc[item.device || "unknown"] = item._count.device;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
    };
  } catch (error) {
    console.error("[OneSignal Stats] Error:", error);
    return { success: false, error: "Error al obtener estadísticas" };
  }
}
