"use server";

/**
 * Push Notification Server Actions
 * Replaces onesignal-actions.ts. Same contract (sendPushNotification, sendPushToUser, etc.)
 * but backed by our own Web Push + VAPID infrastructure.
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendPush, getPushStats, type PushPayload, type SendTargetOptions } from "@/lib/web-push";

// ---------------------------------------------------------------------------
// Types (same shape as old OneSignal actions for compatibility)
// ---------------------------------------------------------------------------

interface SendNotificationOptions {
  title: string;
  message: string;
  url?: string;
  userIds?: string[];
  segments?: string[]; // kept for compat, maps to "all" or role
  data?: Record<string, string>;
  imageUrl?: string;
}

// ---------------------------------------------------------------------------
// subscribePush / unsubscribePush
// ---------------------------------------------------------------------------

/**
 * Upsert a push subscription. Called from the frontend after PushManager.subscribe().
 * Keys (p256dh, auth) are stored as-is (base64url strings from the browser).
 */
export async function subscribePush(params: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const role = session?.user?.roleLegacy ?? null;

    await db.pushSubscription.upsert({
      where: { endpoint: params.endpoint },
      update: {
        p256dh: params.p256dh,
        auth: params.auth,
        userId,
        role,
        lastSeenAt: new Date(),
      },
      create: {
        endpoint: params.endpoint,
        p256dh: params.p256dh,
        auth: params.auth,
        userId,
        role,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[PushActions] subscribePush error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al suscribir",
    };
  }
}

/**
 * Remove a push subscription by endpoint.
 */
export async function unsubscribePush(
  endpoint: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.pushSubscription.deleteMany({ where: { endpoint } });
    return { success: true };
  } catch (error) {
    console.error("[PushActions] unsubscribePush error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al desuscribir",
    };
  }
}

// ---------------------------------------------------------------------------
// sendPushNotification — drop-in replacement for the old OneSignal function
// ---------------------------------------------------------------------------

/**
 * Sends a push notification. Same interface as the old onesignal sendPushNotification.
 *
 * - `userIds`: send to specific users
 * - `segments`: if includes "Subscribed Users", sends to all. Otherwise treated as role.
 */
export async function sendPushNotification(
  options: SendNotificationOptions
): Promise<{ success: boolean; data?: { sent: number; failed: number; cleaned: number }; error?: string }> {
  try {
    const payload: PushPayload = {
      title: options.title,
      body: options.message,
      url: options.url,
      image: options.imageUrl,
      data: options.data,
    };

    let target: SendTargetOptions;

    if (options.userIds && options.userIds.length > 0) {
      target = { userIds: options.userIds };
    } else if (options.segments && options.segments.length > 0) {
      if (options.segments.includes("Subscribed Users")) {
        target = { all: true };
      } else {
        // Treat segment names as roles (e.g., "ADMIN", "EDITOR")
        // For simplicity, send to all if multiple segments
        target = { all: true };
      }
    } else {
      // Default: send to all
      target = { all: true };
    }

    const result = await sendPush(payload, target);

    return {
      success: result.success,
      data: { sent: result.sent, failed: result.failed, cleaned: result.cleaned },
    };
  } catch (error) {
    console.error("[PushActions] sendPushNotification error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al enviar push",
    };
  }
}

// ---------------------------------------------------------------------------
// sendPushToUser / sendPushToAll — convenience wrappers
// ---------------------------------------------------------------------------

export async function sendPushToUser(
  userId: string,
  title: string,
  message: string,
  url?: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "No autenticado" };

  return sendPushNotification({ title, message, userIds: [userId], url });
}

export async function sendPushToAll(title: string, message: string, url?: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "No autenticado" };

  return sendPushNotification({ title, message, segments: ["Subscribed Users"], url });
}

// ---------------------------------------------------------------------------
// sendCustomPush — for the admin test panel
// ---------------------------------------------------------------------------

export async function sendCustomPush(params: {
  title: string;
  body: string;
  url?: string;
  image?: string;
  targets: {
    type: "all" | "role" | "users";
    roles?: string[];
    userIds?: string[];
  };
}): Promise<{
  success: boolean;
  data?: { sent: number; failed: number; cleaned: number };
  error?: string;
}> {
  const session = await auth();
  if (!session?.user || session.user.roleLegacy !== "ADMIN") {
    return { success: false, error: "No autorizado" };
  }

  const payload: PushPayload = {
    title: params.title,
    body: params.body,
    url: params.url,
    image: params.image,
    tag: "totem-manual-test",
  };

  let target: SendTargetOptions;

  switch (params.targets.type) {
    case "all":
      target = { all: true };
      break;
    case "role":
      // Send to each role separately and aggregate
      if (params.targets.roles && params.targets.roles.length > 0) {
        let totalSent = 0;
        let totalFailed = 0;
        let totalCleaned = 0;
        const allErrors: string[] = [];

        for (const role of params.targets.roles) {
          const result = await sendPush(payload, { role });
          totalSent += result.sent;
          totalFailed += result.failed;
          totalCleaned += result.cleaned;
          allErrors.push(...result.errors);
        }

        return {
          success: totalSent > 0 || totalFailed === 0,
          data: { sent: totalSent, failed: totalFailed, cleaned: totalCleaned },
        };
      }
      target = { all: true };
      break;
    case "users":
      if (!params.targets.userIds || params.targets.userIds.length === 0) {
        return { success: false, error: "No se seleccionaron usuarios" };
      }
      target = { userIds: params.targets.userIds };
      break;
    default:
      return { success: false, error: "Tipo de destino inválido" };
  }

  const result = await sendPush(payload, target);
  return {
    success: result.success,
    data: { sent: result.sent, failed: result.failed, cleaned: result.cleaned },
  };
}

// ---------------------------------------------------------------------------
// getSubscriptionStats — for admin panel
// ---------------------------------------------------------------------------

export async function getSubscriptionStats() {
  const session = await auth();
  if (!session?.user || session.user.roleLegacy !== "ADMIN") {
    return { success: false, error: "No autorizado" };
  }

  const stats = await getPushStats();
  return { success: true, data: stats };
}
