import { db } from "@/lib/db";
import { createOwnerPrompt } from "./audit";
import { getWhatsAppConfig } from "./config";
import { meetsPromotionCriteria, type PromotionFeature } from "./rollout-policy";

export async function eligiblePromotions(now = new Date()) {
  const since = new Date(now.getTime() - 14 * 86_400_000);
  const [groups, prompts, assignments] = await Promise.all([
    db.whatsAppGroup.findMany({ where: { enabled: true, clientId: { not: null } }, select: { jid: true, name: true, aiMode: true, approvalMode: true, purposes: true } }),
    db.whatsAppOwnerPrompt.findMany({ where: { type: { in: ["AI_DRAFT", "APPROVAL_DRAFT"] }, status: "ANSWERED", createdAt: { gte: since } }, select: { type: true, payload: true, answer: true, createdAt: true } }),
    db.whatsAppEvent.findMany({ where: { type: "GROUP_REASSIGNED", createdAt: { gte: since } }, select: { groupJid: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const eligible: Array<{ groupJid: string; groupName: string; feature: PromotionFeature }> = [];
  for (const group of groups) {
    for (const feature of ["AI", "APPROVAL"] as const) {
      if (!group.purposes.includes(feature === "AI" ? "AI_QA" : "APPROVAL")) continue;
      if ((feature === "AI" ? group.aiMode : group.approvalMode) !== "DRAFT") continue;
      const samples = prompts.filter((prompt) => {
        const payload = prompt.payload as Record<string, unknown>;
        const reassignedAt = assignments.find((event) => event.groupJid === group.jid)?.createdAt;
        return prompt.type === `${feature}_DRAFT` && payload.groupJid === group.jid && (!reassignedAt || prompt.createdAt >= reassignedAt);
      }).map((prompt) => ({ answer: prompt.answer, edited: (prompt.payload as Record<string, unknown>).edited === true }));
      if (meetsPromotionCriteria(samples)) eligible.push({ groupJid: group.jid, groupName: group.name, feature });
    }
  }
  return eligible;
}

export async function isWhatsAppPromotionEligible(groupJid: string, feature: PromotionFeature, now = new Date()): Promise<boolean> {
  return (await eligiblePromotions(now)).some((item) => item.groupJid === groupJid && item.feature === feature);
}

/** Proposes only; this job never activates a client or AUTO on its own. */
export async function proposeWhatsAppRollout(now = new Date()) {
  const config = await getWhatsAppConfig();
  if (config.paused || !config.ownerPhone) return;
  const [eligible, prior] = await Promise.all([
    eligiblePromotions(now),
    db.whatsAppOwnerPrompt.findMany({ where: { type: { in: ["PROMOTE_AUTO", "ENABLE_CLIENTS"] } }, select: { type: true, payload: true, status: true } }),
  ]);
  for (const item of eligible) {
    if (prior.some((prompt) => prompt.type === "PROMOTE_AUTO" && prompt.status !== "EXPIRED" && (prompt.payload as Record<string, unknown>).groupJid === item.groupJid && (prompt.payload as Record<string, unknown>).feature === item.feature)) continue;
    await createOwnerPrompt({ type: "PROMOTE_AUTO", payload: {
      ...item, groupJids: eligible.filter((candidate) => candidate.feature === item.feature).map((candidate) => candidate.groupJid),
      summary: `¿Activo modo automático de ${item.feature === "AI" ? "respuestas" : "aprobaciones"} en ${item.groupName}?`,
    }, options: ["Sí", "No", "Sí para todos los que cumplan"] });
  }
  if (config.clientsEnabled || prior.some((prompt) => prompt.type === "ENABLE_CLIENTS" && prompt.status !== "EXPIRED")) return;
  const started = await db.whatsAppEvent.findFirst({ where: { type: "ROLLOUT_TEST_STARTED" }, orderBy: { createdAt: "desc" } });
  // This marker is written after the linked test group has actually been created.
  if (!started || started.createdAt.getTime() > now.getTime() - 3 * 86_400_000) return;
  const [failures, successfulTests] = await Promise.all([
    db.whatsAppEvent.count({ where: { type: "ERROR", createdAt: { gte: started.createdAt } } }),
    db.whatsAppMessage.count({ where: { status: "SENT", sentAt: { gte: started.createdAt }, to: { endsWith: "@g.us" } } }),
  ]);
  if (failures || !successfulTests) return;
  const matched = await db.whatsAppGroup.findMany({ where: { clientId: { not: null } }, select: { jid: true } });
  await createOwnerPrompt({ type: "ENABLE_CLIENTS", payload: { groupJids: matched.map((group) => group.jid), summary: "Las pruebas llevan tres días sin errores. ¿Activo recordatorios en grupos de clientes?" }, options: ["Sí", "No"] });
}
