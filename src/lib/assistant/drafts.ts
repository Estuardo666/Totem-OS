/**
 * Borradores firmados de acciones del asistente.
 *
 * Las herramientas de escritura no tocan la base de datos: devuelven un
 * borrador firmado (HMAC-SHA256) que la UI muestra para confirmar. Solo al
 * confirmar se ejecuta, y solo si la firma, el usuario y la vigencia cuadran.
 * Así el modelo nunca puede escribir sin que el usuario lo vea y lo apruebe,
 * y el borrador no se puede alterar en el navegador.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEncryptionKey } from "@/lib/crypto/token-cipher";

export const DRAFT_ACTIONS = ["crearGasto", "crearTarea", "registrarHonorario"] as const;
export type DraftAction = (typeof DRAFT_ACTIONS)[number];

export interface DraftPayload {
  action: DraftAction;
  /** Input listo para la server action correspondiente. */
  input: Record<string, unknown>;
  userId: string;
  /** Vencimiento en ms epoch. */
  exp: number;
  /** Nonce para que dos borradores idénticos tengan hashes distintos. */
  n: string;
}

const DRAFT_TTL_MS = 15 * 60 * 1000;

function sign(body: string): string {
  return createHmac("sha256", getEncryptionKey()).update(`assistant-draft:${body}`).digest("base64url");
}

export function createDraftToken(
  action: DraftAction,
  input: Record<string, unknown>,
  userId: string
): string {
  const payload: DraftPayload = {
    action,
    input,
    userId,
    exp: Date.now() + DRAFT_TTL_MS,
    n: randomBytes(9).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyDraftToken(
  token: string,
  userId: string
): { ok: true; payload: DraftPayload } | { ok: false; error: string } {
  const [body, signature] = typeof token === "string" ? token.split(".") : [];
  if (!body || !signature) return { ok: false, error: "Borrador inválido" };

  const expected = Buffer.from(sign(body));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { ok: false, error: "Borrador inválido" };
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DraftPayload;
  if (payload.userId !== userId) return { ok: false, error: "Este borrador es de otro usuario" };
  if (Date.now() > payload.exp) return { ok: false, error: "El borrador venció; pídelo de nuevo" };
  if (!(DRAFT_ACTIONS as readonly string[]).includes(payload.action)) {
    return { ok: false, error: "Acción desconocida" };
  }
  return { ok: true, payload };
}

export function hashDraftToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
