import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getWhatsAppConfig } from "./config";

export type WhatsAppMessageKind =
  | "TEAM_DAILY" | "SHOOT_REMINDER" | "PAYMENT_REMINDER" | "APPROVAL_REMINDER"
  | "APPROVAL_CONFIRM" | "AI_REPLY" | "OWNER_PROMPT" | "MANUAL";

export interface EnqueueWhatsAppInput {
  to: string;
  body: string;
  kind: WhatsAppMessageKind | string;
  dedupeKey?: string | null;
  scheduledFor?: Date;
  draft?: boolean;
  quotedId?: string | null;
  createdById?: string | null;
  approvedById?: string | null;
}

export async function enqueueWhatsApp(input: EnqueueWhatsAppInput) {
  const to = input.to.trim();
  const body = input.body.trim();
  if (!to || !body) throw new Error("Destino y mensaje son obligatorios");
  if (body.length > 4096) throw new Error("El mensaje supera el límite permitido");
  if (!(await canSendToWhatsAppDestination(to))) throw new Error("Destino WhatsApp bloqueado por configuración o permisos");

  const data = {
    to,
    body,
    kind: input.kind,
    dedupeKey: input.dedupeKey || null,
    scheduledFor: input.scheduledFor ?? new Date(),
    status: input.draft ? "DRAFT" : "PENDING",
    quotedId: input.quotedId ?? null,
    createdById: input.createdById ?? null,
    approvedById: input.approvedById ?? null,
  };

  try {
    const row = await db.whatsAppMessage.create({ data });
    return { id: row.id, created: true, status: row.status, deduped: false };
  } catch (error) {
    if (input.dedupeKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.whatsAppMessage.findUnique({ where: { dedupeKey: input.dedupeKey } });
      if (existing) return { id: existing.id, created: false, status: existing.status, deduped: true };
    }
    throw error;
  }
}

/** Fail closed: groups need explicit enablement; private chats need an opted-in team contact or owner. */
export async function canSendToWhatsAppDestination(to: string): Promise<boolean> {
  const config = await getWhatsAppConfig();
  // Pause is a global hard stop. Owner prompts are queued only while running.
  if (config.paused) return false;

  if (to.endsWith("@g.us")) {
    const group = await db.whatsAppGroup.findUnique({ where: { jid: to }, select: { enabled: true, clientId: true, purposes: true } });
    if (!group?.enabled) return false;
    const testGroup = group.clientId === null && group.purposes.includes("TEST");
    return testGroup || config.clientsEnabled;
  }

  // Accept only canonical WhatsApp private JIDs. Unknown destinations are never sent.
  if (!/^\d{7,15}@s\.whatsapp\.net$/.test(to)) return false;
  const number = to.slice(0, to.indexOf("@"));
  if (config.ownerPhone && normalizePhone(config.ownerPhone) === number) return true;
  const optedInUsers = await db.user.findMany({
    where: { whatsappOptIn: true, phone: { not: null } },
    select: { phone: true },
  });
  if (optedInUsers.some((user) => user.phone && normalizePhone(user.phone) === number)) return true;

  const clientNumbers = config.clientsEnabled
    ? await db.client.findMany({ where: { whatsappPhone: { not: null } }, select: { whatsappPhone: true } })
    : [];
  if (config.clientsEnabled && clientNumbers.some((row) => row.whatsappPhone && normalizePhone(row.whatsappPhone) === number)) return true;
  const contact = await db.whatsAppContact.findUnique({ where: { pnJid: to }, select: { userId: true } });
  if (!contact?.userId) return false;
  const user = await db.user.findUnique({ where: { id: contact.userId }, select: { whatsappOptIn: true } });
  return user?.whatsappOptIn === true;
}

export function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "").replace(/^00/, "");
  // Ecuador local mobile numbers (09xxxxxxxx) are stored in international form.
  if (digits.startsWith("0") && digits.length === 10) digits = `593${digits.slice(1)}`;
  if (digits.startsWith("9") && digits.length === 9) digits = `593${digits}`;
  return digits;
}

export async function enqueueClientGroupWhatsApp(input: {
  clientId: string;
  purpose: "SHOOT" | "PAYMENT" | "APPROVAL" | "AI_QA";
  body: string;
  kind: WhatsAppMessageKind | string;
  dedupeKey: string;
  quotedId?: string | null;
}) {
  const group = await db.whatsAppGroup.findFirst({
    where: { clientId: input.clientId, enabled: true, purposes: { has: input.purpose } },
    select: { jid: true },
  });
  if (!group) return { skipped: true as const, reason: "no-enabled-group" };
  return enqueueWhatsApp({ ...input, to: group.jid });
}
