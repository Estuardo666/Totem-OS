import { db } from "../../src/lib/db";

export async function identifyContact(jid: string, alternateJid?: string | null, pushName?: string | null) {
  const lid = jid.endsWith("@lid") ? jid : alternateJid?.endsWith("@lid") ? alternateJid : null;
  const pnJid = jid.endsWith("@s.whatsapp.net") ? jid : alternateJid?.endsWith("@s.whatsapp.net") ? alternateJid : null;
  const known = await db.whatsAppContact.findFirst({ where: { OR: [
    ...(lid ? [{ lid }] : []), ...(pnJid ? [{ pnJid }] : []),
  ] } });
  const userId = known?.userId ?? (pnJid ? await findTeamUserId(pnJid) : null);
  if (known) return db.whatsAppContact.update({ where: { id: known.id }, data: { lid: lid ?? known.lid, pnJid: pnJid ?? known.pnJid, pushName: pushName ?? known.pushName, userId } });
  if (!lid && !pnJid) return null;
  return db.whatsAppContact.create({ data: { lid, pnJid, pushName, userId } });
}

export async function resolveContact(jid: string) {
  return db.whatsAppContact.findFirst({ where: { OR: [{ lid: jid }, { pnJid: jid }] } });
}

export async function saveLidMappings(mappings: Array<{ lid: string; pn: string; pushName?: string }>) {
  for (const mapping of mappings) await identifyContact(mapping.lid, mapping.pn, mapping.pushName);
}

async function findTeamUserId(pnJid: string): Promise<string | null> {
  const number = pnJid.split("@")[0].replace(/\D/g, "");
  if (!number) return null;
  const users = await db.user.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } });
  const normalize = (value: string) => value.replace(/\D/g, "").replace(/^0/, "593");
  return users.find((user) => user.phone && normalize(user.phone) === normalize(number))?.id ?? null;
}
