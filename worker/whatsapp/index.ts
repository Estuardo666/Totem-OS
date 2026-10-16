import makeWASocket, { DisconnectReason, type Contact, type WASocket } from "@whiskeysockets/baileys";
import pino from "pino";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { getWhatsAppConfig } from "../../src/lib/whatsapp/config";
import { createOwnerPrompt, recordWhatsAppEvent } from "../../src/lib/whatsapp/prompts";
import { proposeWhatsAppRollout } from "../../src/lib/whatsapp/rollout";
import { enqueueWhatsAppTeamDailySummaries } from "../../src/lib/whatsapp/team-daily";
import { deliverOwnerPrompts } from "./owner-control";
import { handleMessagesUpsert } from "./listener";
import { identifyContact } from "./contacts";
import { syncWhatsAppGroups } from "./groups";
import { recoverStaleSendingMessages, sendNextWhatsAppMessage } from "./sender";
import { useWhatsAppAuthState } from "./auth-store";
import { acquireWhatsAppLock, refreshWhatsAppLock, releaseWhatsAppLock } from "./lock";
import { startHealthServer, type WhatsAppHealthState } from "./health";
import { matchesExpectedWhatsAppIdentity } from "./pairing-guard";
import { shouldStartSRIWorker } from "./sri-start-policy";

const INSTANCE_ID = `${process.env.WA_INSTANCE_ID ?? "totem"}:${randomUUID()}`;
// Connecting to WhatsApp requires the explicit production opt-in WA_DISABLED=0.
const DISABLED = process.env.WA_DISABLED !== "0";
const PAIRING_ONLY = process.env.WA_PAIRING_ONLY === "1";
const state: WhatsAppHealthState = { connected: false, connectedId: null, qr: null, startedAt: new Date(), lastHeartbeatAt: null, disabled: DISABLED, lockHeld: false, pairingOnly: PAIRING_ONLY };
const server = startHealthServer(state);
let running = true;
let socket: WASocket | null = null;
let connecting = false;
let reconnectDelay = 5_000;
let lastGroupSync = 0;
let lastHeartbeat = 0;
let lastLockRefresh = 0;
let lastRolloutCheck = 0;
let lastCleanupAt = Date.now();
let lastPromptExpirationAt = 0;
let maintenanceRunning = false;
let lastTeamDailyMinute = -1;
let lastFailureAlertCheck = 0;
let lastLoopFailureLogAt = 0;
let reconnectBlocked = false;
let qrOwnerNotified = false;
let loggedOutOwnerNotified = false;
let freshQrReconnectAttempted = false;

type OwnerNotificationEvent = "QR_REQUIRED" | "LOGGED_OUT";

export async function startWhatsAppWorker() {
  if (shouldStartSRIWorker({ sriEnabled: process.env.SRI_ENABLED, pairingOnly: PAIRING_ONLY })) {
    const { startSRIWorker } = await import("../index");
    void startSRIWorker().catch(() => undefined);
  }
  if (!PAIRING_ONLY) await recoverStaleSendingMessages();
  while (running) {
    try {
      if (!state.lockHeld) {
        if (!(await acquireWhatsAppLock(INSTANCE_ID))) {
          await sleep(15_000);
          continue;
        }
        lastLockRefresh = Date.now();
      }
      state.lockHeld = true;
      if (Date.now() - lastHeartbeat >= 60_000) {
        await recordWhatsAppEvent({ type: "CONNECTION", payload: { state: DISABLED ? "DISABLED" : state.connected ? "CONNECTED" : "RUNNING", instanceId: INSTANCE_ID } });
        state.lastHeartbeatAt = new Date();
        lastHeartbeat = Date.now();
      }
      if (!DISABLED && !reconnectBlocked && !socket) await connectWhatsApp();
      await runMaintenance();
      await sleep(1_000);
    } catch (error) {
      if (Date.now() - lastLoopFailureLogAt >= 60_000) {
        lastLoopFailureLogAt = Date.now();
        const code = typeof error === "object" && error !== null && "code" in error
          && typeof error.code === "string" && /^P\d{4}$/.test(error.code)
          ? error.code
          : error instanceof Error ? error.name : "UNKNOWN";
        console.error("WHATSAPP_WORKER_LOOP_ERROR", code);
      }
      await sleep(5_000);
    }
  }
}

async function connectWhatsApp() {
  if (!state.lockHeld || DISABLED || !running || reconnectBlocked || connecting) return;
  connecting = true;
  let wa: WASocket;
  let saveCreds: () => Promise<void> = async () => undefined;
  let getCredsIdentity: () => string | undefined = () => undefined;
  try {
    const authState = await useWhatsAppAuthState();
    saveCreds = authState.saveCreds;
    getCredsIdentity = () => authState.state.creds.me?.id;
    wa = makeWASocket({
      auth: authState.state,
      logger: pino({ level: "silent" }),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      browser: ["Totem Bot", "Chrome", "1.0"],
    });
    socket = wa;
  } catch (error) {
    connecting = false;
    throw error;
  }
  connecting = false;
  wa.ev.on("creds.update", saveCreds);
  if (!PAIRING_ONLY) {
    wa.ev.on("messages.upsert", ({ messages, type }) => {
      if (type === "notify") void handleMessagesUpsert(messages).catch(() => undefined);
    });
    wa.ev.on("contacts.upsert", (contacts) => { void handleContactUpdates(contacts).catch(() => undefined); });
    wa.ev.on("contacts.update", (contacts) => { void handleContactUpdates(contacts).catch(() => undefined); });
  }
  wa.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      state.qr = qr;
      await recordWhatsAppEvent({ type: "CONNECTION", payload: { state: "QR_PENDING" } });
      if (!PAIRING_ONLY && !qrOwnerNotified) {
        qrOwnerNotified = true;
        if (!loggedOutOwnerNotified) await notifyOwner("QR_REQUIRED");
      }
    }
    if (connection === "open") {
      const expectedPhone = process.env.WA_BOT_PHONE ?? "593994782827";
      const socketIdentity = wa.user?.id;
      const identities = [socketIdentity, getCredsIdentity()].filter((identity): identity is string => typeof identity === "string");
      if (!socketIdentity || !matchesExpectedWhatsAppIdentity(expectedPhone, identities)) {
        state.connected = false;
        state.connectedId = null;
        state.qr = null;
        reconnectBlocked = true;
        await recordWhatsAppEvent({ type: "ACCOUNT_MISMATCH", payload: { state: "BLOCKED" } }).catch(() => undefined);
        wa.end(new Error("WhatsApp account identity mismatch"));
        return;
      }
      state.connected = true;
      state.connectedId = "verified";
      state.qr = null;
      reconnectDelay = 5_000;
      qrOwnerNotified = false;
      loggedOutOwnerNotified = false;
      freshQrReconnectAttempted = false;
      await recordWhatsAppEvent({ type: "CONNECTION", payload: { state: "CONNECTED" } });
      if (!PAIRING_ONLY) void ensureWhatsAppTestGroup(wa).then(() => syncWhatsAppGroups(wa)).then(() => { lastGroupSync = Date.now(); }).catch(() => undefined);
    }
    if (connection === "close") {
      state.connected = false;
      state.connectedId = null;
      socket = null;
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
      await recordWhatsAppEvent({ type: "CONNECTION", payload: { state: statusCode === DisconnectReason.loggedOut ? "LOGGED_OUT" : "DISCONNECTED", statusCode: statusCode ?? null } });
      if (PAIRING_ONLY) {
        if (statusCode === DisconnectReason.loggedOut) reconnectBlocked = true;
        else if (!reconnectBlocked) {
          reconnectDelay = Math.min(Math.max(5_000, reconnectDelay * 2), 5 * 60_000);
          setTimeout(() => { if (running && state.lockHeld && !socket && !reconnectBlocked) void connectWhatsApp(); }, reconnectDelay);
        }
        return;
      }
      if (statusCode === DisconnectReason.loggedOut) {
        reconnectBlocked = true;
        state.qr = null;
        if (!loggedOutOwnerNotified) {
          loggedOutOwnerNotified = true;
          await notifyOwner("LOGGED_OUT");
        }
        if (!freshQrReconnectAttempted) {
          freshQrReconnectAttempted = true;
          try {
            await db.whatsAppAuth.deleteMany({});
          } catch {
            await recordWhatsAppEvent({ type: "ERROR", payload: { action: "AUTH_RESET", errorCode: "AUTH_CLEAR_FAILED" } }).catch(() => undefined);
            return;
          }
          setTimeout(() => {
            if (!running || !state.lockHeld || socket) return;
            reconnectBlocked = false;
            void connectWhatsApp().catch(() => { reconnectBlocked = true; });
          }, 1_500);
        }
      } else if (!reconnectBlocked) {
        reconnectDelay = Math.min(Math.max(5_000, reconnectDelay * 2), 5 * 60_000);
        setTimeout(() => { if (running && state.lockHeld && !socket) void connectWhatsApp(); }, reconnectDelay);
      }
    }
  });
}

async function handleContactUpdates(contacts: Array<Partial<Contact>>) {
  for (const contact of contacts) {
    const id = contact.id;
    if (!id) continue;
    const lid = contact.lid ?? (id.endsWith("@lid") ? id : null);
    const pn = contact.jid ?? (id.endsWith("@s.whatsapp.net") ? id : null);
    await identifyContact(lid ?? pn ?? id, lid && pn ? pn : undefined, contact.notify ?? contact.name);
  }
}

async function ensureWhatsAppTestGroup(wa: WASocket) {
  const existing = Object.values(await wa.groupFetchAllParticipating()).find((group) => /totem bot\s*[–-]\s*pruebas/i.test(group.subject ?? ""));
  if (existing) return existing.id;

  const config = await getWhatsAppConfig();
  const users = await db.user.findMany({ where: { phone: { not: null } }, select: { phone: true } });
  const participantJids = [...new Set([
    config.ownerPhone,
    ...users.map((user) => user.phone),
  ].filter((phone): phone is string => Boolean(phone)).map(toWhatsAppJid).filter(Boolean))];
  if (!participantJids.length) return null;

  const created = await wa.groupCreate("Totem Bot – Pruebas", participantJids);
  if (!created.id) return null;
  await db.whatsAppGroup.upsert({
    where: { jid: created.id },
    create: { jid: created.id, name: "Totem Bot – Pruebas", purposes: ["TEST"], enabled: true, participants: created.participants as never, lastSeenAt: new Date() },
    update: { name: "Totem Bot – Pruebas", purposes: ["TEST"], enabled: true, participants: created.participants as never, lastSeenAt: new Date() },
  });
  await markRolloutTestStarted(created.id, participantJids.length);
  return created.id;
}

async function markRolloutTestStarted(groupJid: string, participantCount: number) {
  const existing = await db.whatsAppEvent.findFirst({ where: { type: "ROLLOUT_TEST_STARTED", groupJid }, select: { id: true } });
  if (!existing && participantCount > 0) {
    await recordWhatsAppEvent({ type: "ROLLOUT_TEST_STARTED", groupJid, payload: { participantCount } });
  }
}

function toWhatsAppJid(phone: string) {
  let digits = phone.replace(/\D/g, "").replace(/^00/, "");
  if (digits.startsWith("0") && digits.length === 10) digits = `593${digits.slice(1)}`;
  if (digits.startsWith("9") && digits.length === 9) digits = `593${digits}`;
  return /^\d{7,15}$/.test(digits) ? `${digits}@s.whatsapp.net` : "";
}

async function runMaintenance() {
  if (maintenanceRunning) return;
  maintenanceRunning = true;
  try {
    if (Date.now() - lastLockRefresh >= 30_000) {
      if (!(await assertCurrentLock())) return;
      lastLockRefresh = Date.now();
    }
    if (PAIRING_ONLY) return;
    await expireStaleData();
    if (!DISABLED && state.connected && socket) {
      if (Date.now() - lastGroupSync >= 6 * 60 * 60 * 1000) {
        await syncWhatsAppGroups(socket);
        lastGroupSync = Date.now();
      }
      const minute = Math.floor(Date.now() / 60_000);
      if (minute !== lastTeamDailyMinute) {
        lastTeamDailyMinute = minute;
        await enqueueWhatsAppTeamDailySummaries(new Date()).catch(() => undefined);
      }
      await sendNextWhatsAppMessage(socket, async () => {
        if (!(await assertCurrentLock())) return false;
        const latest = await getWhatsAppConfig();
        return !latest.paused && state.lockHeld;
      });
      await deliverOwnerPrompts();
      if (Date.now() - lastFailureAlertCheck >= 60_000) {
        lastFailureAlertCheck = Date.now();
        await alertFailedWhatsAppMessages();
      }
    }
    if (Date.now() - lastRolloutCheck >= 60 * 60_000) {
      await proposeWhatsAppRollout();
      lastRolloutCheck = Date.now();
    }
  } finally { maintenanceRunning = false; }
}

async function assertCurrentLock() {
  if (await refreshWhatsAppLock(INSTANCE_ID)) {
    lastLockRefresh = Date.now();
    return true;
  }
  state.lockHeld = false;
  state.connected = false;
  const old = socket;
  socket = null;
  old?.end(new Error("worker lock lost"));
  return false;
}

async function alertFailedWhatsAppMessages() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [failed, events] = await Promise.all([
    db.whatsAppMessage.findMany({ where: { status: "FAILED", createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, take: 100, select: { id: true, kind: true } }),
    db.whatsAppEvent.findMany({ where: { type: "MESSAGE_FAILURE_ALERTED", createdAt: { gte: since } }, select: { payload: true } }),
  ]);
  const reported = new Set(events.flatMap((event) => {
    const payload = event.payload as { messageIds?: unknown };
    return Array.isArray(payload.messageIds) ? payload.messageIds.filter((id): id is string => typeof id === "string") : [];
  }));
  const unreported = failed.filter((message) => !reported.has(message.id));
  if (!unreported.length) return;
  const counts = new Map<string, number>();
  for (const item of unreported) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  const summary = [...counts].map(([kind, count]) => `${count} ${kind}`).join(", ");
  await createOwnerPrompt({
    type: "ALERT",
    payload: { summary: `No se pudieron enviar ${unreported.length} mensajes de WhatsApp en las últimas 24 horas (${summary}).`, messageIds: unreported.map((item) => item.id) },
    options: ["Revisar en Totem"],
  });
  await recordWhatsAppEvent({ type: "MESSAGE_FAILURE_ALERTED", payload: { messageIds: unreported.map((item) => item.id) } });
}

async function expireStaleData() {
  const now = Date.now();
  if (now - lastPromptExpirationAt >= 60_000) {
    lastPromptExpirationAt = now;
    await db.whatsAppOwnerPrompt.updateMany({ where: { status: "OPEN", expiresAt: { lte: new Date(now) } }, data: { status: "EXPIRED" } });
  }
  if (now - lastCleanupAt >= 24 * 60 * 60 * 1000) {
    lastCleanupAt = now;
    await db.whatsAppInbound.deleteMany({ where: { ts: { lt: new Date(now - 14 * 86_400_000) } } });
  }
}

async function notifyOwner(event: OwnerNotificationEvent) {
  const apiUrl = process.env.TOTEM_API_URL;
  const secret = process.env.WA_WORKER_SECRET;
  if (!apiUrl || !secret || secret.length < 32) {
    await auditOwnerNotificationFailure(event, "NOTIFY_CONFIG_MISSING");
    return;
  }
  try {
    const response = await fetch(new URL("/api/internal/whatsapp/notify", apiUrl), {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) await auditOwnerNotificationFailure(event, `NOTIFY_HTTP_${response.status}`);
  } catch {
    await auditOwnerNotificationFailure(event, "NOTIFY_API_UNAVAILABLE");
  }
}

async function auditOwnerNotificationFailure(event: OwnerNotificationEvent, errorCode: string) {
  try {
    await recordWhatsAppEvent({ type: "ERROR", payload: { action: "OWNER_NOTIFY", event, errorCode } });
  } catch {
    // Do not log the target URL, token, or response body if the audit store is unavailable.
    console.error("WHATSAPP_OWNER_NOTIFY_FAILED", errorCode);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function shutdown() {
  running = false;
  socket?.end(undefined);
  server.close();
  if (state.lockHeld) await releaseWhatsAppLock(INSTANCE_ID).catch(() => undefined);
  await db.$disconnect();
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

if (require.main === module || process.env.TOTEM_WHATSAPP_WORKER === "1") {
  void startWhatsAppWorker().catch(async () => { await shutdown(); process.exitCode = 1; });
}
