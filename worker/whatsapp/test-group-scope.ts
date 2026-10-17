export const TEST_WHATSAPP_GROUP_NAME = "Totem Bot – Pruebas";
export const TEST_WHATSAPP_GROUP_START_MESSAGE = "TOTEM E2E START";

type LooseRecord = Record<string, any>;

export function filterMessagesToWhatsAppGroup(messages: unknown[], groupJid?: string | null) {
  if (!groupJid) return [];
  return messages.filter((raw) => (raw as LooseRecord | null)?.key?.remoteJid === groupJid);
}

export function isWhatsAppTestGroupSubject(subject: string | undefined) {
  return Boolean(subject && /^totem bot\s*[–-]\s*pruebas$/i.test(subject.trim()));
}

export function isWhatsAppTestGroupStartMessage(raw: unknown) {
  const item = raw as LooseRecord | null;
  const message = item?.message as LooseRecord | undefined;
  if (!message) return false;
  const content = (message.ephemeralMessage as LooseRecord | undefined)?.message
    ?? (message.viewOnceMessage as LooseRecord | undefined)?.message
    ?? message;
  const text = (content as LooseRecord).conversation
    ?? ((content as LooseRecord).extendedTextMessage as LooseRecord | undefined)?.text
    ?? ((content as LooseRecord).videoMessage as LooseRecord | undefined)?.caption
    ?? ((content as LooseRecord).documentMessage as LooseRecord | undefined)?.caption
    ?? ((content as LooseRecord).imageMessage as LooseRecord | undefined)?.caption;
  return typeof text === "string" && text.trim() === TEST_WHATSAPP_GROUP_START_MESSAGE;
}
