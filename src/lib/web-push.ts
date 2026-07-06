/**
 * Web Push Service
 * Wraps the `web-push` npm package with VAPID configuration.
 * Handles sending push notifications to stored PushSubscription records,
 * auto-cleaning expired subscriptions (404/410), and detailed result tracking.
 */

import webPush from "web-push";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// VAPID config — keys are base64url strings stored in .env.
// web-push handles decoding internally, no manual transform needed.
// ---------------------------------------------------------------------------
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@tote-agency.com";

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error(
      "[WebPush] VAPID keys not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env"
    );
  }
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  image?: string; // stored as data, not in showNotification (Safari ignores it)
  tag?: string;
  data?: Record<string, string>;
}

export interface SendResult {
  success: boolean;
  sent: number;
  failed: number;
  cleaned: number; // subscriptions removed due to 404/410
  errors: string[];
}

export interface SendTargetOptions {
  /** Send to specific user IDs */
  userIds?: string[];
  /** Send to all subscriptions with this role */
  role?: string;
  /** Send to ALL subscriptions (ignores userIds/role) */
  all?: boolean;
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

/**
 * Sends a push notification to subscriptions matching the target criteria.
 * Auto-cleans expired subscriptions (HTTP 404 / 410 from push service).
 */
export async function sendPush(
  payload: PushPayload,
  target: SendTargetOptions
): Promise<SendResult> {
  ensureVapid();

  // Build subscription query
  const where: Record<string, unknown> = {};

  if (target.all) {
    // no filter — all subscriptions
  } else if (target.userIds && target.userIds.length > 0) {
    where.userId = { in: target.userIds };
  } else if (target.role) {
    where.role = target.role;
  } else {
    return { success: false, sent: 0, failed: 0, cleaned: 0, errors: ["No target specified"] };
  }

  const subscriptions = await db.pushSubscription.findMany({ where });

  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0, cleaned: 0, errors: [] };
  }

  // Build the JSON payload the service worker will receive.
  // The SW handler parses this and calls showNotification().
  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    image: payload.image || null,
    tag: payload.tag || "totem-push",
    data: payload.data || {},
  });

  let sent = 0;
  let failed = 0;
  let cleaned = 0;
  const errors: string[] = [];
  const expiredIds: string[] = [];

  // Send in parallel batches of 20 to avoid overwhelming the push service
  const BATCH_SIZE = 20;
  for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((sub) =>
        webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushPayload
        )
      )
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const sub = batch[j];

      if (result.status === "fulfilled") {
        sent++;
        // Update lastSeenAt
        await db.pushSubscription.update({
          where: { id: sub.id },
          data: { lastSeenAt: new Date() },
        }).catch(() => {}); // non-critical
      } else {
        const err = result.reason;
        const statusCode = err?.statusCode ?? err?.status ?? 0;

        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired or unsubscribed — mark for cleanup
          expiredIds.push(sub.id);
          cleaned++;
          console.log(`[WebPush] Subscription expired (${statusCode}): ${sub.endpoint.slice(0, 60)}...`);
        } else {
          failed++;
          const msg = err?.message || String(err);
          errors.push(`[${sub.id}] ${msg}`);
          console.error(`[WebPush] Send failed for ${sub.id}:`, msg);
        }
      }
    }
  }

  // Bulk delete expired subscriptions
  if (expiredIds.length > 0) {
    await db.pushSubscription.deleteMany({
      where: { id: { in: expiredIds } },
    });
    console.log(`[WebPush] Cleaned ${expiredIds.length} expired subscriptions`);
  }

  return {
    success: sent > 0 || (sent === 0 && failed === 0),
    sent,
    failed,
    cleaned,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Convenience: get the VAPID public key for the frontend
// ---------------------------------------------------------------------------

export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC_KEY || null;
}

// ---------------------------------------------------------------------------
// Subscription stats
// ---------------------------------------------------------------------------

export async function getPushStats() {
  const total = await db.pushSubscription.count();
  const byRole = await db.pushSubscription.groupBy({
    by: ["role"],
    _count: { role: true },
  });

  return {
    total,
    byRole: byRole.reduce(
      (acc, r) => {
        acc[r.role || "unknown"] = r._count.role;
        return acc;
      },
      {} as Record<string, number>
    ),
  };
}
