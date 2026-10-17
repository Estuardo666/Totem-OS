import { db } from "../../src/lib/db";
import { matchClientFromCalendarEvent } from "../../src/lib/client-matcher";
import { createOwnerPrompt, recordWhatsAppEvent } from "../../src/lib/whatsapp/prompts";
import { tokenSetSimilarity } from "./text";

type GroupMetadata = { id: string; subject?: string; participants?: unknown[] };

export async function syncWhatsAppGroups(socket: { groupFetchAllParticipating: () => Promise<Record<string, GroupMetadata>> }) {
  const groups = await socket.groupFetchAllParticipating();
  const clients = await db.client.findMany({ select: { id: true, name: true } });
  const results = [];
  for (const group of Object.values(groups)) {
    const name = group.subject?.trim() || group.id;
    const isTest = /totem bot\s*[–-]\s*pruebas/i.test(name);
    const ranked = (isTest ? [] : clients.map((client) => ({ ...client, score: tokenSetSimilarity(name, client.name) })).sort((a, b) => b.score - a.score));
    let existing = await db.whatsAppGroup.findUnique({ where: { jid: group.id } });
    let clientId = isTest ? null : existing?.clientId ?? null;
    let matchScore = existing?.matchScore ?? null;
    const serviceEligible = ranked.some((item) => {
      const normalizedGroup = normalizeName(name);
      const normalizedClient = normalizeName(item.name);
      return normalizedClient.length >= 3 && (normalizedGroup.includes(normalizedClient) || normalizedClient.includes(normalizedGroup));
    });
    if (!clientId && serviceEligible) {
      try {
        const serviceMatch = await matchClientFromCalendarEvent(name);
        const candidate = ranked.find((item) => item.id === serviceMatch.clientId);
        if (candidate && candidate.score >= 0.85 && ["exact", "partial"].includes(serviceMatch.confidence)) {
          clientId = candidate.id;
          matchScore = candidate.score;
        }
      } catch {
        // A matcher outage must leave the group unassigned for owner review.
      }
      if (!clientId && ranked[0].score >= 0.85) {
        clientId = ranked[0].id;
        matchScore = ranked[0].score;
      }
    }
    existing = await db.whatsAppGroup.upsert({
      where: { jid: group.id },
      create: { jid: group.id, name, clientId, matchScore, purposes: isTest ? ["TEST"] : undefined, enabled: isTest, participants: group.participants as never, lastSeenAt: new Date() },
      update: { name, ...(isTest ? { clientId: null, matchScore: null, purposes: ["TEST"], enabled: true } : clientId ? { clientId, matchScore } : {}), participants: group.participants as never, lastSeenAt: new Date() },
    });
    if (isTest && !await db.whatsAppEvent.findFirst({ where: { type: "ROLLOUT_TEST_STARTED", groupJid: group.id } }) && (group.participants?.length ?? 0) > 0) {
      await recordWhatsAppEvent({ type: "ROLLOUT_TEST_STARTED", groupJid: group.id, payload: { participantCount: group.participants?.length ?? 0 } });
    }
    if (!existing.clientId && ranked[0]?.score > 0 && ranked[0]?.score < 0.85) {
      const openPrompts = await db.whatsAppOwnerPrompt.findMany({ where: { type: "GROUP_MATCH", status: "OPEN" }, select: { payload: true } });
      const alreadyPrompted = openPrompts.some((prompt) => (prompt.payload as { groupJid?: string }).groupJid === group.id);
      if (!alreadyPrompted) {
        const topCandidates = ranked.slice(0, 3);
        await createOwnerPrompt({
          type: "GROUP_MATCH",
          payload: { groupJid: group.id, groupName: name, summary: `El grupo “${name}” puede pertenecer a uno de estos clientes.`, candidates: topCandidates.map(({ id, name: clientName, score }) => ({ id, name: clientName, score })) },
          options: [...topCandidates.map((client) => `Asignar a ${client.name}`), "Ninguna"],
        });
      }
    }
    await recordWhatsAppEvent({ type: "GROUP_SYNC", groupJid: group.id, payload: { name, clientId: existing.clientId, matchScore: existing.matchScore } });
    results.push(existing);
  }
  return results;
}

function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
