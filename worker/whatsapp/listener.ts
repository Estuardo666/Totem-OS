import { db } from "../../src/lib/db";
import { identifyContact, saveLidMappings, resolveContact } from "./contacts";
import { detectVideoApproval, routeClientApprovalReply } from "./approvals";
import { draftClientReply } from "./ai-reply";
import { handleOwnerReply } from "./owner-control";

type WaMessage = { key?: { id?: string; remoteJid?: string | null; participant?: string | null; participantAlt?: string | null; fromMe?: boolean }; message?: Record<string, any>; messageTimestamp?: number | LongLike; pushName?: string | null };
type LongLike = { toNumber?: () => number };

export async function handleMessagesUpsert(messages: unknown[]) {
  for (const raw of messages) {
    const item = raw as WaMessage;
    const id = item.key?.id;
    const chatJid = item.key?.remoteJid;
    if (!id || !chatJid || !item.message) continue;
    const fromMe = item.key?.fromMe === true;
    if (fromMe && await db.whatsAppMessage.findFirst({ where: { waMessageId: id }, select: { id: true } })) continue;
    const group = chatJid.endsWith("@g.us");
    const senderJid = group ? item.key?.participant ?? item.key?.participantAlt : chatJid;
    if (!senderJid) continue;
    const contact = await identifyContact(senderJid, item.key?.participantAlt, item.pushName) ?? await resolveContact(senderJid) ?? await resolveContact(item.key?.participantAlt ?? "");
    const isTeam = Boolean(contact?.userId) || fromMe;
    const parsed = readPayload(item.message);
    const stamp = typeof item.messageTimestamp === "number" ? item.messageTimestamp : item.messageTimestamp?.toNumber?.() ?? Math.floor(Date.now() / 1000);
    const ts = new Date(stamp * 1000);
    try {
      await db.whatsAppInbound.create({ data: { id, chatJid, senderJid, isTeam, type: parsed.type, text: parsed.text, fileName: parsed.fileName, quotedId: parsed.quotedId, rawKey: item.key as never, ts } });
    } catch (error) {
      // Baileys may redeliver the same upsert after a reconnect; the id is unique.
      if (!isUniqueViolation(error)) throw error;
      continue;
    }
    if (!group) {
      if (!fromMe) await handleOwnerReply(contact?.pnJid ?? senderJid, parsed.text ?? "");
      continue;
    }
    await cancelPendingApprovalReminders(chatJid, ts, id);
    const inbound = { id, groupJid: chatJid, senderJid, fileName: parsed.fileName, caption: parsed.text, quotedId: parsed.quotedId, isTeam, type: parsed.type, ts };
    if (fromMe) {
      if (parsed.isVideo) await detectVideoApproval(inbound);
      continue;
    }
    if (isTeam && parsed.isVideo) await detectVideoApproval(inbound);
    else {
      await routeClientApprovalReply(inbound);
      if (parsed.text) await draftClientReply({ groupJid: chatJid, inboundId: id, text: parsed.text, quotedId: parsed.quotedId });
    }
  }
}

async function cancelPendingApprovalReminders(groupJid: string, receivedAt: Date, inboundId: string) {
  const requests = await db.whatsAppApprovalRequest.findMany({
    where: { groupJid, status: "PENDING", messageId: { not: inboundId }, sentAt: { lte: receivedAt } },
    select: { messageId: true },
  });
  if (!requests.length) return;
  await db.whatsAppMessage.updateMany({
    where: { to: groupJid, kind: "APPROVAL_REMINDER", status: "PENDING", quotedId: { in: requests.map((request) => request.messageId) } },
    data: { status: "CANCELLED", error: "GROUP_ACTIVITY_AFTER_VIDEO" },
  });
}

export async function handleLidMappingUpdate(mappings: Array<{ lid: string; pn: string; pushName?: string }>) {
  await saveLidMappings(mappings);
}

function readPayload(message: Record<string, any>) {
  const content = message.ephemeralMessage?.message ?? message.viewOnceMessage?.message ?? message;
  const text = content.conversation ?? content.extendedTextMessage?.text ?? content.videoMessage?.caption ?? content.documentMessage?.caption ?? content.imageMessage?.caption ?? content.audioMessage?.caption ?? null;
  const quotedId = content.extendedTextMessage?.contextInfo?.stanzaId ?? content.videoMessage?.contextInfo?.stanzaId ?? content.documentMessage?.contextInfo?.stanzaId ?? content.imageMessage?.contextInfo?.stanzaId ?? null;
  if (content.videoMessage) return { type: "video", isVideo: true, text, fileName: content.videoMessage.fileName ?? null, quotedId };
  if (content.documentMessage) {
    const mime = String(content.documentMessage.mimetype ?? "").toLowerCase();
    return { type: "document", isVideo: mime.startsWith("video/"), text, fileName: content.documentMessage.fileName ?? null, quotedId };
  }
  if (content.imageMessage) return { type: "image", isVideo: false, text, fileName: null, quotedId };
  if (content.audioMessage) return { type: "audio", isVideo: false, text, fileName: null, quotedId };
  if (text) return { type: "text", isVideo: false, text: String(text), fileName: null, quotedId };
  return { type: "other", isVideo: false, text: null, fileName: null, quotedId };
}

function isUniqueViolation(error: unknown) { return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002"; }
