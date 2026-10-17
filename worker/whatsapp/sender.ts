import { readFunctionalTestScope, functionalMessageWhere } from "./functional-test-policy";
import { db } from "../../src/lib/db";
import type { WASocket } from "@whiskeysockets/baileys";
import { canSendToWhatsAppDestination } from "../../src/lib/whatsapp/enqueue";
import { getWhatsAppConfig } from "../../src/lib/whatsapp/config";
import { recordWhatsAppEvent } from "../../src/lib/whatsapp/prompts";
import { buildQuotedWhatsAppMessage } from "./quoted-message";
import { ecuadorDayStart } from "./text";

type SenderSocket = Pick<WASocket, "sendMessage" | "sendPresenceUpdate">;

export async function sendNextWhatsAppMessage(
  socket: SenderSocket,
  assertLock: () => Promise<boolean>,
  options: { sleep?: (ms: number) => Promise<void> } = {},
): Promise<boolean> {
  const scope = readFunctionalTestScope(process.env);
  const wait = options.sleep ?? sleep;
  const config = await getWhatsAppConfig();
  if (config.paused) return false;
  const message = await db.whatsAppMessage.findFirst({ where: { ...(scope ? functionalMessageWhere(scope) : {}), status: "PENDING", scheduledFor: { lte: new Date() } }, orderBy: { scheduledFor: "asc" } });
  if (!message) return false;
  const claim = await db.whatsAppMessage.updateMany({ where: { id: message.id, status: "PENDING" }, data: { status: "SENDING", attempts: { increment: 1 }, error: null } });
  if (!claim.count) return true;
  let claimedClientId: string | null = null;
  let sendStarted = false;
  try {
    if (message.to.endsWith("@g.us")) {
      const claimGroup = await db.whatsAppGroup.findUnique({ where: { jid: message.to }, select: { clientId: true } });
      claimedClientId = claimGroup?.clientId ?? null;
    }
    if (!(await isMessageAllowed(message.to, message.kind, claimedClientId))) throw new Error("DESTINATION_BLOCKED");
    const sentSince = new Date(Date.now() - 60 * 60 * 1000);
    const sentToday = ecuadorDayStart();
    const [hourly, daily] = await Promise.all([
      db.whatsAppMessage.count({ where: { status: "SENT", sentAt: { gte: sentSince } } }),
      db.whatsAppMessage.count({ where: { status: "SENT", sentAt: { gte: sentToday } } }),
    ]);
    if (hourly >= 20 || daily >= 150) {
      await db.whatsAppMessage.update({ where: { id: message.id }, data: { status: "PENDING", scheduledFor: new Date(Date.now() + 60 * 60 * 1000) } });
      return true;
    }
    await wait(randomBetween(5_000, 30_000));
    const latestConfig = await getWhatsAppConfig();
    if (latestConfig.paused) throw new Error("SEND_GUARD_BLOCKED");
    if (!(await isMessageAllowed(message.to, message.kind, claimedClientId))) throw new Error("GROUP_POLICY_CHANGED");
    if (!(await assertLock())) throw new Error("LOCK_LOST");
    await assertAiReplyAllowed(message.to, message.kind, message.quotedId);
    await assertApprovalReminderAllowed(message.to, message.kind, message.quotedId);
    await assertApprovalConfirmationAllowed(message.to, message.kind, message.quotedId);
    await socket.sendPresenceUpdate("composing", message.to).catch(() => undefined);
    await wait(randomBetween(1_000, 3_000));
    const finalConfig = await getWhatsAppConfig();
    if (finalConfig.paused) throw new Error("SEND_GUARD_BLOCKED");
    if (!(await isMessageAllowed(message.to, message.kind, claimedClientId))) throw new Error("GROUP_POLICY_CHANGED");
    await assertAiReplyAllowed(message.to, message.kind, message.quotedId);
    await assertApprovalReminderAllowed(message.to, message.kind, message.quotedId);
    await assertApprovalConfirmationAllowed(message.to, message.kind, message.quotedId);
    if (!(await assertLock())) throw new Error("LOCK_LOST");
    const quotedMessage = message.quotedId ? await findQuotedMessage(message.quotedId) : null;
    if (message.quotedId && !quotedMessage && ["APPROVAL_REMINDER", "APPROVAL_CONFIRM", "AI_REPLY"].includes(message.kind)) throw new Error("QUOTE_UNAVAILABLE");
    sendStarted = true;
    const result = await socket.sendMessage(message.to, { text: message.body }, quotedMessage ? { quoted: quotedMessage } : undefined);
    await socket.sendPresenceUpdate("paused", message.to).catch(() => undefined);
    await db.whatsAppMessage.update({ where: { id: message.id }, data: { status: "SENT", sentAt: new Date(), waMessageId: result?.key?.id ?? null, error: null } });
    await recordWhatsAppEvent({ type: "MESSAGE_SENT", groupJid: message.to.endsWith("@g.us") ? message.to : undefined, payload: { messageId: message.id, kind: message.kind } });
  } catch (error) {
    const safeCodes = new Set(["DESTINATION_BLOCKED", "GROUP_DISABLED", "APPROVAL_STALE", "GROUP_ACTIVITY_AFTER_VIDEO", "TEAM_REPLIED", "AI_QUESTION_STALE", "AI_RATE_LIMIT", "SEND_GUARD_BLOCKED", "LOCK_LOST", "QUOTE_UNAVAILABLE", "PURPOSE_DISABLED", "GROUP_POLICY_CHANGED"]);
    const rawReason = error instanceof Error ? error.message : "";
    const reason = safeCodes.has(rawReason) ? rawReason : "SEND_FAILED";
    const drop = ["DESTINATION_BLOCKED", "GROUP_DISABLED", "APPROVAL_STALE", "GROUP_ACTIVITY_AFTER_VIDEO", "TEAM_REPLIED", "AI_QUESTION_STALE", "QUOTE_UNAVAILABLE", "PURPOSE_DISABLED", "GROUP_POLICY_CHANGED"].includes(reason);
    const ambiguous = sendStarted;
    const deferred = ["SEND_GUARD_BLOCKED", "AI_RATE_LIMIT", "LOCK_LOST"].includes(reason);
    const retryableAttempt = !drop && !ambiguous && !deferred;
    const exhausted = retryableAttempt && message.attempts + 1 >= 3;
    const status = drop ? "CANCELLED" : ambiguous || exhausted ? "FAILED" : "PENDING";
    await db.whatsAppMessage.update({ where: { id: message.id }, data: { status, ...(deferred ? { attempts: { decrement: 1 } } : {}), scheduledFor: status === "PENDING" ? new Date(Date.now() + 60_000) : message.scheduledFor, error: ambiguous ? "SEND_RESULT_UNKNOWN_REQUIRES_REVIEW" : reason } });
    if (status === "FAILED") await recordWhatsAppEvent({ type: "ERROR", groupJid: message.to.endsWith("@g.us") ? message.to : undefined, payload: { messageId: message.id, kind: message.kind, errorCode: reason } });
    else if (status === "CANCELLED") await recordWhatsAppEvent({ type: "MESSAGE_CANCELLED", groupJid: message.to.endsWith("@g.us") ? message.to : undefined, payload: { messageId: message.id, kind: message.kind, reason } });
  }
  return true;
}

async function isMessageAllowed(to: string, kind: string, claimedClientId: string | null) {
  if (!(await canSendToWhatsAppDestination(to))) return false;
  if (!to.endsWith("@g.us")) return true;
  const group = await db.whatsAppGroup.findUnique({ where: { jid: to }, select: { enabled: true, clientId: true, purposes: true, aiMode: true } });
  if (!group?.enabled || group.clientId !== claimedClientId) return false;
  const requiredPurpose: Record<string, string> = {
    SHOOT_REMINDER: "SHOOT",
    PAYMENT_REMINDER: "PAYMENT",
    APPROVAL_REMINDER: "APPROVAL",
    APPROVAL_CONFIRM: "APPROVAL",
    APPROVAL_QUESTION: "APPROVAL",
    AI_REPLY: "AI_QA",
  };
  const purpose = requiredPurpose[kind];
  if (purpose && !group.purposes.includes(purpose)) return false;
  if (kind === "AI_REPLY" && !["DRAFT", "AUTO"].includes(group.aiMode)) return false;
  if (purpose) return true;
  return group.clientId !== null || group.purposes.includes("TEST");
}

async function findQuotedMessage(id: string) {
  const inbound = await db.whatsAppInbound.findUnique({ where: { id } });
  return inbound ? buildQuotedWhatsAppMessage(inbound) : null;
}

async function assertAiReplyAllowed(to: string, kind: string, questionId: string | null) {
  if (kind !== "AI_REPLY") return;
  if (!questionId) throw new Error("AI_QUESTION_STALE");
  const question = await db.whatsAppInbound.findUnique({ where: { id: questionId }, select: { ts: true } });
  if (!question) throw new Error("AI_QUESTION_STALE");
  const [questionEvent, group] = await Promise.all([
    db.whatsAppEvent.findFirst({ where: { type: "AI_QUESTION", groupJid: to, payload: { path: ["inboundId"], equals: questionId } }, orderBy: { createdAt: "desc" }, select: { payload: true } }),
    db.whatsAppGroup.findUnique({ where: { jid: to }, select: { clientId: true } }),
  ]);
  const expectedClientId = questionEvent?.payload && typeof questionEvent.payload === "object" ? (questionEvent.payload as { clientId?: unknown }).clientId : null;
  if (typeof expectedClientId !== "string" || group?.clientId !== expectedClientId) throw new Error("GROUP_POLICY_CHANGED");
  const teamReply = await db.whatsAppInbound.findFirst({ where: { chatJid: to, id: { not: questionId }, isTeam: true, ts: { gte: question.ts } }, select: { id: true } });
  if (teamReply) throw new Error("TEAM_REPLIED");
  const recentAi = await db.whatsAppMessage.count({ where: { to, kind: "AI_REPLY", status: "SENT", sentAt: { gte: new Date(Date.now() - 60_000) } } });
  if (recentAi) throw new Error("AI_RATE_LIMIT");
}

async function assertApprovalReminderAllowed(to: string, kind: string, quotedId: string | null) {
  if (kind !== "APPROVAL_REMINDER") return;
  if (!quotedId) throw new Error("APPROVAL_STALE");
  const request = await db.whatsAppApprovalRequest.findFirst({
    where: { groupJid: to, messageId: quotedId, status: "PENDING" },
    select: { sentAt: true, task: { select: { clientId: true } } },
  });
  if (!request?.task) throw new Error("APPROVAL_STALE");
  const group = await db.whatsAppGroup.findUnique({ where: { jid: to }, select: { clientId: true } });
  if (!group || group.clientId !== request.task.clientId) throw new Error("GROUP_POLICY_CHANGED");
  const laterMessage = await db.whatsAppInbound.findFirst({
    where: { chatJid: to, id: { not: quotedId }, ts: { gte: request.sentAt } },
    select: { id: true },
  });
  if (laterMessage) throw new Error("GROUP_ACTIVITY_AFTER_VIDEO");
}

async function assertApprovalConfirmationAllowed(to: string, kind: string, quotedId: string | null) {
  if (kind !== "APPROVAL_CONFIRM") return;
  if (!quotedId) throw new Error("APPROVAL_STALE");
  const request = await db.whatsAppApprovalRequest.findFirst({
    where: { groupJid: to, messageId: quotedId, status: "APPROVED" },
    select: { task: { select: { clientId: true } } },
  });
  const group = await db.whatsAppGroup.findUnique({ where: { jid: to }, select: { clientId: true } });
  if (!request?.task || !group || group.clientId !== request.task.clientId) throw new Error("GROUP_POLICY_CHANGED");
}

export async function recoverStaleSendingMessages() {
  await db.whatsAppMessage.updateMany({ where: { status: "SENDING", createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } }, data: { status: "FAILED", error: "SEND_RESULT_UNKNOWN_REQUIRES_REVIEW" } });
}

const randomBetween = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
