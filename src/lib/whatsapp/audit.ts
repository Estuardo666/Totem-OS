import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function recordWhatsAppEvent(input: {
  type: string;
  groupJid?: string | null;
  payload?: Record<string, unknown>;
}) {
  return db.whatsAppEvent.create({
    data: { type: input.type, groupJid: input.groupJid ?? null, payload: (input.payload ?? {}) as Prisma.InputJsonValue },
  });
}

export async function createOwnerPrompt(input: {
  type: string;
  payload: Record<string, unknown>;
  options: unknown;
  expiresAt?: Date;
  idPrefix?: string;
}) {
  const prefix = (input.idPrefix ?? input.type.slice(0, 1)).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) || "P";
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = `${prefix}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    try {
      return await db.whatsAppOwnerPrompt.create({
        data: {
          id,
          type: input.type,
          payload: input.payload as Prisma.InputJsonValue,
          options: input.options as never,
          expiresAt: input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }
  throw new Error("No se pudo crear el prompt del dueño");
}

export async function answerOwnerPrompt(input: { id: string; answer: string }) {
  const answer = input.answer.trim();
  if (!answer) throw new Error("Respuesta vacía");
  const now = new Date();
  const changed = await db.whatsAppOwnerPrompt.updateMany({
    where: { id: input.id, status: "OPEN", expiresAt: { gt: now } },
    data: { status: "ANSWERED", answer },
  });
  if (changed.count !== 1) throw new Error("Prompt vencido o ya respondido");
  return db.whatsAppOwnerPrompt.findUniqueOrThrow({ where: { id: input.id } });
}

export async function expireOwnerPrompts(now = new Date()) {
  return db.whatsAppOwnerPrompt.updateMany({
    where: { status: "OPEN", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
}
