import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/whatsapp/enqueue";
import { getWhatsAppConfig } from "@/lib/whatsapp/config";
import { evaluateWhatsAppWatchdog } from "@/lib/whatsapp/watchdog";

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const base = process.env.WA_HEALTH_URL;
  if (!base) return NextResponse.json({ success: true, data: { skipped: "worker-health-not-configured" } });

  const checkedAt = new Date();
  const healthy = await isWorkerHealthy(base);
  const check = await db.whatsAppEvent.create({
    data: { type: "WATCHDOG_CHECK", payload: { healthy, checkedAt: checkedAt.toISOString() } },
  });
  if (healthy) return NextResponse.json({ success: true, data: { healthy: true, alerted: false } });

  const [checks, latestAlert] = await Promise.all([
    db.whatsAppEvent.findMany({ where: { type: "WATCHDOG_CHECK" }, orderBy: { createdAt: "desc" }, take: 500 }),
    db.whatsAppEvent.findFirst({ where: { type: "WATCHDOG_ALERT" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  const watchdog = evaluateWhatsAppWatchdog({
    checks: checks.map((event) => ({
      healthy: (event.payload as { healthy?: unknown }).healthy === true,
      createdAt: event.createdAt,
    })),
    latestAlertAt: latestAlert?.createdAt ?? null,
    checkedAt,
  });
  const { failedSince, minutesDown } = watchdog;
  if (!watchdog.shouldAlert) {
    return NextResponse.json({ success: true, data: { healthy: false, alerted: false, minutesDown } });
  }

  const config = await getWhatsAppConfig();
  const owner = config.ownerPhone
    ? await db.user.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } }).then((users) => users.find((user) => user.phone && normalizePhone(user.phone) === normalizePhone(config.ownerPhone!)) ?? null)
    : null;
  const targets = owner
    ? [owner.id]
    : (await db.user.findMany({ where: { OR: [{ roleCode: "ADMIN" }, { roleLegacy: "ADMIN" }] }, select: { id: true } })).map((admin) => admin.id);
  if (!targets.length) return NextResponse.json({ success: true, data: { healthy: false, alerted: false, minutesDown, reason: "no-notification-recipient" } });

  let pushSucceeded = false;
  try {
    const { sendPushNotification } = await import("@/lib/system-push");
    const result = await sendPushNotification({
      title: "Totem Bot desconectado",
      message: "El worker de WhatsApp no responde desde hace más de cinco minutos.",
      userIds: targets,
      url: "/admin/whatsapp",
    });
    pushSucceeded = result.success;
  } catch {
    // Secrets and transport errors are intentionally excluded from logs.
  }
  if (pushSucceeded) {
    await db.whatsAppEvent.create({
      data: { type: "WATCHDOG_ALERT", payload: { failedSince: failedSince.toISOString(), minutesDown } },
    });
  }
  return NextResponse.json({ success: true, data: { healthy: false, alerted: pushSucceeded, minutesDown } });
}

export async function GET(request: NextRequest) {
  return POST(request);
}

async function isWorkerHealthy(base: string): Promise<boolean> {
  try {
    const healthUrl = new URL(base);
    healthUrl.pathname = healthUrl.pathname.replace(/\/$/, "").endsWith("/health")
      ? healthUrl.pathname.replace(/\/$/, "")
      : `${healthUrl.pathname.replace(/\/$/, "")}/health`;
    healthUrl.search = "";
    healthUrl.hash = "";
    const response = await fetch(healthUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
