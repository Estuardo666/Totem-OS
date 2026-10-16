import { db } from "../../src/lib/db";
import { enqueueWhatsApp } from "../../src/lib/whatsapp/enqueue";
import { getWhatsAppConfig } from "../../src/lib/whatsapp/config";
import { applyOwnerPromptAnswer } from "../../src/lib/whatsapp/prompts";
import { parseOwnerAnswer } from "./text";

export async function handleOwnerReply(senderJid: string, text: string): Promise<boolean> {
  const config = await getWhatsAppConfig();
  if (!config.ownerPhone || !isOwnerJid(senderJid, config.ownerPhone)) return false;
  const open = await db.whatsAppOwnerPrompt.findMany({ where: { status: "OPEN", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "asc" } });
  const parsed = parseOwnerAnswer(text, open.map((prompt) => prompt.id));
  if (!parsed) return false;
  const outcome = await applyOwnerPromptAnswer({ id: parsed.id!, answer: parsed.answer, fromJid: senderJid });
  if (typeof outcome === "object" && outcome !== null && typeof outcome.url === "string") {
    await enqueueWhatsApp({ to: toJid(config.ownerPhone), body: `Abre Totem para revisar esta decisión: ${adminWhatsAppUrl()}`, kind: "OWNER_PROMPT", dedupeKey: `owner-prompt-view:${parsed.id}` });
  }
  return true;
}

export async function deliverOwnerPrompts() {
  const config = await getWhatsAppConfig();
  if (!config.ownerPhone) return;
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const recent = await db.whatsAppMessage.findFirst({ where: { kind: "OWNER_PROMPT", createdAt: { gte: new Date(now.getTime() - 10 * 60_000) } }, orderBy: { createdAt: "desc" } });
  if (recent) return;
  const [openPrompts, queuedMessages] = await Promise.all([
    db.whatsAppOwnerPrompt.findMany({ where: { status: "OPEN", expiresAt: { gt: now } }, orderBy: { createdAt: "asc" }, take: 100 }),
    db.whatsAppMessage.findMany({ where: { kind: "OWNER_PROMPT", status: { in: ["PENDING", "SENDING", "SENT"] }, createdAt: { gte: since } }, select: { body: true } }),
  ]);
  const queuedIds = new Set(queuedMessages.flatMap((message) => [...message.body.matchAll(/#([a-z0-9_-]{2,32})/gi)].map((match) => match[1].toUpperCase())));
  const prompts = openPrompts.filter((prompt) => !queuedIds.has(prompt.id.toUpperCase()));
  if (!prompts.length) return;
  const batch: typeof prompts = [];
  let body = "";
  for (const prompt of prompts) {
    const entry = `${formatPrompt(prompt)}\nResponde #${prompt.id} 1/2/3`;
    if (body.length + entry.length + 2 > 3900) break;
    batch.push(prompt);
    body = body ? `${body}\n\n${entry}` : entry;
  }
  if (!batch.length) return;
  const destination = toJid(config.ownerPhone);
  const ids = batch.map((item) => item.id);
  const timeBucket = Math.floor(now.getTime() / 600_000);
  await enqueueWhatsApp({ to: destination, body, kind: "OWNER_PROMPT", dedupeKey: `owner-prompts:${ids.join(",")}:${timeBucket}` });
}

function formatPrompt(prompt: { id: string; type: string; payload: unknown; options: unknown }) {
  const payload = prompt.payload as Record<string, unknown>;
  const candidates = Array.isArray(payload.candidates) ? payload.candidates as Array<Record<string, unknown>> : [];
  const candidateNames = candidates.map((candidate) => String(candidate.title ?? candidate.name ?? "")).filter(Boolean);
  const specificSummary = prompt.type === "GROUP_MATCH"
    ? `Grupo ${String(payload.groupName ?? "sin nombre")}. Clientes posibles: ${candidateNames.join(", ") || "ninguno"}.`
    : prompt.type === "TASK_PICK"
      ? `Video ${String(payload.fileName ?? "sin nombre")}. Tareas posibles: ${candidateNames.join(", ") || "ninguna"}.`
      : "Hay una decisión pendiente.";
  const summary = String(payload.summary ?? payload.text ?? payload.question ?? specificSummary).slice(0, 1200);
  const choices = Array.isArray(prompt.options) ? prompt.options.map((option, index) => `${index + 1}=${String(option)}`).join(" · ") : "1=Sí · 2=No · 3=Ver";
  return `🤖 Totem Bot · ${prompt.type} #${prompt.id}\n${summary}\n${choices.slice(0, 600)}`;
}
function isOwnerJid(jid: string, phone: string) { return digits(jid.split("@")[0]) === digits(phone).replace(/^0/, "593"); }
function toJid(phone: string) { return `${digits(phone).replace(/^0/, "593")}@s.whatsapp.net`; }
function digits(value: string) { return value.replace(/\D/g, ""); }

function adminWhatsAppUrl() {
  const base = process.env.TOTEM_API_URL;
  if (!base) return "/admin/whatsapp";
  try {
    const url = new URL(base);
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/admin/whatsapp`;
    return url.toString();
  } catch { return "/admin/whatsapp"; }
}
