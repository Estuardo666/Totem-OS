import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getWhatsAppConfig } from "@/lib/whatsapp/config";
import { getWhatsAppStatus } from "@/lib/whatsapp/status";
import { resolveRoleCode } from "@/lib/roles";
import { redirect } from "next/navigation";
import WhatsAppAdmin from "./whatsapp-admin";

export const metadata = { title: "WhatsApp · Totem" };

async function getWorkerHealth() {
  const url = process.env.WA_HEALTH_URL;
  const token = process.env.WA_HEALTH_TOKEN;
  if (!url || !token) return { configured: false, online: null as boolean | null, connected: false, pairingOnly: false, qrAvailable: false, details: null as string | null };
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(4000) });
    const payload = await response.json().catch(() => null) as { status?: string; connected?: boolean; pairingOnly?: boolean; qrAvailable?: boolean; connection?: string } | null;
    const connected = payload?.connected === true;
    const pairingOnly = payload?.pairingOnly === true;
    const qrAvailable = payload?.qrAvailable === true;
    const details = connected ? pairingOnly ? "Vinculación local verificada" : "Conexión WhatsApp activa" : qrAvailable ? "QR local disponible" : payload?.connection ?? payload?.status ?? null;
    return { configured: true, online: response.ok, connected, pairingOnly, qrAvailable, details };
  } catch {
    return { configured: true, online: false, connected: false, pairingOnly: false, qrAvailable: false, details: "Sin respuesta del worker" };
  }
}

export default async function WhatsAppAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { roleCode: true, roleLegacy: true } });
  if (resolveRoleCode(user) !== "ADMIN") redirect("/");

  const [config, status, health, groups, clients, team, prompts, drafts, approvals, history, events] = await Promise.all([
    getWhatsAppConfig(), getWhatsAppStatus(), getWorkerHealth(),
    db.whatsAppGroup.findMany({ include: { client: { select: { id: true, name: true } } }, orderBy: { name: "asc" } }),
    db.client.findMany({ select: { id: true, name: true, whatsappPhone: true, paymentReminderTarget: true, approvalReminderHours: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { roleLegacy: { in: ["ADMIN", "EDITOR", "USER"] } }, select: { id: true, name: true, email: true, roleCode: true, roleLegacy: true, phone: true, whatsappOptIn: true, activeSchedule: true }, orderBy: { name: "asc" } }),
    db.whatsAppOwnerPrompt.findMany({ where: { status: "OPEN", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "asc" } }),
    db.whatsAppMessage.findMany({ where: { status: "DRAFT" }, orderBy: { createdAt: "asc" } }),
    db.whatsAppApprovalRequest.findMany({ include: { task: { select: { id: true, title: true, status: true, client: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.whatsAppMessage.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.whatsAppEvent.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return <WhatsAppAdmin config={{ ...config, ...status }} health={health} groups={groups} clients={clients} team={team.map((person) => ({ ...person, roleLegacy: person.roleLegacy ?? person.roleCode ?? "USER" }))} prompts={prompts} drafts={drafts} approvals={approvals} history={history} events={events} />;
}
