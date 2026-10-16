import { db } from "@/lib/db";
import { getWhatsAppConfig } from "./config";

export async function getWhatsAppStatus() {
  const [config, pending, draft, failed, openPrompts] = await Promise.all([
    getWhatsAppConfig(),
    db.whatsAppMessage.count({ where: { status: "PENDING" } }),
    db.whatsAppMessage.count({ where: { status: "DRAFT" } }),
    db.whatsAppMessage.count({ where: { status: "FAILED" } }),
    db.whatsAppOwnerPrompt.count({ where: { status: "OPEN", expiresAt: { gt: new Date() } } }),
  ]);
  const worker = await readWorkerHealth();
  return {
    paused: config.paused,
    clientsEnabled: config.clientsEnabled,
    queue: { pending, draft, failed },
    openPrompts,
    connected: worker.configured && !worker.disabled ? worker.connected : null,
    worker,
  };
}

async function readWorkerHealth() {
  const configuredUrl = process.env.WA_HEALTH_URL;
  if (!configuredUrl) return { configured: false, healthy: null, connected: null, disabled: null };
  try {
    const url = new URL(configuredUrl);
    url.pathname = url.pathname.replace(/\/$/, "").endsWith("/health")
      ? url.pathname.replace(/\/$/, "")
      : `${url.pathname.replace(/\/$/, "")}/health`;
    url.search = "";
    url.hash = "";
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    const payload = await response.json().catch(() => null) as { connected?: unknown; disabled?: unknown } | null;
    return {
      configured: true,
      healthy: response.ok,
      connected: typeof payload?.connected === "boolean" ? payload.connected : null,
      disabled: typeof payload?.disabled === "boolean" ? payload.disabled : null,
    };
  } catch {
    return { configured: true, healthy: false, connected: false, disabled: null };
  }
}
