"use server";

/**
 * Push Notification Server Actions
 * Replaces onesignal-actions.ts. Same contract (sendPushNotification, sendPushToUser, etc.)
 * but backed by our own Web Push + VAPID infrastructure.
 */

import { requireAdmin } from "@/lib/server-access";
import { sendPushNotification as systemSendPush } from "@/lib/system-push";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendPush, getPushStats, type PushPayload } from "@/lib/web-push";
import { resolveRoleCode } from "@/lib/roles";

/**
 * Las server actions son endpoints HTTP: los tipos de TypeScript se borran en
 * runtime y el llamante puede enviar un objeto donde se espera un string. Sin
 * esta validación, Prisma tratará ese objeto como filtro ({ not: "" }) y la
 * consulta afectara a filas que no corresponden.
 */
const endpointSchema = z.string().trim().min(1).max(2048).url();

const subscribeParamsSchema = z.object({
  endpoint: endpointSchema,
  p256dh: z.string().trim().min(1).max(512),
  auth: z.string().trim().min(1).max(512),
});

// ---------------------------------------------------------------------------
// Types (same shape as old OneSignal actions for compatibility)
// ---------------------------------------------------------------------------

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
    const parsedParams = subscribeParamsSchema.safeParse(params);

    if (!parsedParams.success) {
      return { success: false, error: "Datos de suscripción inválidos" };
    }

    const session = await auth();
    const userId = session?.user?.id ?? null;
    const role = resolveRoleCode(session?.user);

    await db.pushSubscription.upsert({
      where: { endpoint: parsedParams.data.endpoint },
      update: {
        p256dh: parsedParams.data.p256dh,
        auth: parsedParams.data.auth,
        userId,
        role,
        lastSeenAt: new Date(),
      },
      create: {
        endpoint: parsedParams.data.endpoint,
        p256dh: parsedParams.data.p256dh,
        auth: parsedParams.data.auth,
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
    const parsedEndpoint = endpointSchema.safeParse(endpoint);

    if (!parsedEndpoint.success) {
      return { success: false, error: "Endpoint inválido" };
    }

    await db.pushSubscription.deleteMany({ where: { endpoint: parsedEndpoint.data } });
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
export async function sendPushNotification(...args: Parameters<typeof systemSendPush>): Promise<Awaited<ReturnType<typeof systemSendPush>>> {
  try {
    await requireAdmin();
    return await systemSendPush(...args);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
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
  data?: { sent: number; failed: number; cleaned: number; localQueued: number; errors: string[] };
  error?: string;
}> {
  const session = await auth();
  if (!session?.user || resolveRoleCode(session.user) !== "ADMIN") {
    return { success: false, error: "No autorizado" };
  }

  const parsed = z.object({
    title: z.string().trim().min(1).max(100),
    body: z.string().trim().min(1).max(300),
    url: z.string().max(2048).optional(),
    image: z.string().max(2048).optional(),
    targets: z.discriminatedUnion("type", [
      z.object({ type: z.literal("all") }),
      z.object({ type: z.literal("role"), roles: z.array(z.enum(["ADMIN", "EDITOR", "USER"])).min(1).max(3) }),
      z.object({ type: z.literal("users"), userIds: z.array(z.string().min(1).max(128)).min(1).max(100) }),
    ]),
  }).safeParse(params);
  if (!parsed.success) return { success: false, error: "Revisa el mensaje y los destinatarios seleccionados." };
  const input = parsed.data;
  const recipients = await db.user.findMany({
    where: input.targets.type === "users" ? { id: { in: input.targets.userIds } }
      : input.targets.type === "role" ? { roleCode: { in: input.targets.roles } } : {},
    select: { id: true },
  });
  // The native sideloaded app has no Web Push registration. Its authenticated
  // local-reminder sync reads these messages and presents them on the device.
  const queued = recipients.length ? await db.notification.createMany({
    data: recipients.map(({ id }) => ({ userId: id, type: "PUSH_MESSAGE", message: `${input.title}\n${input.body}`, createdBy: session.user.id })),
  }) : { count: 0 };
  const payload: PushPayload = { title: input.title, body: input.body, url: input.url, image: input.image };
  try {
    const result = await sendPush(payload, input.targets.type === "all"
      ? { all: true } : { userIds: recipients.map(({ id }) => id) });
    return {
      success: result.success || queued.count > 0,
      data: { sent: result.sent, failed: result.failed, cleaned: result.cleaned,
        localQueued: queued.count, errors: [...new Set(result.errors)].slice(0, 5) },
    };
  } catch {
    return { success: queued.count > 0, data: { sent: 0, failed: 0, cleaned: 0, localQueued: queued.count,
      errors: ["Web Push no está disponible. Los avisos para iOS se entregarán al sincronizar."] } };
  }
}

// ---------------------------------------------------------------------------
// getSubscriptionStats — for admin panel
// ---------------------------------------------------------------------------

export async function getSubscriptionStats() {
  const session = await auth();
  if (!session?.user || resolveRoleCode(session.user) !== "ADMIN") {
    return { success: false, error: "No autorizado" };
  }

  const stats = await getPushStats();
  return { success: true, data: stats };
}
