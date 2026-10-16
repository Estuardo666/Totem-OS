import { db } from "../../src/lib/db";
import { getAssistantModel } from "../../src/lib/assistant/config";
import { buildClientScopedTools } from "../../src/lib/assistant/client-scoped-tools";
import { getWhatsAppConfig } from "../../src/lib/whatsapp/config";
import { enqueueWhatsApp } from "../../src/lib/whatsapp/enqueue";
import { createOwnerPrompt, recordWhatsAppEvent } from "../../src/lib/whatsapp/prompts";
import { generateScopedReply } from "./ai-scope";
import { classifyWhatsAppIntent } from "./text";

/**
 * Client replies stay disabled until an approved model adapter can consume only
 * buildClientScopedTools(clientId). Never fall back to the general assistant.
 */
export async function draftClientReply(input: { groupJid: string; inboundId: string; text: string; quotedId?: string | null }) {
  const group = await db.whatsAppGroup.findUnique({ where: { jid: input.groupJid } });
  if (!group?.clientId || !group.enabled || !group.purposes.includes("AI_QA") || !["DRAFT", "AUTO"].includes(group.aiMode)) return;
  if (classifyWhatsAppIntent(input.text) !== "QUESTION") return;
  const recent = await db.whatsAppEvent.findFirst({ where: { type: "AI_QUESTION", groupJid: input.groupJid, createdAt: { gte: new Date(Date.now() - 60_000) } } });
  if (recent) return;
  const question = await db.whatsAppInbound.findUnique({ where: { id: input.inboundId }, select: { ts: true } });
  if (!question) return;
  const teamReply = await db.whatsAppInbound.findFirst({ where: { chatJid: input.groupJid, isTeam: true, ts: { gte: new Date(Date.now() - 10 * 60_000) } } });
  if (teamReply) return;
  await recordWhatsAppEvent({ type: "AI_QUESTION", groupJid: input.groupJid, payload: { inboundId: input.inboundId, clientId: group.clientId, status: "PROCESSING" } });
  const scoped = buildClientScopedTools(group.clientId);
  try {
    const waConfig = await getWhatsAppConfig();
    const resolved = await getAssistantModel(waConfig.aiModel ?? undefined);
    if ("error" in resolved) throw new Error("MODEL_UNAVAILABLE");
    const body = await generateScopedReply({ model: resolved.model, question: input.text, scoped });
    if (!body || body.length > 800) throw new Error("INVALID_MODEL_OUTPUT");
    const [teamReply, latestGroup] = await Promise.all([
      db.whatsAppInbound.findFirst({ where: { chatJid: input.groupJid, isTeam: true, ts: { gt: question.ts } }, select: { id: true } }),
      db.whatsAppGroup.findUnique({ where: { jid: input.groupJid }, select: { clientId: true, purposes: true, aiMode: true, enabled: true } }),
    ]);
    if (teamReply || latestGroup?.clientId !== group.clientId || !latestGroup.enabled || !latestGroup.purposes.includes("AI_QA") || !["DRAFT", "AUTO"].includes(latestGroup.aiMode)) {
      await recordWhatsAppEvent({ type: "AI_ESCALATED", groupJid: input.groupJid, payload: { inboundId: input.inboundId, reason: teamReply ? "TEAM_REPLIED_DURING_GENERATION" : "GROUP_POLICY_CHANGED" } });
      return;
    }
    const isDraft = latestGroup.aiMode !== "AUTO";
    const prompt = await enqueueWhatsApp({ to: input.groupJid, body: `🤖 Totem Bot: ${body}`, kind: "AI_REPLY", dedupeKey: `ai-reply:${input.groupJid}:${input.inboundId}`, scheduledFor: new Date(), draft: isDraft, quotedId: input.inboundId });
    if (isDraft) {
      await createOwnerPrompt({
        type: "AI_DRAFT",
        payload: {
          messageId: prompt.id,
          inboundId: input.inboundId,
          groupJid: input.groupJid,
          quotedId: input.quotedId,
          question: input.text.slice(0, 1000),
          proposedResponse: body,
          summary: `Pregunta del cliente: ${input.text.slice(0, 500)}\nRespuesta propuesta: ${body}`,
        },
        options: ["Enviar", "Descartar", "Responder yo"],
      });
    }
  } catch {
    await recordWhatsAppEvent({ type: "AI_ESCALATED", groupJid: input.groupJid, payload: { inboundId: input.inboundId, reason: "SAFE_DRAFT_UNAVAILABLE" } });
    await createOwnerPrompt({ type: "ALERT", payload: { summary: "No pude preparar una respuesta segura; el equipo puede contestar.", groupJid: input.groupJid, inboundId: input.inboundId }, options: ["Ver en Totem"] });
  }
}
