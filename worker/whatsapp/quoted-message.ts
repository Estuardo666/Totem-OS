import { proto, type WAMessage } from "@whiskeysockets/baileys";

export type QuotedInbound = {
  id: string;
  chatJid: string;
  senderJid: string;
  rawKey: unknown;
  type: string;
  text: string | null;
  fileName: string | null;
  ts: Date;
};

/** Rebuild the minimum original message envelope Baileys needs for a real quote. */
export function buildQuotedWhatsAppMessage(inbound: QuotedInbound) {
  const rawKey = isRecord(inbound.rawKey) ? inbound.rawKey : {};
  const key = {
    ...rawKey,
    remoteJid: typeof rawKey.remoteJid === "string" ? rawKey.remoteJid : inbound.chatJid,
    id: typeof rawKey.id === "string" ? rawKey.id : inbound.id,
    fromMe: rawKey.fromMe === true,
    ...(inbound.chatJid.endsWith("@g.us") ? { participant: typeof rawKey.participant === "string" ? rawKey.participant : inbound.senderJid } : {}),
  };
  const caption = inbound.text ?? undefined;
  let message: Record<string, unknown>;
  if (inbound.type === "video") {
    message = { videoMessage: { ...(caption ? { caption } : {}), ...(inbound.fileName ? { fileName: inbound.fileName } : {}), mimetype: "video/mp4" } };
  } else if (inbound.type === "document") {
    message = { documentMessage: { ...(caption ? { caption } : {}), ...(inbound.fileName ? { fileName: inbound.fileName } : {}), mimetype: "video/mp4" } };
  } else if (inbound.type === "image") {
    message = { imageMessage: { ...(caption ? { caption } : {}), mimetype: "image/jpeg" } };
  } else {
    message = { conversation: inbound.text ?? "" };
  }
  return proto.WebMessageInfo.fromObject({ key, message, messageTimestamp: Math.floor(inbound.ts.getTime() / 1000) } as never) as unknown as WAMessage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
